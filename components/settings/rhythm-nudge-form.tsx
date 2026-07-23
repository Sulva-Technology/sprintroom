'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { BellRing, BellOff, Loader2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { setRhythmNudgesEnabled } from '@/app/actions/profile'

/**
 * Enables the hourly 06:00–18:00 rhythm nudge and registers this device for
 * web push, which is what makes the reminder arrive with the app closed.
 */
export function RhythmNudgeForm({ enabled }: { enabled: boolean }) {
  const { isSupported, isSubscribed, permission, subscribeToPush } = usePushNotifications()
  const [isEnabled, setIsEnabled] = useState(enabled)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [isPending, startTransition] = useTransition()

  const toggle = () => {
    const next = !isEnabled
    setIsEnabled(next)
    startTransition(async () => {
      const result = await setRhythmNudgesEnabled(next)
      if (result?.error) {
        setIsEnabled(!next)
        toast.error('Could not save your preference', { description: result.error })
      }
    })
  }

  const handleSubscribe = async () => {
    setIsSubscribing(true)
    try {
      const ok = await subscribeToPush()
      if (ok) {
        toast.success('This device will receive rhythm reminders.')
      } else {
        toast.error('Could not enable push on this device', {
          description:
            permission === 'denied'
              ? 'Notifications are blocked for this site in your browser settings.'
              : 'Push is unavailable or not configured on this deployment.',
        })
      }
    } finally {
      setIsSubscribing(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">Hourly rhythm reminders</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            Every hour from 6:00am to 6:00pm we&apos;ll remind you about today&apos;s rhythm
            tasks until they are all cleared.
          </p>
        </div>
        <Button
          type="button"
          variant={isEnabled ? 'default' : 'outline'}
          size="sm"
          className="rounded-xl shrink-0"
          onClick={toggle}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : isEnabled ? (
            <BellRing className="w-4 h-4 mr-2" />
          ) : (
            <BellOff className="w-4 h-4 mr-2" />
          )}
          {isEnabled ? 'On' : 'Off'}
        </Button>
      </div>

      {isEnabled && isSupported && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-3">
          <p className="text-sm text-muted-foreground">
            {isSubscribed
              ? 'This device is registered for reminders, including when the app is closed.'
              : 'Register this device so reminders arrive even when SprintRoom is closed.'}
          </p>
          {isSubscribed ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="rounded-xl shrink-0"
              onClick={handleSubscribe}
              disabled={isSubscribing}
            >
              {isSubscribing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enable on this device
            </Button>
          )}
        </div>
      )}

      {isEnabled && !isSupported && (
        <p className="text-sm text-muted-foreground">
          This browser doesn&apos;t support push notifications, so reminders will only
          appear while SprintRoom is open.
        </p>
      )}
    </div>
  )
}
