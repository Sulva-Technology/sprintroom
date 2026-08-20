/**
 * A recording fake that behaves like PostgREST where it matters: it rejects
 * writes to columns that do not exist in the live schema, rejects NULL in a
 * NOT NULL column, and rejects an embed between two tables with no FK.
 *
 * The live column set is parsed from supabase/migrations/* (the source of
 * truth per CLAUDE.md), never from the code under test.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const migrationsDir = join(__dirname, '..', '..', '..', 'supabase', 'migrations')

export function liveTaskColumns(): Set<string> {
  const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()
  const columns = new Set<string>()

  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), 'utf8')

    // Last `create table public.tasks (...)` wins; 0002 drops and recreates it.
    const created = sql.match(/create table (?:if not exists )?public\.tasks\s*\(([\s\S]*?)\n\);/i)
    if (created) {
      columns.clear()
      for (const line of created[1].split('\n')) {
        const col = line.trim().match(/^([a-z_][a-z0-9_]*)\s+/i)
        if (col && !/^(primary|unique|constraint|check|foreign)$/i.test(col[1])) columns.add(col[1])
      }
    }

    for (const add of sql.matchAll(
      /alter table (?:only )?public\.tasks\s+add column (?:if not exists )?([a-z_][a-z0-9_]*)/gi,
    )) {
      columns.add(add[1])
    }
  }

  return columns
}

const TASK_NOT_NULL = ['project_id', 'title']

export type Call = {
  table: string
  select?: string
  insert?: any
  update?: any
  deleted?: boolean
  filters: [string, any[]][]
}

export function makeFakeSupabase(rows: Record<string, any[]>) {
  const calls: Call[] = []
  const inserted: Record<string, any[]> = {}
  const taskColumns = liveTaskColumns()

  function resolve(call: Call) {
    // PostgREST refuses an embed with no foreign key between the tables.
    if (call.select && /\b(web_push_subscriptions|focus_schedules)\s*\(/.test(call.select)) {
      return {
        data: null,
        error: {
          code: 'PGRST200',
          message: `Could not find a relationship between '${call.table}' and the embedded resource in the schema cache`,
        },
      }
    }

    if (call.insert) {
      const payload = Array.isArray(call.insert) ? call.insert : [call.insert]
      for (const row of payload) {
        if (call.table === 'tasks') {
          for (const key of Object.keys(row)) {
            if (!taskColumns.has(key)) {
              return {
                data: null,
                error: {
                  code: 'PGRST204',
                  message: `Could not find the '${key}' column of 'tasks' in the schema cache`,
                },
              }
            }
          }
          for (const key of TASK_NOT_NULL) {
            if (row[key] === null || row[key] === undefined) {
              return {
                data: null,
                error: {
                  code: '23502',
                  message: `null value in column "${key}" of relation "tasks" violates not-null constraint`,
                },
              }
            }
          }
        }
        ;(inserted[call.table] ||= []).push(row)
      }
      return { data: payload, error: null }
    }

    if (call.update || call.deleted) return { data: null, error: null }

    return { data: rows[call.table] ?? [], error: null }
  }

  const client = {
    calls,
    inserted,
    taskColumns,
    from(table: string) {
      const call: Call = { table, filters: [] }
      calls.push(call)

      const builder: any = {
        select(arg?: string) {
          call.select = arg ?? '*'
          return builder
        },
        insert(value: any) {
          call.insert = value
          return builder
        },
        update(value: any) {
          call.update = value
          return builder
        },
        delete() {
          call.deleted = true
          return builder
        },
        then(onOk: any, onErr: any) {
          return Promise.resolve(resolve(call)).then(onOk, onErr)
        },
      }

      for (const op of ['eq', 'in', 'lte', 'gte', 'gt', 'lt', 'is', 'neq', 'order', 'limit']) {
        builder[op] = (...args: any[]) => {
          call.filters.push([op, args])
          return builder
        }
      }

      return builder
    },
  }

  return client
}
