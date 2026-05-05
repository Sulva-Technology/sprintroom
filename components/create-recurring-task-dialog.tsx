'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createRecurringTaskRule } from '@/app/actions/scheduling'

export function CreateRecurringTaskDialog() {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [frequency, setFrequency] = useState<'daily'|'weekly'|'monthly'>('daily')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return

    setIsLoading(true)
    
    // Calculate the first run time based on the frequency (e.g. tomorrow)
    const nextRun = new Date()
    if (frequency === 'daily') nextRun.setDate(nextRun.getDate() + 1)
    if (frequency === 'weekly') nextRun.setDate(nextRun.getDate() + 7)
    if (frequency === 'monthly') nextRun.setMonth(nextRun.getMonth() + 1)

    // Set to 9am local time
    nextRun.setHours(9, 0, 0, 0)

    await createRecurringTaskRule({
      projectId: null, // Personal task
      templateTitle: title,
      templateDescription: description,
      frequency,
      nextRunAt: nextRun.toISOString()
    })

    setIsLoading(false)
    setTitle('')
    setDescription('')
    setFrequency('daily')
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full" />}>
        <Plus className="w-3.5 h-3.5" />
        Add Rule
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle>New Recurring Task</DialogTitle>
          <DialogDescription>
            This task will be automatically created on the schedule you set.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="title">Task Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Weekly Standup Prep"
              required
              className="rounded-xl shadow-sm"
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="freq">How often?</Label>
            <Select value={frequency} onValueChange={(v: any) => setFrequency(v)} disabled={isLoading}>
              <SelectTrigger className="rounded-xl shadow-sm">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Every day</SelectItem>
                <SelectItem value="weekly">Every week</SelectItem>
                <SelectItem value="monthly">Every month</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Description (Optional)</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any notes to include in the task..."
              className="rounded-xl shadow-sm min-h-[80px]"
              disabled={isLoading}
            />
          </div>

          <div className="pt-4 flex justify-end">
            <Button type="submit" disabled={isLoading || !title.trim()} className="rounded-xl shadow-md w-full">
              {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create Rule
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
