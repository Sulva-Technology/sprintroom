'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { updateTask } from '@/app/actions/task-details'
import { TASK_PRIORITIES, TASK_STATUSES, type TaskUpdate } from '@/lib/tasks/updatable-fields'
import { toDeadlineIso, dateInputFromDeadline } from '@/lib/tasks/deadline'

export function TaskEditFields({
  taskId,
  projectId,
  workspaceId,
  title,
  priority,
  deadline,
  status,
  cycleId,
  cycleOptions,
  onSaved,
}: {
  taskId: string
  projectId: string
  workspaceId: string
  title: string
  priority: string
  deadline: string | null
  status: string
  cycleId: string | null
  cycleOptions: { id: string; name: string }[]
  onSaved: () => void
}) {
  const [draftTitle, setDraftTitle] = useState(title)
  const [saving, setSaving] = useState(false)

  async function save(fields: TaskUpdate) {
    setSaving(true)
    try {
      if (!navigator.onLine) {
        const { addToSyncQueue } = await import('@/lib/offline/sync-queue')
        await addToSyncQueue('update_task', 'task', taskId, fields, workspaceId, projectId)
        toast.success('Saved offline. It will sync when you reconnect.')
      } else {
        const res = await updateTask(taskId, fields, projectId)
        if ('error' in res && res.error) {
          toast.error(res.error)
          return
        }
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const fieldClass = 'mt-1 block h-9 w-full rounded-lg border border-border bg-white px-2 text-sm'

  return (
    <div className="mb-6 space-y-3">
      <label className="block text-xs font-semibold text-muted-foreground">
        Title
        <Input
          value={draftTitle}
          disabled={saving}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={() => {
            const value = draftTitle.trim()
            if (value && value !== title) save({ title: value })
            else setDraftTitle(title)
          }}
          className="mt-1"
        />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-xs font-semibold text-muted-foreground">
          Status
          <select
            data-shortcut="status"
            value={status}
            disabled={saving}
            onChange={(e) => save({ status: e.target.value as NonNullable<TaskUpdate['status']> })}
            className={fieldClass}
          >
            {/* blocked needs a reason, so it stays on the board's Mark Blocked flow */}
            {TASK_STATUSES.filter((s) => s !== 'blocked' || status === 'blocked').map((s) => (
              <option key={s} value={s} disabled={s === 'blocked'}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Priority
          <select
            data-shortcut="priority"
            value={priority}
            disabled={saving}
            onChange={(e) => save({ priority: e.target.value as NonNullable<TaskUpdate['priority']> })}
            className={fieldClass}
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Due
          <input
            data-shortcut="due"
            type="date"
            value={dateInputFromDeadline(deadline)}
            disabled={saving}
            onChange={(e) => save({ deadline: toDeadlineIso(e.target.value) })}
            className={fieldClass}
          />
        </label>
        <label className="text-xs font-semibold text-muted-foreground">
          Cycle
          <select
            value={cycleId ?? ''}
            disabled={saving}
            onChange={(e) => save({ cycle_id: e.target.value || null })}
            className={fieldClass}
          >
            <option value="">No cycle</option>
            {cycleOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
