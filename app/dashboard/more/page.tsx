import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { moreNavItems } from '@/lib/navigation'

export default function MorePage() {
  return (
    <div className="space-y-4 pb-12">
      <h1 className="text-2xl font-bold tracking-tight">More</h1>
      <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-white">
        {moreNavItems().map((item) => {
          const Icon = item.icon
          return (
            <li key={item.href}>
              <Link href={item.href} className="flex items-center gap-3 px-4 py-4 text-sm font-medium hover:bg-slate-50">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
