'use client'

import { TASK_PRIORITIES } from '@/lib/tasks/updatable-fields'
import { DEFAULT_BOARD_FILTERS, activeFilterCount, type BoardFilters } from '@/lib/tasks/board'

const SELECT = 'h-9 rounded-lg border border-border bg-white px-2 text-sm'

export function BoardFilterBar({
  filters,
  onChange,
  owners,
  cycles,
  labels,
  shown,
  total,
}: {
  filters: BoardFilters
  onChange: (f: BoardFilters) => void
  owners: { id: string; name: string }[]
  cycles: { id: string; name: string }[]
  labels: { id: string; name: string }[]
  shown: number
  total: number
}) {
  const set = (patch: Partial<BoardFilters>) => onChange({ ...filters, ...patch })
  const active = activeFilterCount(filters)

  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
      <select aria-label="Filter by owner" value={filters.owner} onChange={(e) => set({ owner: e.target.value })} className={SELECT}>
        <option value="all">Anyone</option>
        <option value="me">Me</option>
        <option value="unassigned">Unassigned</option>
        {owners.map((o) => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
      <select aria-label="Filter by priority" value={filters.priority} onChange={(e) => set({ priority: e.target.value })} className={SELECT}>
        <option value="all">Any priority</option>
        {TASK_PRIORITIES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <select aria-label="Filter by due date" value={filters.due} onChange={(e) => set({ due: e.target.value as BoardFilters['due'] })} className={SELECT}>
        <option value="all">Any due date</option>
        <option value="overdue">Overdue</option>
        <option value="this-week">Due in 7 days</option>
        <option value="none">No due date</option>
      </select>
      {cycles.length > 0 && (
        <select aria-label="Filter by cycle" value={filters.cycle} onChange={(e) => set({ cycle: e.target.value })} className={SELECT}>
          <option value="all">Any cycle</option>
          <option value="none">No cycle</option>
          {cycles.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      )}
      {labels.length > 0 && (
        <select aria-label="Filter by label" value={filters.label} onChange={(e) => set({ label: e.target.value })} className={SELECT}>
          <option value="all">Any label</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      )}
      {active > 0 && (
        <button onClick={() => onChange(DEFAULT_BOARD_FILTERS)} className="text-sm font-medium text-primary">
          Clear {active} filter{active === 1 ? '' : 's'} · showing {shown}/{total}
        </button>
      )}
    </div>
  )
}
