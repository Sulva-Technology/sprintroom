'use client'

import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ProjectCard } from './project-card'
import { CreateProjectDialog } from './create-project-dialog'
import { useOfflineProjects } from '@/lib/offline/offline-projects'

export function ProjectsList({
  projects: serverProjects,
  canEdit = false,
  shouldOpenCreateDialog = false,
}: {
  projects: any[]
  canEdit?: boolean
  shouldOpenCreateDialog?: boolean
}) {
  const [query, setQuery] = useState('')
  // Reads from IndexedDB offline and always layers pending offline creates on
  // top, so a project made without a network connection is visible right away.
  const projects = useOfflineProjects(serverProjects)

  const q = query.trim().toLowerCase()
  const filtered = q
    ? projects.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
      )
    : projects

  // The empty state lives here rather than on the server, so a project created
  // while offline replaces it immediately instead of staying hidden until sync.
  if (projects.length === 0) {
    return (
      <div className="bg-white border border-border/50 rounded-3xl p-12 shadow-sm text-center max-w-2xl mx-auto mt-12 flex flex-col items-center">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
          <Plus className="w-8 h-8 text-slate-400" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground mb-3">Create your first project.</h2>
        <p className="text-muted-foreground font-medium mb-8 max-w-md">
          Projects keep your team’s tasks, focus sessions, blockers, and progress proof in one place.
        </p>
        {canEdit && (
          <CreateProjectDialog
            defaultOpen={shouldOpenCreateDialog}
            trigger={<Button className="rounded-xl shadow-sm px-6 h-11 text-base">Create project</Button>}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects..."
          className="pl-9 bg-white shadow-sm rounded-xl h-10 w-full focus-visible:ring-primary/20"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-12 bg-white border border-border/50 rounded-3xl shadow-sm">
          No projects match “{query}”.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filtered.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  )
}
