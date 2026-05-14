'use client'

import { useState, useTransition } from 'react'
import { Plus, Repeat2, Loader2, Trash2, GripVertical, X, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { saveRhythmTemplate, deleteRhythmTemplate } from '@/app/actions/rhythm'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface RhythmTaskDraft {
  id: string
  title: string
  days: number[] // Now an array
}

export function RhythmSettingsDialog({ 
  showLabel, 
  initialData, 
  trigger 
}: { 
  showLabel?: boolean, 
  initialData?: any,
  trigger?: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [name, setName] = useState(initialData?.name || '')
  const [description, setDescription] = useState(initialData?.description || '')
  
  // Initialize tasks from initialData if editing
  // We need to group tasks by title to match our multi-day UI logic
  const [tasks, setTasks] = useState<RhythmTaskDraft[]>(() => {
    if (initialData?.weekly_rhythm_tasks) {
      const grouped = new Map<string, number[]>()
      initialData.weekly_rhythm_tasks.forEach((t: any) => {
        const existing = grouped.get(t.title) || []
        grouped.set(t.title, [...existing, t.day_of_week])
      })
      
      return Array.from(grouped.entries()).map(([title, days]) => ({
        id: crypto.randomUUID(),
        title,
        days
      }))
    }
    return [{ id: crypto.randomUUID(), title: '', days: [1] }]
  })

  function addTask() {
    setTasks(prev => [...prev, { id: crypto.randomUUID(), title: '', days: [1] }])
  }

  function removeTask(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  function updateTask(id: string, field: 'title' | 'days', value: any) {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t
      if (field === 'title') return { ...t, title: value }
      
      // For days, toggle if already exists
      const currentDays = t.days
      const day = value as number
      const newDays = currentDays.includes(day)
        ? currentDays.filter(d => d !== day)
        : [...currentDays, day]
      
      return { ...t, days: newDays.sort() }
    }))
  }

  function setAllDays(id: string, mode: 'all' | 'weekdays' | 'none') {
    let newDays: number[] = []
    if (mode === 'all') newDays = [0, 1, 2, 3, 4, 5, 6]
    else if (mode === 'weekdays') newDays = [1, 2, 3, 4, 5]
    
    setTasks(prev => prev.map(t => t.id === id ? { ...t, days: newDays } : t))
  }

  function handleSubmit() {
    if (!name.trim()) {
      toast.error('Rhythm name is required.')
      return
    }
    const validTasks = tasks.filter(t => t.title.trim())
    if (validTasks.length === 0) {
      toast.error('Add at least one task to this rhythm.')
      return
    }

    startTransition(async () => {
      // Flatten multi-day tasks into individual task records for the grid
      const flattenedTasks: { title: string, day_of_week: number }[] = []
      validTasks.forEach(vt => {
        vt.days.forEach(day => {
          flattenedTasks.push({ title: vt.title.trim(), day_of_week: day })
        })
      })

      if (flattenedTasks.length === 0) {
        toast.error('Please select at least one day for your tasks.')
        return
      }

      const result = await saveRhythmTemplate({
        id: initialData?.id, // Important: pass the ID for updates
        name: name.trim(),
        description: description.trim() || undefined,
        tasks: flattenedTasks
      })

      if (result.success) {
        toast.success(initialData ? 'Rhythm updated!' : `"${name}" rhythm created!`)
        setOpen(false)
        if (!initialData) {
          setName('')
          setDescription('')
          setTasks([{ id: crypto.randomUUID(), title: '', days: [1] }])
        }
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to save rhythm.')
      }
    })
  }

  function handleDelete() {
    if (!initialData?.id) return
    if (!confirm('Are you sure you want to delete this rhythm and all its history?')) return

    startTransition(async () => {
      const result = await deleteRhythmTemplate(initialData.id)
      if (result.success) {
        toast.success('Rhythm deleted.')
        setOpen(false)
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to delete.')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          trigger || (
            <Button
              size="sm"
              className={cn('rounded-full h-9 shadow-sm', showLabel ? 'px-4' : 'px-3')}
            >
              <Plus className="w-4 h-4 mr-2" />
              {showLabel ? 'New Rhythm' : 'New Rhythm'}
            </Button>
          )
        }
      />

      <DialogContent className="sm:max-w-[540px] rounded-3xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border/40 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Repeat2 className="w-4 h-4 text-primary" />
                </div>
                {initialData ? 'Edit Rhythm' : 'New Weekly Rhythm'}
              </div>
              {initialData && (
                <Button 
                  variant="ghost" 
                  size="icon-sm" 
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </DialogTitle>
            <DialogDescription className="mt-1">
              A rhythm is a group of tasks that repeat on a schedule each week.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="font-semibold text-foreground/80">Rhythm Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Morning Routine, Code Review, Weekly Sync"
              className="h-11 rounded-xl border-border/70 focus-visible:ring-primary/20"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="font-semibold text-foreground/80">Description <span className="font-normal text-muted-foreground">(Optional)</span></Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this rhythm for?"
              className="resize-none rounded-xl border-border/70 focus-visible:ring-primary/20 min-h-[60px]"
            />
          </div>

          {/* Tasks */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-semibold text-foreground/80">Tasks</Label>
              <p className="text-xs text-muted-foreground">Set the task and which day(s) it runs</p>
            </div>

            <div className="space-y-2">
              {tasks.map((task, index) => (
                <div key={task.id} className="flex items-center gap-2 bg-slate-50/80 rounded-xl border border-border/40 p-2.5">
                  <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  <Input
                    value={task.title}
                    onChange={e => updateTask(task.id, 'title', e.target.value)}
                    placeholder={`Task ${index + 1} title...`}
                    className="h-9 rounded-lg border-border/50 text-sm flex-1 bg-white"
                  />
                  <div className="flex flex-col gap-1.5 shrink-0">
                    {/* Day picker */}
                    <div className="flex gap-0.5">
                      {DAY_LABELS.map((day, dayIdx) => (
                        <button
                          key={dayIdx}
                          type="button"
                          onClick={() => updateTask(task.id, 'days', dayIdx)}
                          className={cn(
                            'w-7 h-7 rounded-lg text-[10px] font-bold transition-all',
                            task.days.includes(dayIdx)
                              ? 'bg-primary text-white shadow-sm'
                              : 'bg-white border border-border/50 text-muted-foreground hover:border-primary/40 hover:text-primary'
                          )}
                        >
                          {day[0]}
                        </button>
                      ))}
                    </div>
                    {/* Shortcuts */}
                    <div className="flex justify-between px-1">
                      <button 
                        type="button" 
                        onClick={() => setAllDays(task.id, 'all')}
                        className="text-[9px] font-bold text-primary/60 hover:text-primary"
                      >
                        Everyday
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setAllDays(task.id, 'weekdays')}
                        className="text-[9px] font-bold text-muted-foreground hover:text-primary"
                      >
                        Weekdays
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTask(task.id)}
                    disabled={tasks.length === 1}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-30 shrink-0 self-start mt-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addTask}
              className="w-full rounded-xl border border-dashed border-border/60 h-9 text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 mt-1"
            >
              <Plus className="w-3.5 h-3.5 mr-2" />
              Add another task
            </Button>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border/30 bg-slate-50/50 gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isPending}
            className="rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="rounded-xl shadow-sm px-6"
          >
            {isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
            ) : (
              initialData ? 'Update Rhythm' : 'Create Rhythm'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
