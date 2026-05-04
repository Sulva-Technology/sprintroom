'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CreateTaskDialog } from './create-task-dialog'
import { BoardColumn } from './board-column'
import { TaskCard } from './task-card'

const STATUSES = ['backlog', 'today', 'doing', 'blocked', 'review', 'done']

const STATUS_CONFIG: Record<string, { label: string, color: string, emptyMsg: string }> = {
  backlog: { label: 'Backlog', color: 'bg-slate-200 text-slate-700', emptyMsg: 'No pending tasks.' },
  today: { label: 'Today', color: 'bg-indigo-100 text-indigo-700 border border-indigo-200', emptyMsg: 'Nothing scheduled for today.' },
  doing: { label: 'Doing', color: 'bg-amber-100 text-amber-700 border border-amber-200', emptyMsg: 'No active focus.' },
  blocked: { label: 'Blocked', color: 'bg-red-100 text-red-700 border border-red-200', emptyMsg: 'Clear runway.' },
  review: { label: 'Review', color: 'bg-purple-100 text-purple-700 border border-purple-200', emptyMsg: 'Nothing strictly pending review.' },
  done: { label: 'Done', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200', emptyMsg: 'No completed tasks yet.' },
}

export function BoardClient({ project, initialTasks }: { project: any, initialTasks: any[] }) {
  const [tasks, setTasks] = useState(initialTasks)

  if (tasks.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-white border border-border/50 rounded-3xl shadow-sm">
        <h2 className="text-xl font-bold tracking-tight mb-2">No tasks yet.</h2>
        <p className="text-muted-foreground text-sm mb-6 text-center max-w-sm">
          Break this project down into manageable chunks. Create the first task and start moving.
        </p>
        <CreateTaskDialog projectId={project.id} trigger={<Button className="rounded-xl shadow-sm px-6 h-11"><Plus className="w-4 h-4 mr-2"/> Create first task</Button>} />
      </div>
    )
  }

  return (
    <div className="h-full flex gap-4 md:gap-6 px-1">
      <div className="hidden absolute right-4 top-24 z-10 md:block">
        <CreateTaskDialog projectId={project.id} trigger={<Button size="sm" className="rounded-full h-9 px-4 shadow-sm bg-primary text-primary-foreground focus-visible:ring-offset-2"><Plus className="w-4 h-4 mr-1.5" />New Task</Button>} />
      </div>

      {STATUSES.map(status => {
        const colTasks = tasks.filter(t => t.status === status)
        const config = STATUS_CONFIG[status]

        return (
          <BoardColumn key={status} status={status} config={config} count={colTasks.length}>
            {colTasks.length === 0 ? (
              <div className="text-xs font-medium text-slate-400 text-center py-6 px-4 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                {config.emptyMsg}
              </div>
            ) : (
              <div className="space-y-3">
                {colTasks.map(task => (
                  <TaskCard key={task.id} task={task} projectId={project.id} />
                ))}
              </div>
            )}
          </BoardColumn>
        )
      })}
    </div>
  )
}
