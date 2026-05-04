'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function getActiveFocusSession() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Clean up any stale sessions (older than 3 hours since start for a normal 25m session)
  const staleThreshold = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

  const { data: staleSessions } = await supabase
    .from('focus_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .lte('started_at', staleThreshold)

  if (staleSessions && staleSessions.length > 0) {
    for (const session of staleSessions) {
      await supabase.from('focus_sessions').update({
        status: 'abandoned',
        ended_at: new Date().toISOString()
      }).eq('id', session.id)
    }
    revalidatePath('/dashboard', 'layout')
  }

  const { data: activeSession, error } = await supabase
    .from('focus_sessions')
    .select('*, tasks(*, projects(*))')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !activeSession) return null

  return {
    ...activeSession,
    // Provide some normalized fields so client can work with it safely
    task_title: (activeSession.tasks as any)?.title || 'Instant Focus',
    project_id: (activeSession.tasks as any)?.project_id || null,
    project_name: (activeSession.tasks as any)?.projects?.name || 'No Project',
    distractions_count: activeSession.distractions_count || 0
  }
}

export async function startFocusSession(taskId: string, projectId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: taskData } = await supabase
    .from('tasks')
    .select('workspace_id, project_id')
    .eq('id', taskId)
    .single()

  // Check if already active
  const { data: activeSession } = await supabase
    .from('focus_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()

  if (activeSession) return { error: 'You already have an active focus session.' }

  const { data, error } = await supabase.from('focus_sessions').insert({
    task_id: taskId,
    user_id: user.id,
    workspace_id: taskData?.workspace_id,
    project_id: taskData?.project_id || projectId,
    status: 'active',
    duration_minutes: 25
  }).select('id').single()

  if (error) return { error: error.message }

  // Record activity log
  await supabase.from('task_activity').insert({
    task_id: taskId,
    user_id: user.id,
    workspace_id: taskData?.workspace_id,
    project_id: projectId,
    type: 'focus_session_started',
    body: 'Started a focus session'
  })

  revalidatePath(`/dashboard/projects/${projectId}`)
  redirect(`/focus/${data.id}`)
}

export async function incrementDistraction(sessionId: string) {
  const supabase = await createClient()
  const { data: session } = await supabase.from('focus_sessions').select('distractions_count').eq('id', sessionId).single()

  if (session) {
    await supabase.from('focus_sessions').update({
      distractions_count: (session.distractions_count || 0) + 1
    }).eq('id', sessionId)

    // Attempt to revalidate if we can find the project
    if (session.task_id) {
      const { data: taskData } = await supabase.from('tasks').select('project_id').eq('id', session.task_id).single()
      if (taskData?.project_id) {
        revalidatePath(`/dashboard/projects/${taskData.project_id}`)
      }
    }
    revalidatePath('/dashboard', 'layout')
  }
}

export async function cancelFocusSession(sessionId: string) {
  const supabase = await createClient()
  const { data: session } = await supabase.from('focus_sessions').select('*, tasks(project_id)').eq('id', sessionId).single()

  if (!session) return { error: 'Session not found' }
  const projectId = (session.tasks as any)?.project_id

  await supabase.from('focus_sessions').update({
    status: 'cancelled',
    ended_at: new Date().toISOString()
  }).eq('id', sessionId)

  await supabase.from('task_activity').insert({
    task_id: session.task_id,
    user_id: session.user_id,
    workspace_id: session.workspace_id,
    project_id: projectId,
    type: 'focus_session_cancelled',
    body: 'Cancelled focus session'
  })

  if (projectId) revalidatePath(`/dashboard/projects/${projectId}`)
  return redirect(projectId ? `/dashboard/projects/${projectId}` : '/dashboard')
}

