'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Timer, Loader2 } from 'lucide-react'
import { createInstantFocusSession } from '@/app/actions/focus'
import { toast } from 'sonner'

export function StartFocusButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleStartInstantFocus = async () => {
    setIsLoading(true)
    try {
      const res = await createInstantFocusSession()
      if (res.success) {
        toast('Focus Session Started!', {
          description: 'An instant focus session has begun.',
        })
      } else {
        toast('Failed to start focus session', {
          description: res.error?.message || 'An unknown error occurred.',
        })
      }
    } catch (error: any) {
      console.error('Error starting instant focus session:', error)
      toast('Error', {
        description: error.message || 'An unexpected error occurred.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      onClick={handleStartInstantFocus}
      disabled={isLoading}
      className="rounded-full shadow-sm bg-primary text-primary-foreground h-9"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Timer className="w-4 h-4 mr-2" />
      )}
      Start Focus
    </Button>
  )
}
