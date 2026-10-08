'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { quickAddTask } from '@/app/actions/tasks'

export function QuickAddTask() {
  const [title, setTitle] = useState('')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const value = title.trim()
    if (!value) return
    if (!navigator.onLine) {
      toast.error('You are offline. Open a project board to add tasks offline.')
      return
    }
    startTransition(async () => {
      const res = await quickAddTask(value)
      if (!res.success) {
        toast.error(res.error?.message ?? 'Could not add task')
        return
      }
      setTitle('')
      toast.success('Added to today')
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task for today…"
        aria-label="New task title"
        disabled={pending}
        className="h-11 rounded-xl bg-white"
      />
      <Button type="submit" disabled={pending || !title.trim()} className="h-11 rounded-xl">
        <Plus className="mr-1 h-4 w-4" />
        Add
      </Button>
    </form>
  )
}
