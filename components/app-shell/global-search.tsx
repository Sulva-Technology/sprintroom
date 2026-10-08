'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { toast } from 'sonner'
import { Search, FolderKanban, CheckSquare, X, Zap, Timer, ArrowRight } from 'lucide-react'
import { searchWorkspace } from '@/app/actions/search'
import { quickAddTask } from '@/app/actions/tasks'
import { createInstantFocusSession } from '@/app/actions/focus'
import { buildCommandActions, type CommandAction } from '@/lib/command-actions'
import { globalShortcutFor, isTypingTarget } from '@/lib/shortcuts'

const ITEM_CLASS =
  'flex items-center gap-2 px-3 py-2 text-sm text-slate-700 rounded-md hover:bg-slate-100 cursor-pointer aria-selected:bg-slate-100 aria-selected:text-primary'

export function GlobalSearch({ canEdit = false }: { canEdit?: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [createOnly, setCreateOnly] = React.useState(false)
  const [search, setSearch] = React.useState('')
  const [results, setResults] = React.useState<{ tasks: any[], projects: any[] }>({ tasks: [], projects: [] })
  const [loading, setLoading] = React.useState(false)
  const router = useRouter()

  // ⌘K toggles; "/" opens; "c" opens in create mode. Single keys never fire
  // while typing in a field.
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const shortcut = globalShortcutFor(e)
      if (!shortcut) return
      if (shortcut === 'toggle-palette') {
        e.preventDefault()
        setCreateOnly(false)
        setOpen((o) => !o)
        return
      }
      if (isTypingTarget(e.target)) return
      if (shortcut === 'create-task' && !canEdit) return
      e.preventDefault()
      setCreateOnly(shortcut === 'create-task')
      setOpen(true)
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [canEdit])

  // Debounced search effect
  React.useEffect(() => {
    if (!search) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults({ tasks: [], projects: [] })
      return
    }
    if (createOnly) return

    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        setResults(await searchWorkspace(search))
      } catch {
        // Offline or server error: show no results rather than crash the palette.
        setResults({ tasks: [], projects: [] })
      } finally {
        setLoading(false)
      }
    }, 300) // 300ms debounce

    return () => clearTimeout(timer)
  }, [search, createOnly])

  const actions = buildCommandActions(search, { canEdit, createOnly })

  const closePalette = () => {
    setOpen(false)
    setSearch('')
    setCreateOnly(false)
  }

  const handleSelect = (url: string) => {
    closePalette()
    router.push(url)
  }

  const runAction = async (action: CommandAction) => {
    if (action.kind === 'navigate') {
      handleSelect(action.href)
      return
    }
    closePalette()
    if (action.kind === 'create-task') {
      const res = await quickAddTask(action.title)
      if (!res.success) toast.error(res.error?.message ?? 'Could not add task')
      else {
        toast.success('Task added to today')
        router.refresh()
      }
      return
    }
    const res = await createInstantFocusSession()
    if (!res?.success) toast.error(res?.error?.message ?? 'Could not start a focus session')
    else router.refresh()
  }

  return (
    <>
      <div
        className="relative w-full max-w-md hidden sm:block group cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground group-hover:text-primary transition-colors" />
        <div className="w-full pl-10 pr-12 h-10 bg-white/60 border border-border/60 hover:bg-white transition-all rounded-xl text-sm shadow-sm flex items-center text-muted-foreground">
          Search or run a command…
        </div>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-50 pointer-events-none">
           <span className="text-xs font-semibold border rounded px-1 bg-muted">⌘K</span>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-[15vh] px-4 animate-in fade-in duration-200">
          <Command
            className="w-full max-w-xl bg-white rounded-xl shadow-2xl border overflow-hidden flex flex-col"
            shouldFilter={false} // Filtering is done by buildCommandActions and the search action
          >
            <div className="flex items-center px-4 border-b">
              <Search className="w-5 h-5 text-slate-400 mr-2 shrink-0" />
              <Command.Input
                autoFocus
                value={search}
                onValueChange={setSearch}
                placeholder={createOnly ? 'Task title, then Enter…' : 'Search or type a command…'}
                className="flex-1 h-14 bg-transparent outline-none text-slate-900 placeholder:text-slate-400"
              />
              <button onClick={closePalette} className="p-1 hover:bg-slate-100 rounded-md text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <Command.List className="max-h-[300px] overflow-y-auto p-2 custom-scrollbar">
              {actions.length > 0 && (
                <Command.Group heading={createOnly ? 'Create' : 'Actions'} className="text-xs font-medium text-slate-500 p-2">
                  {actions.map((action) => (
                    <Command.Item key={action.id} onSelect={() => runAction(action)} className={ITEM_CLASS}>
                      {action.kind === 'create-task' ? (
                        <Zap className="w-4 h-4 text-slate-400" />
                      ) : action.kind === 'start-focus' ? (
                        <Timer className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                      )}
                      {action.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {createOnly && !search && (
                <div className="p-4 text-center text-sm text-slate-500">Type a task title and press Enter. It goes to today.</div>
              )}

              {!createOnly && (
                <>
                  {loading && <div className="p-4 text-center text-sm text-slate-500">Searching...</div>}

                  {!loading && search && actions.length === 0 && results.tasks.length === 0 && results.projects.length === 0 && (
                    <Command.Empty className="p-4 text-center text-sm text-slate-500">No results found.</Command.Empty>
                  )}

                  {results.projects.length > 0 && (
                    <Command.Group heading="Projects" className="text-xs font-medium text-slate-500 p-2 mt-2">
                      {results.projects.map(proj => (
                        <Command.Item
                          key={`proj-${proj.id}`}
                          onSelect={() => handleSelect(`/dashboard/projects/${proj.id}`)}
                          className={ITEM_CLASS}
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
                          className={ITEM_CLASS}
                        >
                          <CheckSquare className="w-4 h-4 text-slate-400" />
                          {task.title}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  )}
                </>
              )}
            </Command.List>
          </Command>
        </div>
      )}
    </>
  )
}
