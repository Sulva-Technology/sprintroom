'use client'

import { useState } from 'react'
import { Minimize2, X, AlertTriangle, ExternalLink, ShieldAlert, CheckCircle2, Bell, BellOff } from 'lucide-react'
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
  remainingMinutes // New prop
}: FocusTubeExpandedProps) {
  const [note, setNote] = useState('')

  const isWarning = remainingMinutes <= 5 && remainingMinutes > 0 && !isComplete;

  return (
    <div className="bg-white/95 backdrop-blur-xl border border-slate-200/60 shadow-2xl rounded-2xl w-[160px] overflow-hidden flex flex-col pointer-events-auto ring-1 ring-black/5">
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
      <div className="flex items-center justify-between px-1 py-1 border-b border-slate-100">
        <div className="flex items-center gap-0.5">
          <SoundToggle soundEnabled={soundEnabled} toggleSound={toggleSound} />
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
            <Button variant="ghost" size="sm" onClick={onPopout} className="h-6 px-1 text-[9px] font-medium text-slate-500 hover:text-slate-900">
              <ExternalLink className="w-2.5 h-2.5 mr-0.5" /> Pop out
            </Button>
          )}
          {!isPopoutSupported && (
            <Button variant="ghost" size="sm" className="h-6 px-1 text-[9px] font-medium text-slate-500 hover:text-slate-900" render={<Link href={`/focus/${sessionId}`} />}>
              <ExternalLink className="w-2.5 h-2.5 mr-0.5" /> Full Screen
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={onCollapse} className="w-7 h-7 p-0 rounded-full text-slate-400 hover:text-slate-900 hover:bg-slate-100">
            <Minimize2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-2 flex flex-col items-center relative">
        <div className="text-center mb-2 w-full">
          {projectName && <div className="text-[8px] font-bold uppercase tracking-widest text-slate-400 mb-0.5 truncate">{projectName}</div>}
          <h3 className="text-[10px] font-semibold text-slate-900 truncate">{taskTitle}</h3>
        </div>

        {/* Tube Timer */}
        <div className="relative w-20 h-20 mb-2 rounded-full flex items-center justify-center p-1 shadow-inner bg-slate-50">
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
                className={cn(`transition-all duration-1000 ease-linear ${isComplete ? 'text-emerald-500' : 'text-indigo-500'}`, isWarning && 'text-red-500')}
                strokeDasharray="282.74"
                strokeDashoffset={282.74 - (282.74 * progressPercent) / 100}
                strokeLinecap="round"
              />
           </svg>
           <div className={cn(
             "text-xl font-black font-mono tracking-tighter",
             isComplete ? 'text-emerald-600' : 'text-slate-800',
             isWarning && 'blink-red text-red-600'
           )}>
             {isComplete ? '00:00' : formattedTime}
           </div>
        </div>

        {/* Complete State */}
        {isComplete ? (
          <div className="w-full space-y-1 animate-in fade-in slide-in-from-bottom-2">
            <Textarea
              placeholder="What did you get done?"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="resize-none h-12 text-xs bg-slate-50"
            />
            <Button onClick={() => onComplete(note)} className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm font-bold h-7 text-xs">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Log Session
            </Button>
          </div>
        ) : (
          <div className="flex w-full items-center justify-between gap-0.5">
            <Button variant="outline" size="sm" onClick={onAddDistraction} className="rounded-xl flex-1 border-slate-200 text-slate-600 hover:text-amber-600 hover:bg-amber-50 group h-7 text-xs">
              <ShieldAlert className="w-2.5 h-2.5 mr-0.5 group-hover:text-amber-500" />
              {distractionCount > 0 ? `${distractionCount} Distractions` : '+ Distraction'}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="rounded-xl px-1 border-slate-200 text-slate-400 hover:text-slate-900 h-7" />}>
                <AlertTriangle className="w-3 h-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-28 rounded-lg text-[10px]">
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