'use client'

import { Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SoundToggleProps {
  soundEnabled: boolean
  toggleSound: () => void
}

export function SoundToggle({ soundEnabled, toggleSound }: SoundToggleProps) {
  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={toggleSound}
      className={`rounded-full w-7 h-7 p-0 hover:bg-slate-100/50 ${soundEnabled ? 'text-emerald-600' : 'text-slate-400'}`}
      aria-label={soundEnabled ? "Disable sound" : "Enable sound"}
      title={soundEnabled ? "Disable sound" : "Enable sound"}
    >
      {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
    </Button>
  )
}