export async function completeFocusSession(sessionId: string, progressNote: string, isMeaningful: boolean, distractions: number) {
  const supabase = await createClient()

  const { data: session } = await supabase.from('focus_sessions').select('*, tasks(*)').eq('id', sessionId).single()
  if (!session) return { error: 'Session not found' }

  const task = session.tasks as any
  const projectId = task?.project_id || session.project_id

  await supabase.from('focus_sessions').update({
    status: 'completed',
    ended_at: new Date().toISOString(),
    progress_note: progressNote,
    is_meaningful: isMeaningful,
    distractions_count: distractions
  }).eq('id', sessionId)

  // Add pomodoro to task if it exists
  if (session.task_id && task) {
    const newPomodoros = (task.completed_pomodoros || 0) + 1
    let nextStatus = task.status
    if (task.status === 'backlog' || task.status === 'today') {
       nextStatus = 'doing'
    }

    await supabase.from('tasks').update({
      completed_pomodoros: newPomodoros,
      status: nextStatus
    }).eq('id', session.task_id)
  }

  await supabase.from('task_activity').insert({
    task_id: session.task_id,
    user_id: session.user_id,
    workspace_id: session.workspace_id,
    project_id: projectId,
    type: 'focus_session_completed',
    body: `Completed a focus session. ${progressNote ? 'Note: ' + progressNote : ''}`
  })

  if (projectId) {
    revalidatePath(`/dashboard/projects/${projectId}`)
    return redirect(`/dashboard/projects/${projectId}`)
  }
  revalidatePath('/dashboard')
  return redirect('/dashboard')
}

export async function markSessionAbandoned(sessionId: string) {
  const supabase = await createClient()

  const { data: session } = await supabase.from('focus_sessions').select('*, tasks(project_id)').eq('id', sessionId).single()

  if (session) {
    await supabase.from('focus_sessions').update({
      status: 'abandoned',
      ended_at: new Date().toISOString()
    }).eq('id', sessionId)

    const projectId = (session.tasks as any)?.project_id || session.project_id

    await supabase.from('task_activity').insert({
      task_id: session.task_id,
      user_id: session.user_id,
      workspace_id: session.workspace_id,
      project_id: projectId,
      type: 'focus_session_abandoned',
      body: 'Focus session was abandoned'
    })

    if (projectId) {
      revalidatePath(`/dashboard/projects/${projectId}`)
      return redirect(`/dashboard/projects/${projectId}`)
    }
  }
  revalidatePath('/dashboard')
  return redirect('/dashboard')
}

export async function createInstantFocusSession(durationMinutes: number = 25) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: { message: 'Not authenticated.' } };

  // Fetch a default workspace for the user to satisfy RLS
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id')
    .limit(1);

  const workspaceId = workspaces?.[0]?.id;

  if (!workspaceId) {
    return { success: false, error: { message: 'No workspace found. Please create a workspace first.' } };
  }

  // Check if already active
  const { data: activeSession } = await supabase
    .from('focus_sessions')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (activeSession) {
    return { success: false, error: { message: 'You already have an active focus session.' } };
  }

  const { data: newSession, error: insertError } = await supabase.from('focus_sessions').insert({
    user_id: user.id,
    workspace_id: workspaceId,
    status: 'active',
    duration_minutes: durationMinutes,
    // task_id and project_id can be null for instant sessions
  }).select('*').single();

  if (insertError) {
    console.error('Error creating instant focus session:', insertError);
    return { success: false, error: { message: 'Failed to create instant focus session.', details: insertError.message } };
  }

  revalidatePath('/dashboard');

  // Return the full session object needed by FocusTubeProvider
  return {
    success: true,
    data: {
      ...newSession,
      task_title: 'Instant Focus', // Default title for instant sessions
      project_id: null,
      project_name: 'No Project',
      distractions_count: 0
    }
  };
}

export async function scheduleFocusSession(startTime: string, durationMinutes: number = 25, taskId?: string, projectId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const insertData: any = {
    user_id: user.id,
    start_time: startTime,
    duration_minutes: durationMinutes,
    status: 'pending'
  }

  if (taskId) {
    const { data: taskData } = await supabase
      .from('tasks')
      .select('workspace_id, project_id')
      .eq('id', taskId)
      .single()
      
    if (taskData) {
      insertData.task_id = taskId
      insertData.workspace_id = taskData.workspace_id
      insertData.project_id = taskData.project_id || projectId
    }
  }

  const { error } = await supabase.from('focus_schedules').insert(insertData)

  if (error) {
    console.error('Error scheduling focus session:', error)
    return { success: false, error: 'Failed to schedule session' }
  }

  if (projectId) {
    revalidatePath(`/dashboard/projects/${projectId}`)
  }
  revalidatePath('/dashboard', 'layout')

  return { success: true }
}
