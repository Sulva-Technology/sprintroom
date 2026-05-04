'use client'

import { useState } from 'react'
import { Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createProject } from '@/app/actions/projects'
import { z } from 'zod'

const projectSchema = z.object({
  name: z.string().min(2, 'Project name is required').max(80),
  description: z.string().max(300).optional(),
})

export function CreateProjectDialog({ trigger, defaultOpen = false }: { trigger?: React.ReactElement; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; description?: string; root?: { message: string; details: string; } }>({})

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setErrors({})

    const formData = new FormData(e.currentTarget)
    const name = formData.get('name') as string
    const description = formData.get('description') as string

    try {
      projectSchema.parse({ name, description })
      
      const res = await createProject({ name, description })
      if (res?.error) {
        setErrors({ root: res.error })
      } else {
        setOpen(false)
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {}
        const errs = (error as any).errors || (error as any).issues
        errs.forEach((err: any) => {
          if (err.path && err.path[0]) fieldErrors[err.path[0].toString()] = err.message
        })
        setErrors(fieldErrors)
      } else {
        setErrors({ root: { message: 'Something went wrong.', details: error.message || 'An unknown error occurred.' } })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(val) => { setOpen(val); if (!val) setErrors({}); }}>
      <DialogTrigger 
        render={trigger || (
          <Button className="rounded-xl shadow-sm h-10 px-4">
            <Plus className="w-4 h-4 md:mr-1.5" />
            <span className="hidden md:inline">Create Project</span>
          </Button>
        )} 
      />
      <DialogContent className="sm:max-w-[425px] rounded-2xl p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl">Create Project</DialogTitle>
          <DialogDescription>
            Give your new project a name and brief description to get started.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name" className="font-semibold text-foreground/80">Project Name</Label>
            <Input 
              id="name" 
              name="name" 
              placeholder="e.g. Q3 Financial Dashboards"
              disabled={isLoading}
              className="h-11 rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20"
            />
            {errors.name && <p className="text-[13px] text-destructive font-medium mt-1">{errors.name}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="font-semibold text-foreground/80">Description (optional)</Label>
            <Textarea 
              id="description" 
              name="description" 
              placeholder="What are we trying to execute here?"
              disabled={isLoading}
              className="resize-none rounded-xl shadow-sm border-border/80 focus-visible:ring-primary/20 min-h-[100px]"
            />
            {errors.description && <p className="text-[13px] text-destructive font-medium mt-1">{errors.description}</p>}
          </div>

          {errors.root && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
              {errors.root.message}{errors.root.details && ` (Details: ${errors.root.details})`}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isLoading} className="rounded-xl h-10 w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="rounded-xl h-10 w-full sm:w-auto shadow-sm">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
