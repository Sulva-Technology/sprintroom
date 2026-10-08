import Link from 'next/link'
import { Bell } from 'lucide-react'

export function InboxBell({ count }: { count: number }) {
  return (
    <Link
      href="/dashboard/inbox"
      aria-label={count > 0 ? `Inbox, ${count} unread` : 'Inbox'}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-white hover:bg-slate-50"
    >
      <Bell className="h-4 w-4 text-slate-600" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-primary px-1 text-center text-[10px] font-bold leading-[18px] text-primary-foreground">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
