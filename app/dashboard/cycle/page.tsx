import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveWorkspaceId } from '@/lib/workspace/active-workspace'
import { canEditWorkspace } from '@/app/actions/roles'
import { dateKeyInTimeZone } from '@/lib/tasks/my-day'
import { currentCycle, cycleDaysLeft, cycleProgress, type CycleRow } from '@/lib/cycles/cycle'
import { StartCycleForm } from '@/components/cycles/start-cycle-form'

type CycleTask = { id: string; title: string; status: string; project_id: string; carry_over_count: number }

const GROUPS: { title: string; match: (s: string) => boolean }[] = [
  { title: 'Not started', match: (s) => s === 'backlog' || s === 'today' },
  { title: 'In progress', match: (s) => s === 'doing' || s === 'review' || s === 'blocked' },
  { title: 'Done', match: (s) => s === 'done' },
]

export default async function CyclePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const workspaceId = await resolveActiveWorkspaceId()
  if (!workspaceId) return <p className="text-muted-foreground">Create or join a workspace first.</p>

  const { data: profile } = await supabase.from('profiles').select('timezone').eq('id', user.id).single()
  const todayKey = dateKeyInTimeZone(new Date(), profile?.timezone)

  const [{ data: cyclesRaw }, canEdit] = await Promise.all([
    supabase
      .from('cycles')
      .select('id, name, starts_on, ends_on, completed_at, completed_count, carried_over_count')
      .eq('workspace_id', workspaceId)
      .order('starts_on', { ascending: false })
      .limit(12),
    canEditWorkspace(workspaceId),
  ])
  const cycles = (cyclesRaw ?? []) as CycleRow[]
  const current = currentCycle(cycles, todayKey)
  const past = cycles.filter((c) => c.completed_at)

  const { data: tasksRaw } = current
    ? await supabase.from('tasks').select('id, title, status, project_id, carry_over_count').eq('cycle_id', current.id)
    : { data: [] }
  const tasks = (tasksRaw ?? []) as CycleTask[]
  const progress = cycleProgress(tasks)

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-12">
      <h1 className="text-3xl font-bold tracking-tight">Cycle</h1>

      {!current ? (
        <section className="space-y-4 rounded-2xl border border-border/60 bg-white p-6">
          <p className="font-medium">No cycle is running.</p>
          <p className="text-sm text-muted-foreground">
            A cycle is what the team commits to for the next week or two. Unfinished work rolls into the next cycle automatically.
          </p>
          {canEdit && <StartCycleForm />}
        </section>
      ) : (
        <section className="space-y-6">
          <div className="rounded-2xl border border-border/60 bg-white p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold">{current.name}</h2>
              <p className="text-sm text-muted-foreground">
                {current.starts_on} → {current.ends_on} · {cycleDaysLeft(current, todayKey)} days left
              </p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100" aria-label={`${progress.percent}% done`}>
              <div className="h-full bg-primary" style={{ width: `${progress.percent}%` }} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {progress.done}/{progress.total} done · {progress.inProgress} in progress · {progress.carriedOver} carried over
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add tasks from the task drawer (Cycle field). Quick add on Home joins this cycle. Rollover runs hourly after the end date (UTC).
            </p>
          </div>

          {GROUPS.map((group) => {
            const items = tasks.filter((t) => group.match(t.status))
            return (
              <div key={group.title}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title} ({items.length})
                </h3>
                <ul className="space-y-2">
                  {items.map((t) => (
                    <li key={t.id}>
                      <Link
                        href={`/dashboard/projects/${t.project_id}`}
                        className="flex items-center gap-3 rounded-xl border border-border/60 bg-white px-4 py-3 hover:bg-slate-50"
                      >
                        <span className="flex-1 truncate">{t.title}</span>
                        {t.carry_over_count > 0 && (
                          <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">
                            carried ×{t.carry_over_count}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Past cycles</h3>
          <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-white">
            {past.map((c) => (
              <li key={c.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">
                  {c.completed_count ?? 0} done · {c.carried_over_count ?? 0} carried over
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
