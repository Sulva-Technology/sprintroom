'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { Search, FolderKanban, CheckSquare, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [results, setResults] = React.useState<{ tasks: any[], projects: any[] }>({ tasks: [], projects: [] })
  const [loading, setLoading] = React.useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Toggle the menu when ⌘K is pressed
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Debounced search effect
  React.useEffect(() => {
    if (!search) {
      setResults({ tasks: [], projects: [] })
      return
    }

    const timer = setTimeout(async () => {
      setLoading(true)
      
      const [tasksResult, projectsResult] = await Promise.all([
        supabase.from('tasks').select('id, title, project_id').ilike('title', `%${search}%`).limit(5),
        supabase.from('projects').select('id, name').ilike('name', `%${search}%`).limit(5)
      ])

      setResults({
        tasks: tasksResult.data || [],
        projects: projectsResult.data || []
      })
      setLoading(false)
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [search, supabase])

  const handleSelect = (url: string) => {
    setOpen(false)
    setSearch('')
    router.push(url)
  }

  return (
    <>
      <div 
        className="relative w-full max-w-md hidden sm:block group cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-hover:text-primary transition-colors" />
        <div className="w-full pl-10 pr-12 h-10 bg-white/60 border border-border/60 hover:bg-white transition-all rounded-xl text-sm shadow-sm flex items-center text-muted-foreground">
          Search tasks, projects...
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-50 pointer-events-none">
           <span className="text-xs font-semibold border rounded px-1 bg-muted">⌘K</span>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4 animate-in fade-in duration-200">
          <Command 
            className="w-full max-w-xl bg-white rounded-xl shadow-2xl border overflow-hidden flex flex-col"
            shouldFilter={false} // We do manual filtering via Supabase
          >
            <div className="flex items-center px-4 border-b">
              <Search className="w-5 h-5 text-slate-400 mr-2 shrink-0" />
              <Command.Input 
                autoFocus 
                value={search}
                onValueChange={setSearch}
                placeholder="Type to search..."
                className="flex-1 h-14 bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
              />
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <Command.List className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
              {loading && <div className="p-4 text-center text-sm text-slate-500">Searching...</div>}
              
              {!loading && search && results.tasks.length === 0 && results.projects.length === 0 && (
                <Command.Empty className="p-4 text-center text-sm text-slate-500">No results found.</Command.Empty>
              )}

              {results.projects.length > 0 && (
                <Command.Group heading="Projects" className="text-xs font-medium text-slate-500 p-2">
                  {results.projects.map(proj => (
                    <Command.Item 
                      key={`proj-${proj.id}`}
                      onSelect={() => handleSelect(`/dashboard/projects/${proj.id}`)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 rounded-md hover:bg-slate-100 cursor-pointer aria-selected:bg-slate-100 aria-selected:text-primary"
                    >
                      <FolderKanban className="w-4 h-4 text-slate-400" />
                      {proj.name}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {results.tasks.length > 0 && (
                <Command.Group heading="Tasks" className="text-xs font-medium text-slate-500 p-2 mt-2">
                  {results.tasks.map(task => (
                    <Command.Item 
                      key={`task-${task.id}`}
                      onSelect={() => handleSelect(`/dashboard/projects/${task.project_id}`)}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 rounded-md hover:bg-slate-100 cursor-pointer aria-selected:bg-slate-100 aria-selected:text-primary"
                    >
                      <CheckSquare className="w-4 h-4 text-slate-400" />
                      {task.title}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
          </Command>
        </div>
      )}
    </>
  )
}
