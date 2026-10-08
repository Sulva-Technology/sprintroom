import { describe, expect, it } from 'vitest'
import { planStatusMove, filterBoardTasks, DEFAULT_BOARD_FILTERS, activeFilterCount } from '@/lib/tasks/board'

describe('planStatusMove', () => {
  it('moves between normal statuses', () => {
    expect(planStatusMove('backlog', 'doing')).toEqual({ kind: 'move', status: 'doing' })
  })
  it('asks for a reason before blocking', () => {
    expect(planStatusMove('doing', 'blocked')).toEqual({ kind: 'needs-reason' })
  })
  it('ignores same-column drops and unknown targets', () => {
    expect(planStatusMove('doing', 'doing')).toEqual({ kind: 'noop' })
    expect(planStatusMove('doing', 'archive')).toEqual({ kind: 'noop' })
  })
})

describe('filterBoardTasks', () => {
  const ctx = { userId: 'me', todayKey: '2026-10-08' }
  const t = (over: Record<string, unknown>) => ({
    id: Math.random().toString(36),
    owner_id: null as string | null,
    priority: 'medium',
    deadline: null as string | null,
    status: 'backlog',
    cycle_id: null as string | null,
    label_ids: [] as string[],
    ...over,
  })

  it('returns everything with default filters', () => {
    const tasks = [t({}), t({ owner_id: 'x' })]
    expect(filterBoardTasks(tasks, DEFAULT_BOARD_FILTERS, ctx)).toHaveLength(2)
  })

  it('filters by owner: me, unassigned, a specific person', () => {
    const mine = t({ owner_id: 'me' })
    const none = t({})
    const theirs = t({ owner_id: 'x' })
    const all = [mine, none, theirs]
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, owner: 'me' }, ctx)).toEqual([mine])
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, owner: 'unassigned' }, ctx)).toEqual([none])
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, owner: 'x' }, ctx)).toEqual([theirs])
  })

  it('filters by due window', () => {
    const late = t({ deadline: '2026-10-01T12:00:00Z' })
    const lateDone = t({ deadline: '2026-10-01T12:00:00Z', status: 'done' })
    const thisWeek = t({ deadline: '2026-10-14T12:00:00Z' })
    const nextWeek = t({ deadline: '2026-10-15T12:00:00Z' })
    const undated = t({})
    const all = [late, lateDone, thisWeek, nextWeek, undated]
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, due: 'overdue' }, ctx)).toEqual([late])
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, due: 'this-week' }, ctx)).toEqual([thisWeek])
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, due: 'none' }, ctx)).toEqual([undated])
  })

  it('filters by priority, cycle and label', () => {
    const urgentInCycle = t({ priority: 'urgent', cycle_id: 'c1', label_ids: ['bug'] })
    const plain = t({})
    const all = [urgentInCycle, plain]
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, priority: 'urgent' }, ctx)).toEqual([urgentInCycle])
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, cycle: 'c1' }, ctx)).toEqual([urgentInCycle])
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, cycle: 'none' }, ctx)).toEqual([plain])
    expect(filterBoardTasks(all, { ...DEFAULT_BOARD_FILTERS, label: 'bug' }, ctx)).toEqual([urgentInCycle])
  })

  it('counts active filters', () => {
    expect(activeFilterCount(DEFAULT_BOARD_FILTERS)).toBe(0)
    expect(activeFilterCount({ ...DEFAULT_BOARD_FILTERS, owner: 'me', due: 'overdue' })).toBe(2)
  })
})
