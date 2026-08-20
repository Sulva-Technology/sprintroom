import { z } from 'zod'

/**
 * The only columns a client may write through `updateTask`.
 *
 * `updateTask(id, data: any, projectId)` used to hand the client object straight
 * to `.update(data)`, so any authenticated caller could POST `workspace_id`,
 * `project_id`, `created_by` or `owner_id` — columns the UI never sends. Tenancy
 * on `tasks` is carried by `workspace_id`, and `project_id` implies it, so a
 * writable tenancy column is a tenant-boundary hole, not just sloppy input
 * handling. The DB-side half of this fix is the `WITH CHECK` clause added in
 * `20260819120000_task_update_with_check.sql`; this is the app-side half.
 *
 * Deliberately excluded: `id`, `workspace_id`, `project_id`, `created_by`,
 * `owner_id` (has its own action, `assignTaskOwner`), `created_at`.
 */
export const TASK_UPDATABLE_FIELDS = [
  'title',
  'description',
  'status',
  'priority',
  'deadline',
  'estimate_pomodoros',
  'blocked_reason',
  'last_progress_note',
] as const

export type TaskUpdatableField = (typeof TASK_UPDATABLE_FIELDS)[number]

/** `tasks.status` and `tasks.priority` are text columns, not enums — the set of
 *  valid values lives here rather than in the database. */
export const TASK_STATUSES = ['backlog', 'today', 'doing', 'blocked', 'review', 'done'] as const
export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const

export const taskUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(500),
    description: z.string().max(20000).nullable(),
    status: z.enum(TASK_STATUSES),
    priority: z.enum(TASK_PRIORITIES),
    deadline: z.string().datetime({ offset: true }).nullable(),
    estimate_pomodoros: z.number().int().min(0).max(1000),
    blocked_reason: z.string().max(2000).nullable(),
    last_progress_note: z.string().max(5000).nullable(),
  })
  .partial()
  .strict()

export type TaskUpdate = z.infer<typeof taskUpdateSchema>

export type TaskUpdateResult =
  | { ok: true; data: TaskUpdate }
  | { ok: false; error: string }

/**
 * Drop every key outside the allowlist, then validate what remains.
 *
 * Unknown keys are stripped rather than rejected so an older client sending a
 * stray field still gets its legitimate edit applied; anything that survives is
 * then type-checked by the schema (`.strict()` is a belt-and-braces guard in
 * case the allowlist and the schema ever drift apart).
 */
export function pickUpdatableTaskFields(input: unknown): TaskUpdateResult {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Invalid update payload' }
  }

  const source = input as Record<string, unknown>
  const picked: Record<string, unknown> = {}

  for (const field of TASK_UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      picked[field] = source[field]
    }
  }

  const parsed = taskUpdateSchema.safeParse(picked)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid update payload' }
  }

  if (Object.keys(parsed.data).length === 0) {
    return { ok: false, error: 'No updatable fields supplied' }
  }

  return { ok: true, data: parsed.data }
}
