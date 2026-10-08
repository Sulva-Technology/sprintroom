import { TASK_STATUSES } from '@/lib/tasks/updatable-fields'
import { addDaysToKey } from '@/lib/dates'

export type TaskStatus = (typeof TASK_STATUSES)[number]
export type MovePlan = { kind: 'noop' } | { kind: 'needs-reason' } | { kind: 'move'; status: TaskStatus }

/** What dropping a card (or picking a status) should do. Blocked needs a reason. */
export function planStatusMove(current: string, target: string): MovePlan {
  if (!(TASK_STATUSES as readonly string[]).includes(target) || current === target) return { kind: 'noop' }
  if (target === 'blocked') return { kind: 'needs-reason' }
  return { kind: 'move', status: target as TaskStatus }
}

export type BoardFilters = {
  owner: string // 'all' | 'me' | 'unassigned' | <user id>
  priority: string // 'all' | priority
  due: 'all' | 'overdue' | 'this-week' | 'none'
  cycle: string // 'all' | 'none' | <cycle id>
  label: string // 'all' | <label id>
}

export const DEFAULT_BOARD_FILTERS: BoardFilters = { owner: 'all', priority: 'all', due: 'all', cycle: 'all', label: 'all' }

type FilterableTask = {
  owner_id: string | null
  priority: string | null
  deadline: string | null
  status: string
  cycle_id?: string | null
  label_ids?: string[]
}

export function filterBoardTasks<T extends FilterableTask>(
  tasks: T[],
  f: BoardFilters,
  ctx: { userId: string; todayKey: string }
): T[] {
  const weekEnd = addDaysToKey(ctx.todayKey, 6)
  return tasks.filter((t) => {
    if (f.owner === 'me' && t.owner_id !== ctx.userId) return false
    if (f.owner === 'unassigned' && t.owner_id !== null) return false
    if (!['all', 'me', 'unassigned'].includes(f.owner) && t.owner_id !== f.owner) return false

    if (f.priority !== 'all' && (t.priority ?? 'medium') !== f.priority) return false

    const due = t.deadline ? t.deadline.slice(0, 10) : null
    if (f.due === 'overdue' && !(due && due < ctx.todayKey && t.status !== 'done')) return false
    if (f.due === 'this-week' && !(due && due >= ctx.todayKey && due <= weekEnd)) return false
    if (f.due === 'none' && due !== null) return false

    if (f.cycle === 'none' && t.cycle_id) return false
    if (!['all', 'none'].includes(f.cycle) && t.cycle_id !== f.cycle) return false

    if (f.label !== 'all' && !(t.label_ids ?? []).includes(f.label)) return false
    return true
  })
}

export function activeFilterCount(f: BoardFilters): number {
  return (Object.keys(DEFAULT_BOARD_FILTERS) as (keyof BoardFilters)[]).filter((k) => f[k] !== DEFAULT_BOARD_FILTERS[k]).length
}
