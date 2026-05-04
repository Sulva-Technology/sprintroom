'use client'

import { Maximize2, X } from 'lucide-react'

interface FocusTubePillProps {
  taskTitle: string
  formattedTime: string
  progressPercent: number
  isComplete: boolean
  onExpand: () => void
}

export function FocusTubePill({ taskTitle, formattedTime, progressPercent, isComplete, onExpand }: FocusTubePillProps) {
  return (
    <button 
      onClick={onExpand}
      className={`
        flex items-center gap-3 px-4 py-2 rounded-full shadow-lg backdrop-blur-md border 
        transition-all hover:scale-105 active:scale-95 group relative overflow-hidden
        ${isComplete 
          ? 'bg-emerald-500/90 border-emerald-400 text-white shadow-emerald-500/20' 
          : 'bg-white/90 border-slate-200/60 shadow-slate-200/50 hover:border-indigo-300'
        }
      `}
      aria-label="Expand focus timer"
    >
      {/* Background progress fill if active */}
      {!isComplete && (
        <div 
          className="absolute inset-y-0 left-0 bg-indigo-50/50 pointer-events-none transition-all duration-1000 ease-linear"
          style={{ width: `${progressPercent}%` }}
        />
      )}

      {/* Pulse dot */}
      <div className="relative z-10 flex h-2.5 w-2.5 shrink-0">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isComplete ? 'bg-white' : 'bg-indigo-400'}`}></span>
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isComplete ? 'bg-white' : 'bg-indigo-500'}`}></span>
      </div>

      <div className={`relative z-10 font-mono font-bold tracking-tight text-sm shrink-0 ${isComplete ? 'text-white' : 'text-slate-900'}`}>
        {isComplete ? 'DONE' : formattedTime}
      </div>

      <div className="relative z-10 w-px h-4 bg-current opacity-20 shrink-0" />

      <div className={`relative z-10 text-xs font-medium truncate max-w-[120px] sm:max-w-[160px] ${isComplete ? 'text-emerald-50' : 'text-slate-600'}`}>
        {taskTitle}
      </div>

      <Maximize2 className={`relative z-10 w-3.5 h-3.5 opacity-50 group-hover:opacity-100 transition-opacity shrink-0 ${isComplete ? 'text-white' : 'text-slate-400'}`} />
    </button>
  )
}
