'use client'

import { useMemo, useOptimistic, useState, useTransition } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CreateTaskDialog } from './create-task-dialog'
import { BoardColumn } from './board-column'
import { TaskCard } from './task-card'
import { MarkBlockedDialog } from './mark-blocked-dialog'
import { BoardFilterBar } from './board-filters'
import { useOfflineBoardTasks } from '@/lib/offline/offline-tasks'
import { updateTaskStatus } from '@/app/actions/tasks'
import { DEFAULT_BOARD_FILTERS, filterBoardTasks, planStatusMove, type BoardFilters } from '@/lib/tasks/board'

const STATUSES = ['backlog', 'today', 'doing', 'blocked', 'review', 'done']

const STATUS_CONFIG: Record<string, { label: string, color: string, emptyMsg: string }> = {
  backlog: { label: 'Backlog', color: 'bg-slate-200 text-slate-700', emptyMsg: 'No pending tasks.' },
  today: { label: 'Today', color: 'bg-indigo-100 text-indigo-700 border border-indigo-200', emptyMsg: 'Nothing scheduled for today.' },
  doing: { label: 'Doing', color: 'bg-amber-100 text-amber-700 border border-amber-200', emptyMsg: 'No active focus.' },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-700 border border-red-200', emptyMsg: 'Clear runway.' },
  review: { label: 'Review', color: 'bg-purple-100 text-purple-700 border border-purple-200', emptyMsg: 'Nothing strictly pending review.' },
  done: { label: 'Done', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200', emptyMsg: 'No completed tasks yet.' },
}

type Label = { id: string; name: string; color: string }

export function BoardClient({
  project,
  initialTasks,
  canEdit = true,
  currentUserId,
  todayKey,
  cycles = [],
  labels = [],
}: {
  project: any
  initialTasks: any[]
  canEdit?: boolean
  currentUserId: string
  todayKey: string
  cycles?: { id: string; name: string }[]
  labels?: Label[]
}) {
  const tasks = useOfflineBoardTasks(project.id, initialTasks)
  const [optimisticTasks, applyMove] = useOptimistic(tasks, (state: any[], move: { id: string; status: string }) =>
    state.map((t) => (t.id === move.id ? { ...t, status: move.status } : t))
  )
  const [, startTransition] = useTransition()
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_BOARD_FILTERS)
  const [blockingTaskId, setBlockingTaskId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  )

  const owners = useMemo(() => {
    const byId = new Map<string, string>()
    for (const t of tasks) if (t.owner_id && t.owner?.full_name) byId.set(t.owner_id, t.owner.full_name)
    return Array.from(byId, ([id, name]) => ({ id, name }))
  }, [tasks])
  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels])
  const visible = filterBoardTasks(optimisticTasks, filters, { userId: currentUserId, todayKey })
  const dragging = draggingId ? optimisticTasks.find((t) => t.id === draggingId) : null

  /** The one status-change path for drag and the card menu: optimistic, offline-aware. */
  function moveTask(task: any, target: string) {
    const plan = planStatusMove(task.status, target)
    if (plan.kind === 'noop') return
    if (plan.kind === 'needs-reason') {
      setBlockingTaskId(task.id)
      return
    }
    startTransition(async () => {
      applyMove({ id: task.id, status: plan.status })
      if (!navigator.onLine) {
        const { addToSyncQueue } = await import('@/lib/offline/sync-queue')
        await addToSyncQueue('update_task_status', 'task', task.id, { status: plan.status }, task.workspace_id, project.id)
        return
      }
      const res = await updateTaskStatus(task.id, plan.status, { projectId: project.id })
      if (!res.success) toast.error(res.error?.message ?? 'Could not move the task')
    })
  }

  function onDragStart(e: DragStartEvent) {
    setDraggingId(String(e.active.id))
  }

  function onDragEnd(e: DragEndEvent) {
    setDraggingId(null)
    if (!e.over) return
    const task = optimisticTasks.find((t) => t.id === e.active.id)
    if (task) moveTask(task, String(e.over.id))
  }

  if (tasks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-white border border-border/50 rounded-3xl shadow-sm">
        <h2 className="text-xl font-bold tracking-tight mb-2">No tasks yet.</h2>
        <p className="text-muted-foreground text-sm mb-6 text-center max-w-sm">
          {canEdit
            ? 'Break this project down into manageable chunks. Create the first task and start moving.'
            : 'This project has no tasks yet.'}
        </p>
        {canEdit && (
          <CreateTaskDialog projectId={project.id} trigger={<Button className="rounded-xl shadow-sm px-6 h-11"><Plus className="w-4 h-4 mr-2"/> Create first task</Button>} />
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-4">
      <BoardFilterBar
        filters={filters}
        onChange={setFilters}
        owners={owners}
        cycles={cycles}
        labels={labels}
        shown={visible.length}
        total={optimisticTasks.length}
      />

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDraggingId(null)}>
        <div className="flex-1 flex gap-4 md:gap-6 px-1">
          {canEdit && (
            <div className="hidden absolute right-4 top-24 z-10 md:block">
              <CreateTaskDialog projectId={project.id} trigger={<Button size="sm" className="rounded-full h-9 px-4 shadow-sm bg-primary text-primary-foreground focus-visible:ring-offset-2"><Plus className="w-4 h-4 mr-1.5" />New Task</Button>} />
            </div>
          )}

          {STATUSES.map((status) => {
            const colTasks = visible.filter((t) => t.status === status)
            const config = STATUS_CONFIG[status]
            return (
              <BoardColumn key={status} status={status} config={config} count={colTasks.length}>
                {colTasks.length === 0 ? (
                  <div className="text-xs font-medium text-slate-400 text-center py-6 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    {config.emptyMsg}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {colTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        projectId={project.id}
                        canEdit={canEdit}
                        labels={(task.label_ids ?? []).map((id: string) => labelsById.get(id)).filter(Boolean) as Label[]}
                        onMove={(s) => moveTask(task, s)}
                      />
                    ))}
                  </div>
                )}
              </BoardColumn>
            )
          })}
        </div>

        <DragOverlay>
          {dragging ? (
            <div className="w-[280px] rounded-2xl border border-border bg-white p-4 text-sm font-medium shadow-lg">{dragging.title}</div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {blockingTaskId && (
        <MarkBlockedDialog
          taskId={blockingTaskId}
          projectId={project.id}
          open
          onOpenChange={(open) => {
            if (!open) setBlockingTaskId(null)
          }}
        />
      )}
    </div>
  )
}
