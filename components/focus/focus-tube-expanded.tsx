'use client'

import { useState } from 'react'
import { Minimize2, AlertTriangle, ExternalLink, Maximize, ShieldAlert, CheckCircle2, Bell, BellOff, Pause, Play, Timer, TimerOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SoundToggle } from './sound-toggle'
import Link from 'next/link'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface FocusTubeExpandedProps {
  sessionId: string
  taskTitle: string
  projectName: string | null
  formattedTime: string
  progressPercent: number
  isComplete: boolean
  distractionCount: number
  soundEnabled: boolean
  toggleSound: () => void
  tickEnabled?: boolean
  toggleTick?: () => void
  notificationsEnabled?: boolean
  toggleNotifications?: () => void
  isNotifSupported?: boolean
  onCollapse: () => void
  onAddDistraction: () => void
  onCancel: () => void
  onEndEarly: () => void
  onComplete: (note: string) => void
  isPopoutSupported?: boolean
  onPopout?: () => void
  isPoppedOut?: boolean
  remainingMinutes: number // New prop for blinking text
  isPaused?: boolean
  onTogglePause?: () => void
}

export function FocusTubeExpanded({
  sessionId,
  taskTitle,
  projectName,
  formattedTime,
  progressPercent,
  isComplete,
  distractionCount,
  soundEnabled,
  toggleSound,
  tickEnabled = false,
  toggleTick,
  notificationsEnabled = false,
  toggleNotifications,
  isNotifSupported = false,
  onCollapse,
  onAddDistraction,
  onCancel,
  onEndEarly,
  onComplete,
  isPopoutSupported = false,
  onPopout,
  isPoppedOut = false,
  remainingMinutes, // New prop
  isPaused = false,
  onTogglePause
}: FocusTubeExpandedProps) {
  const [note, setNote] = useState('')

  const isWarning = remainingMinutes <= 5 && remainingMinutes > 0 && !isComplete;

  return (
    <div className="bg-white/95 backdrop-blur-xl border border-slate-200/60 shadow-2xl rounded-2xl w-72 max-w-[calc(100vw-32px)] overflow-hidden flex flex-col pointer-events-auto ring-1 ring-black/5">
      <style jsx>{`
        @keyframes blink-red {
          0% { color: #ef4444; }
          50% { color: #fef2f2; }
          100% { color: #ef4444; }
        }
        .blink-red {
          animation: blink-red 1s step-end infinite;
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100">
        <div className="flex items-center gap-0.5">
          {!isComplete && onTogglePause && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onTogglePause}
              className={cn("rounded-full w-7 h-7 p-0 hover:bg-slate-100/50", isPaused ? 'text-amber-600' : 'text-slate-500')}
              aria-label={isPaused ? "Resume" : "Pause"}
              title={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            </Button>
          )}
          <SoundToggle soundEnabled={soundEnabled} toggleSound={toggleSound} />
          {toggleTick && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTick}
              disabled={!soundEnabled}
              className={cn("rounded-full w-7 h-7 p-0 hover:bg-slate-100/50", tickEnabled && soundEnabled ? 'text-emerald-600' : 'text-slate-400')}
              aria-label={tickEnabled ? "Turn ticking off" : "Turn ticking on"}
              title={tickEnabled ? "Ticking on" : "Ticking off"}
            >
              {tickEnabled ? <Timer className="w-3.5 h-3.5" /> : <TimerOff className="w-3.5 h-3.5" />}
            </Button>
          )}
          {isNotifSupported && toggleNotifications && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleNotifications}
              className={cn("rounded-full w-7 h-7 p-0 hover:bg-slate-100/50", notificationsEnabled ? 'text-blue-600' : 'text-slate-400')}
              aria-label={notificationsEnabled ? "Disable notifications" : "Enable notifications"}
              title={notificationsEnabled ? "Disable notifications" : "Enable notifications"}
            >
              {notificationsEnabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
            </Button>
          )}
        </div>

        <div className="flex items-center">
          {isPopoutSupported && !isPoppedOut && (
            <Button variant="ghost" size="icon" onClick={onPopout} className="w-7 h-7 p-0 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100" aria-label="Pop out" title="Pop out">
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="w-7 h-7 p-0 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100" aria-label="Full screen" title="Full screen" render={<Link href={`/focus/${sessionId}`} />}>
            <Maximize className="w-3.5 h-3.5" />
          </Button>

          <Button variant="ghost" size="sm" onClick={onCollapse} className="w-7 h-7 p-0 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100">
            <Minimize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col items-center relative">
        <div className="text-center mb-3 w-full">
          {projectName && <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5 truncate">{projectName}</div>}
          <h3 className="text-sm font-semibold text-slate-900 truncate">{taskTitle}</h3>
        </div>

        {/* Tube Timer */}
        <div className="relative w-32 h-32 mb-3 rounded-full flex items-center justify-center shadow-inner bg-slate-50">
           <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
              <circle
                cx="50" cy="50" r="45"
                stroke="currentColor"
                strokeWidth="2" fill="none"
                className="text-slate-200"
              />
              <circle
                cx="50" cy="50" r="45"
                stroke="currentColor"
                strokeWidth="4" fill="none"
                className={cn(`transition-all duration-1000 ease-linear ${isComplete ? 'text-emerald-500' : 'text-indigo-500'}`, isWarning && 'text-red-500', isPaused && 'text-amber-400')}
                strokeDasharray="282.74"
                strokeDashoffset={282.74 - (282.74 * progressPercent) / 100}
                strokeLinecap="round"
              />
           </svg>
           <div className={cn(
             "text-3xl font-bold font-mono tabular-nums tracking-tight",
             isComplete ? 'text-emerald-600' : 'text-slate-800',
             isWarning && 'blink-red text-red-600',
             isPaused && !isComplete && 'text-amber-500'
           )}>
             {isComplete ? '00:00' : formattedTime}
           </div>
           {isPaused && !isComplete && (
             <div className="absolute bottom-5 text-[9px] font-bold uppercase tracking-widest text-amber-500">Paused</div>
           )}
        </div>

        {/* Complete State */}
        {isComplete ? (
          <div className="w-full space-y-1 animate-in fade-in slide-in-from-bottom-2">
            <Textarea
              placeholder="What did you get done?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="resize-none h-16 text-sm bg-slate-50"
            />
            <Button onClick={() => onComplete(note)} className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm font-bold h-9 text-sm">
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Log Session
            </Button>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between gap-2">
            <Button variant="outline" size="sm" onClick={onAddDistraction} className="rounded-xl flex-1 border-slate-200 text-slate-600 hover:text-amber-600 hover:bg-amber-50 group h-9 text-xs">
              <ShieldAlert className="w-3.5 h-3.5 mr-1 group-hover:text-amber-500" />
              {distractionCount > 0 ? `${distractionCount} Distractions` : '+ Distraction'}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="rounded-xl px-2.5 border-slate-200 text-slate-400 hover:text-slate-900 h-9" />}>
                <AlertTriangle className="w-3.5 h-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36 rounded-lg text-sm">
                <DropdownMenuItem onClick={onEndEarly} className="font-medium py-1">
                  End Early
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCancel} className="text-red-600 focus:text-red-700 font-medium py-1">
                  Cancel Session
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  )
}