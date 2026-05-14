'use client'

import { useState, useTransition } from 'react'
import { format, addDays, parseISO, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import { toggleRhythmCompletion } from '@/app/actions/rhythm'
import { CheckCircle2, Circle, Sparkles, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'motion/react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { RhythmSettingsDialog } from './rhythm-settings-dialog'
import { groupWeeklyRhythmTasks } from '@/lib/weekly-rhythm'

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface RhythmTask {
  id: string
  title: string
  day_of_week: number // 0=Sun, 1=Mon, ..., 6=Sat
}

interface Rhythm {
  id: string
  name: string
  description?: string
  weekly_rhythm_tasks: RhythmTask[]
}

interface RhythmLog {
  id: string
  rhythm_task_id: string
  completed_at: string // date string 'yyyy-MM-dd'
  proof_note?: string
}

interface WeeklyPlannerGridProps {
  rhythms: Rhythm[]
  logs: RhythmLog[]
  weekStart: string // 'yyyy-MM-dd' of Monday
}

export function WeeklyPlannerGrid({ rhythms, logs, weekStart }: WeeklyPlannerGridProps) {
  const [localLogs, setLocalLogs] = useState<RhythmLog[]>(logs)
  const [isPending, startTransition] = useTransition()

  // Build a map for fast lookup: `${rhythmTaskId}::${date}` => log
  const logMap = new Map<string, RhythmLog>(
    localLogs.map(l => [`${l.rhythm_task_id}::${l.completed_at}`, l])
  )

  const isCompleted = (taskId: string, date: string) =>
    logMap.has(`${taskId}::${date}`)

  // Build date strings for Mon-Sun
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(weekStart), i), 'yyyy-MM-dd')
  )

  function handleToggle(taskId: string, date: string, note?: string) {
    const key = `${taskId}::${date}`
    const alreadyDone = logMap.has(key)

    // Optimistic update
    if (alreadyDone) {
      setLocalLogs(prev => prev.filter(l => !(l.rhythm_task_id === taskId && l.completed_at === date)))
    } else {
      setLocalLogs(prev => [...prev, {
        id: `optimistic-${key}`,
        rhythm_task_id: taskId,
        completed_at: date,
        proof_note: note
      }])
    }

    startTransition(async () => {
      const result = await toggleRhythmCompletion(taskId, date, note)
      if (!result.success) {
        // Rollback
        setLocalLogs(logs)
        toast.error('Failed to update. Please try again.')
      }
    })
  }

  if (rhythms.length === 0) return null

  return (
    <div className="bg-white border border-border/50 rounded-3xl shadow-sm overflow-hidden">
      {/* Column Headers */}
      <div className="grid border-b border-border/40" style={{ gridTemplateColumns: '240px repeat(7, 1fr)' }}>
        <div className="p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/30">
          Task
        </div>
        {weekDates.map((date, i) => {
          const dayIsToday = isToday(parseISO(date))
          return (
            <div
              key={date}
              className={cn(
                'p-3 text-center border-r border-border/20 last:border-r-0',
                dayIsToday && 'bg-primary/5'
              )}
            >
              <p className={cn('text-xs font-bold uppercase tracking-wider', dayIsToday ? 'text-primary' : 'text-muted-foreground')}>
                {DAY_LABELS[i]}
              </p>
              <p className={cn('text-lg font-bold mt-0.5 tabular-nums', dayIsToday ? 'text-primary' : 'text-foreground/70')}>
                {format(parseISO(date), 'd')}
              </p>
              {dayIsToday && <div className="w-1.5 h-1.5 bg-primary rounded-full mx-auto mt-1" />}
            </div>
          )
        })}
      </div>

      {/* Rhythm Groups */}
      {rhythms.map((rhythm) => (
        <div key={rhythm.id} className="border-b border-border/30 last:border-b-0">

          {/* Group Label */}
          <div
            className="px-4 py-2 bg-slate-50/80 border-b border-border/20 text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
              {rhythm.name}
            </div>
            <RhythmSettingsDialog 
              initialData={rhythm} 
              trigger={
                <button className="p-1 hover:bg-slate-200 rounded-md transition-colors text-slate-400 hover:text-slate-600">
                  <Settings2 className="w-3.5 h-3.5" />
                </button>
              }
            />
          </div>

          {/* Tasks in this rhythm */}
          {groupWeeklyRhythmTasks(rhythm.weekly_rhythm_tasks || []).map((task) => {
            // Only render the task on the days it's scheduled (day_of_week)
            // day_of_week: 0=Sun,1=Mon...6=Sat. Our grid is Mon(1)..Sun(0)
            // weekDates[0]=Mon, weekDates[6]=Sun
            // Map grid index 0..6 to day_of_week 1..6,0
            const gridDayOfWeek = [1, 2, 3, 4, 5, 6, 0] // Mon=index 0 → day 1, ... Sun=index 6 → day 0

            return (
              <div
                key={task.id}
                className="grid border-b border-border/10 last:border-b-0 hover:bg-slate-50/50 transition-colors"
                style={{ gridTemplateColumns: '240px repeat(7, 1fr)' }}
              >
                {/* Task name */}
                <div className="p-3 px-4 flex items-center border-r border-border/20">
                  <span className="text-sm font-medium text-foreground truncate">{task.title}</span>
                </div>

                {/* Day cells */}
                {weekDates.map((date, i) => {
                  const scheduledTaskId = task.taskIdsByDay[gridDayOfWeek[i]]
                  const isScheduled = Boolean(scheduledTaskId)
                  const done = scheduledTaskId ? isCompleted(scheduledTaskId, date) : false
                  const dayIsToday = isToday(parseISO(date))

                  if (!isScheduled) {
                    return (
                      <div
                        key={date}
                        className={cn(
                          'border-r border-border/10 last:border-r-0 flex items-center justify-center p-2',
                          dayIsToday && 'bg-primary/5'
                        )}
                      >
                        <div className="w-5 h-5 rounded border border-dashed border-border/30" />
                      </div>
                    )
                  }

                  return (
                    <div
                      key={date}
                      className={cn(
                        'border-r border-border/10 last:border-r-0 flex items-center justify-center p-2',
                        dayIsToday && 'bg-primary/5'
                      )}
                    >
                      <GridCell
                        done={done}
                        onToggle={(note) => {
                          if (scheduledTaskId) {
                            handleToggle(scheduledTaskId, date, note)
                          }
                        }}
                        isPending={isPending}
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}

          {rhythm.weekly_rhythm_tasks?.length === 0 && (
            <div className="px-4 py-3 text-xs text-muted-foreground italic">
              No tasks in this rhythm yet. Edit to add tasks.
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function GridCell({ done, onToggle, isPending }: {
  done: boolean
  onToggle: (note?: string) => void
  isPending: boolean
}) {
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(false)

  function handleCheck() {
    if (done) {
      // Unchecking doesn't need a note
      onToggle()
    } else {
      // Open proof popover
      setOpen(true)
    }
  }

  function handleSubmitProof() {
    onToggle(note || undefined)
    setNote('')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            onClick={handleCheck}
            disabled={isPending}
            className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center transition-all focus-visible:ring-2 focus-visible:ring-primary outline-none',
              done
                ? 'bg-primary/10 text-primary hover:bg-red-50 hover:text-red-500'
                : 'border-2 border-dashed border-border/60 hover:border-primary hover:bg-primary/5 text-transparent hover:text-primary/30'
            )}
          />
        }
      >
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div
              key="done"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <CheckCircle2 className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div key="undone">
              <Circle className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>
      </PopoverTrigger>
      <PopoverContent className="w-72 rounded-2xl shadow-xl p-4 border-border/50" align="center">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold text-foreground">Add a Proof Note <span className="text-muted-foreground font-normal">(Optional)</span></p>
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What did you actually do? A link, a sentence, anything..."
          className="resize-none rounded-xl text-sm min-h-[80px] mb-3 border-border/60"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="rounded-lg flex-1 h-9"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="rounded-lg flex-1 h-9"
            onClick={handleSubmitProof}
          >
            Mark Done ✓
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
