'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveActiveWorkspaceId } from '@/lib/workspace/active-workspace'
import { toIlikePattern } from '@/lib/search/ilike'

export type SearchResults = {
  tasks: { id: string; title: string; project_id: string }[]
  projects: { id: string; name: string }[]
}

const EMPTY: SearchResults = { tasks: [], projects: [] }

/** Search tasks and projects in the ACTIVE workspace only. */
export async function searchWorkspace(term: string): Promise<SearchResults> {
  const query = term.trim().slice(0, 100)
  if (query.length < 2) return EMPTY

  const workspaceId = await resolveActiveWorkspaceId()
  if (!workspaceId) return EMPTY

  const supabase = await createClient()
  const pattern = toIlikePattern(query)

  const [tasks, projects] = await Promise.all([
    supabase.from('tasks').select('id, title, project_id').eq('workspace_id', workspaceId).ilike('title', pattern).limit(5),
    supabase.from('projects').select('id, name').eq('workspace_id', workspaceId).ilike('name', pattern).limit(5),
  ])

  return { tasks: tasks.data ?? [], projects: projects.data ?? [] }
}
