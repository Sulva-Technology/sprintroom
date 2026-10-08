'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { markAllNotificationsRead, markNotificationRead } from '@/app/actions/notifications'

export type InboxItem = { id: string; text: string; href: string; unread: boolean; createdAt: string }

export function InboxList({ items }: { items: InboxItem[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const unread = items.filter((i) => i.unread).length

  function open(item: InboxItem) {
    startTransition(async () => {
      if (item.unread) await markNotificationRead(item.id)
      router.push(item.href)
    })
  }

  function readAll() {
    startTransition(async () => {
      const res = await markAllNotificationsRead()
      if (!res.success) toast.error(res.error)
      else router.refresh()
    })
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing here yet. Assignments, comments and blockers on your tasks will show up here.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <Button variant="outline" size="sm" disabled={pending} onClick={readAll}>
          Mark all {unread} as read
        </Button>
      )}
      <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-white">
        {items.map((item) => (
          <li key={item.id}>
            <button
              onClick={() => open(item)}
              disabled={pending}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
            >
              <span className={item.unread ? 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary' : 'mt-1.5 h-2 w-2 shrink-0'} />
              <span className="flex-1">
                <span className={item.unread ? 'block text-sm font-semibold' : 'block text-sm'}>{item.text}</span>
                <span className="block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
