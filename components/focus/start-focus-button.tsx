'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Timer, Loader2 } from 'lucide-react'
import { startFocusSession } from '@/app/actions/focus'

export function StartFocusButton({ 
  taskId, 
  projectId,
  className,
  variant = 'default',
  size = 'default'
}: { 
  taskId: string
  projectId: string
  className?: string
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}) {
  const [isLoading, setIsLoading] = useState(false)

  const handleStart = async () => {
    setIsLoading(true)
    const res = await startFocusSession(taskId, projectId)
    if (res?.error) {
      alert(res.error)
      setIsLoading(false)
    }
  }

  return (
    <Button 
      variant={variant}
      size={size}
      className={className}
      onClick={handleStart}
      disabled={isLoading}
    >
      {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Timer className="w-4 h-4 mr-2" />}
      {isLoading ? 'Starting...' : 'Start Focus'}
    </Button>
  )
}
