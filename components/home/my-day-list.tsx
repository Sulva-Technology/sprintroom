import Link from 'next/link'
import type { MyDayTask } from '@/lib/tasks/my-day'

const PRIORITY_STYLE: Record<string, string> = {
  urgent: 'bg-red-50 text-red-700 border-red-100',
  high: 'bg-amber-50 text-amber-700 border-amber-100',
  medium: 'bg-slate-100 text-slate-700 border-slate-200',
  low: 'bg-slate-50 text-slate-500 border-slate-100',
}

export function MyDayList({
  title,
  tasks,
  empty,
  tone = 'default',
}: {
  title: string
  tasks: MyDayTask[]
  empty: string
  tone?: 'default' | 'warning'
}) {
  return (
    <section>
      <h2
        className={
          tone === 'warning'
            ? 'mb-3 text-sm font-semibold uppercase tracking-wider text-amber-700'
            : 'mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground'
        }
      >
        {title} <span className="font-normal">({tasks.length})</span>
      </h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id}>
              <Link
                href={`/dashboard/projects/${t.project_id}`}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-white px-4 py-3 hover:bg-slate-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {t.project_name ?? 'Project'} · {t.status}
                    {t.deadline ? ` · due ${t.deadline.slice(0, 10)}` : ''}
                  </span>
                </span>
                {t.priority && (
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase ${PRIORITY_STYLE[t.priority] ?? PRIORITY_STYLE.medium}`}
                  >
                    {t.priority}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
