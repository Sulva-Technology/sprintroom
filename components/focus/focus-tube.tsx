'use client'

import { useState, useEffect, useRef } from 'react'
import { FocusTubePill } from './focus-tube-pill'
import { FocusTubeExpanded } from './focus-tube-expanded'
import { FocusPopoutWindow } from './focus-popout-window'
import { useFocusTimer } from '@/hooks/use-focus-timer'
import { useFocusSound } from '@/hooks/use-focus-sound'
import { useFocusNotifications } from '@/hooks/use-focus-notifications'
import { useDocumentPictureInPicture } from '@/hooks/use-document-picture-in-picture'
import { incrementDistraction, cancelFocusSession, completeFocusSession } from '@/app/actions/focus'
import { addToSyncQueue } from '@/lib/offline/sync-queue'
import { ExternalLink } from 'lucide-react'

interface FocusTubeProps {
  initialSession: any
}

export function FocusTube({ initialSession }: FocusTubeProps) {
  const [session, setSession] = useState<any>(initialSession)
  const [expanded, setExpanded] = useState(false)
  const [distractions, setDistractions] = useState<number>(initialSession?.distractions_count || 0)

  const { soundEnabled, toggleSound, playSound, stopSound } = useFocusSound()
  const { notificationsEnabled, toggleNotifications, showNotification, isSupported: isNotifSupported } = useFocusNotifications()
  const { isSupported: isPopoutSupported, isOpen: isPoppedOut, openPopout, closePopout, popoutWindow } = useDocumentPictureInPicture()

  const {
    remainingSeconds,
    progressPercent,
    isComplete,
    formattedTime,
    hasOneMinuteWarningPassed
  } = useFocusTimer({
    startedAt: session?.started_at,
    durationMinutes: session?.duration_minutes || 25,
    status: session?.status || 'cancelled'
  })

  const remainingMinutes = Math.ceil(remainingSeconds / 60); // Calculate remaining minutes

  // Sound triggers
  const hasPlayedComplete = useRef(false)
  const hasPlayedWarning = useRef(false)

  useEffect(() => {
    if (!session) return

    if (isComplete && !hasPlayedComplete.current) {
      playSound('focus-complete')
      showNotification('Focus block finished', session.task_title || 'Ready to log your progress.')
      hasPlayedComplete.current = true

      // Auto-expand when complete to prompt note
      if (!expanded && !isPoppedOut) {
        setTimeout(() => setExpanded(true), 0)
      }
    }

    if (hasOneMinuteWarningPassed && !hasPlayedWarning.current) {
      playSound('warning')
      showNotification('One minute left', `Almost done with: ${session.task_title || 'your task'}`)
      hasPlayedWarning.current = true
    }
  }, [isComplete, hasOneMinuteWarningPassed, playSound, showNotification, expanded, isPoppedOut, session])

  // Tick sound effect
  useEffect(() => {
    if (!session || session.status !== 'active' || isComplete) {
      stopSound('tick');
      return;
    }

    const tickInterval = setInterval(() => {
      playSound('tick');
    }, 1000);

    return () => clearInterval(tickInterval);
  }, [session, isComplete, playSound, stopSound]);

  // Sound triggers

  const handleAddDistraction = async () => {
    setDistractions(prev => prev + 1)
    if (!navigator.onLine) {
      const payload = { action: 'increment' }
      await addToSyncQueue('increment_distraction', 'focus_session', session.id, payload, session.workspace_id, session.project_id)
      return
    }
    await incrementDistraction(session.id)
  }

  const handleCancel = async () => {
    if (isPoppedOut) closePopout()

    if (!navigator.onLine) {
       const payload = { action: 'cancel' }
       await addToSyncQueue('cancel_focus_session', 'focus_session', session.id, payload, session.workspace_id, session.project_id)
       setSession(null)
       return
    }

    await cancelFocusSession(session.id)
    setSession(null)
  }

  const handleEndEarly = () => {
    hasPlayedComplete.current = true
    playSound('focus-complete')
    setSession({ ...session, status: 'completed' })
  }

  const handleComplete = async (note: string) => {
    if (isPoppedOut) closePopout()
    const isMeaningful = true

    if (!navigator.onLine) {
      const payload = { note, meaningful: isMeaningful, distractions }
      await addToSyncQueue('complete_focus_session', 'focus_session', session.id, payload, session.workspace_id, session.project_id)
      setSession(null)
      return
    }

    await completeFocusSession(session.id, note, isMeaningful, distractions)
    setSession(null)
  }

  if (!session) return null

  const popoutUiProps = {
    sessionId: session.id,
    taskTitle: session.task_title,
    projectName: session.project_name,
    formattedTime,
    progressPercent,
    isComplete: isComplete || session.status === 'completed',
    distractionCount: distractions,
    soundEnabled,
    toggleSound,
    notificationsEnabled,
    toggleNotifications,
    isNotifSupported,
    onCollapse: () => isPoppedOut ? closePopout() : setExpanded(false),
    onAddDistraction: handleAddDistraction,
    onCancel: handleCancel,
    onEndEarly: handleEndEarly,
    onComplete: handleComplete,
    isPopoutSupported,
    onPopout: openPopout,
    isPoppedOut,
    remainingMinutes // Pass remainingMinutes
  }

  return (
    <>
      <div className="fixed z-50 bottom-4 right-4 sm:bottom-6 sm:right-6 pointer-events-none flex flex-col items-end w-full max-w-[calc(100vw-32px)] sm:max-w-md">
        {isPoppedOut ? (
          <div className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full shadow-lg backdrop-blur-md border bg-indigo-50/90 border-indigo-200/60 text-indigo-700">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="text-xs font-semibold">Popped out</span>
          </div>
        ) : !expanded ? (
          <div className="pointer-events-auto">
            <FocusTubePill
              taskTitle={session.task_title}
              formattedTime={formattedTime}
              progressPercent={progressPercent}
              isComplete={isComplete || session.status === 'completed'}
              onExpand={() => setExpanded(true)}
            />
          </div>
        ) : (
          <div className="pointer-events-auto w-full flex justify-end">
            <FocusTubeExpanded {...popoutUiProps} />
          </div>
        )}
      </div>

      {isPoppedOut && popoutWindow && (
        <FocusPopoutWindow pipWindow={popoutWindow}>
          <div className="flex-1 flex items-center justify-center h-full w-full bg-slate-50/50">
            <FocusTubePill
              taskTitle={session.task_title}
              formattedTime={formattedTime}
              progressPercent={progressPercent}
              isComplete={isComplete || session.status === 'completed'}
              onExpand={() => closePopout()}
            />
          </div>
        </FocusPopoutWindow>
      )}
    </>
  )
}