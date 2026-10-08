'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createLabel, setTaskLabel } from '@/app/actions/labels'
import { labelStyle, normalizeLabelName } from '@/lib/labels'

type Label = { id: string; name: string; color: string }

export function LabelPicker({
  taskId,
  projectId,
  workspaceId,
  labels,
  labelIds,
  onChanged,
}: {
  taskId: string
  projectId: string
  workspaceId: string
  labels: Label[]
  labelIds: string[]
  onChanged: () => void
}) {
  const [draft, setDraft] = useState('')
  const [pending, startTransition] = useTransition()
  const selected = new Set(labelIds)

  function toggle(label: Label) {
    startTransition(async () => {
      const res = await setTaskLabel(taskId, label.id, !selected.has(label.id), projectId)
      if (!res.success) toast.error(res.error)
      else onChanged()
    })
  }

  function add(e: React.FormEvent) {
    e.preventDefault()
    const name = normalizeLabelName(draft)
    if (!name) return
    startTransition(async () => {
      const existing = labels.find((l) => l.name.toLowerCase() === name.toLowerCase())
      let label = existing
      if (!label) {
        const res = await createLabel(workspaceId, name)
        if (!res.success) {
          toast.error(res.error)
          return
        }
        label = res.label
      }
      const res = await setTaskLabel(taskId, label.id, true, projectId)
      if (!res.success) toast.error(res.error)
      else {
        setDraft('')
        onChanged()
      }
    })
  }

  return (
    <div className="mb-6 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground">Labels</p>
      <div className="flex flex-wrap gap-1.5">
        {labels.map((label) => (
          <button
            key={label.id}
            type="button"
            disabled={pending}
            onClick={() => toggle(label)}
            aria-pressed={selected.has(label.id)}
            className={
              selected.has(label.id)
                ? `rounded-md border px-2 py-0.5 text-xs font-semibold ${labelStyle(label.color)}`
                : 'rounded-md border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-500'
            }
          >
            {label.name}
          </button>
        ))}
      </div>
      <form onSubmit={add} className="flex max-w-xs gap-2">
        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="New label" aria-label="New label" disabled={pending} className="h-8" />
        <Button type="submit" size="sm" disabled={pending || !draft.trim()}>Add</Button>
      </form>
    </div>
  )
}
