'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { deleteProject, updateProject } from '@/app/actions/projects'

export function ProjectSettingsDialog({
  project,
  canDelete,
}: {
  project: { id: string; name: string; description: string | null }
  canDelete: boolean
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function save() {
    startTransition(async () => {
      const res = await updateProject(project.id, { name, description })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Project updated')
      setOpen(false)
      router.refresh()
    })
  }

  function remove() {
    if (!window.confirm(`Delete "${project.name}" and all of its tasks? This cannot be undone.`)) return
    startTransition(async () => {
      const res = await deleteProject(project.id)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success('Project deleted')
      router.push('/dashboard/projects')
    })
  }

  return (
    <>
      <Button variant="outline" size="sm" className="rounded-full h-9 bg-white" onClick={() => setOpen(true)}>
        <Settings2 className="mr-1.5 h-4 w-4" />
        Edit project
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Project settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Project name" disabled={pending} />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-label="Project description"
              placeholder="What is this project for?"
              disabled={pending}
            />
          </div>
          <DialogFooter className="flex items-center justify-between gap-2">
            {canDelete ? (
              <Button variant="destructive" onClick={remove} disabled={pending}>
                Delete project
              </Button>
            ) : (
              <span />
            )}
            <Button onClick={save} disabled={pending || !name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
