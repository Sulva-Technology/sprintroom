export type MyDayTask = {
  id: string
  title: string
  status: string
  priority: string | null
  deadline: string | null
  project_id: string
  project_name: string | null
  owner_id: string | null
  created_by: string | null
}

export type MyDayGroups = { overdue: MyDayTask[]; today: MyDayTask[]; upNext: MyDayTask[] }

const ACTIVE_STATUSES = new Set(['today', 'doing', 'blocked', 'review'])
const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 }

const rank = (t: MyDayTask) => PRIORITY_RANK[t.priority ?? 'medium'] ?? 2
const dueKey = (t: MyDayTask) => (t.deadline ? t.deadline.slice(0, 10) : null)

/** Mine = assigned to me, or created by me and still unassigned. */
export function isMyTask(task: Pick<MyDayTask, 'owner_id' | 'created_by'>, userId: string): boolean {
  return task.owner_id === userId || (task.owner_id === null && task.created_by === userId)
}

/**
 * Split my open tasks into three lists. Deadlines are compared as calendar
 * dates (`YYYY-MM-DD`) against `todayKey` in the user's own timezone, so a
 * server running in UTC never shifts a task to the wrong day.
 */
export function groupMyDay(tasks: MyDayTask[], userId: string, todayKey: string): MyDayGroups {
  const groups: MyDayGroups = { overdue: [], today: [], upNext: [] }

  for (const t of tasks) {
    if (t.status === 'done' || !isMyTask(t, userId)) continue
    const due = dueKey(t)
    if (due && due < todayKey) groups.overdue.push(t)
    else if (ACTIVE_STATUSES.has(t.status) || due === todayKey) groups.today.push(t)
    else groups.upNext.push(t)
  }

  groups.overdue.sort((a, b) => (dueKey(a) ?? '').localeCompare(dueKey(b) ?? ''))
  groups.today.sort((a, b) => {
    const doing = Number(b.status === 'doing') - Number(a.status === 'doing')
    return doing !== 0 ? doing : rank(a) - rank(b)
  })
  groups.upNext.sort((a, b) => {
    const da = dueKey(a)
    const db = dueKey(b)
    if (da && db && da !== db) return da.localeCompare(db)
    if (da && !db) return -1
    if (!da && db) return 1
    return rank(a) - rank(b)
  })

  return groups
}

/** Calendar date (`YYYY-MM-DD`) of `now` in `timeZone`; unknown zones fall back to UTC. */
export function dateKeyInTimeZone(now: Date, timeZone: string | null | undefined): string {
  const format = (tz: string) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  try {
    return format(timeZone || 'UTC')
  } catch {
    return format('UTC')
  }
}
