'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { startCycle } from '@/app/actions/cycles'

export function StartCycleForm() {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function start(weeks: 1 | 2) {
    startTransition(async () => {
      const res = await startCycle(weeks)
      if (!res.success) {
        toast.error(res.error)
        return
      }
      toast.success(`${weeks}-week cycle started`)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button disabled={pending} onClick={() => start(1)} className="rounded-xl">Start a 1-week cycle</Button>
      <Button disabled={pending} variant="outline" onClick={() => start(2)} className="rounded-xl">Start a 2-week cycle</Button>
    </div>
  )
}
