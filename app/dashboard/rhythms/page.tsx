import { createClient } from '@/lib/supabase/server'
import { getRhythms, getWeeklyRhythmLogs } from '@/app/actions/rhythm'
import { WeeklyPlannerGrid } from '@/components/dashboard/weekly-planner-grid'
import { RhythmSettingsDialog } from '@/components/dashboard/rhythm-settings-dialog'
import { AiSuggestionsPanel } from '@/components/dashboard/ai-suggestions-panel'
import { CheckCircle2, ListChecks, Repeat2, Sun } from 'lucide-react'
import { startOfWeek, endOfWeek, format } from 'date-fns'
import { calculateWeeklyRhythmSummary } from '@/lib/weekly-rhythm'

export default async function RhythmsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Current week range
  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }) // Mon
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 }) // Sun
  const weekStartStr = format(weekStart, 'yyyy-MM-dd')
  const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

  const [rhythms, logs] = await Promise.all([
    getRhythms(),
    getWeeklyRhythmLogs(weekStartStr, weekEndStr)
  ])
  const summary = calculateWeeklyRhythmSummary({
    rhythms,
    logs,
    today: format(today, 'yyyy-MM-dd'),
  })

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Repeat2 className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Weekly Rhythms</h1>
          </div>
          <p className="text-muted-foreground font-medium text-sm ml-12">
            {format(weekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')} · Your execution blueprint
          </p>
        </div>
        <div className="flex items-center gap-3">
          <AiSuggestionsPanel />
          <RhythmSettingsDialog />
        </div>
      </div>

      {rhythms.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border/50 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Weekly Completion
            </div>
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {summary.completionRate}%
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.totalCompleted} of {summary.totalScheduled} scheduled checks done
            </p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Sun className="h-4 w-4 text-amber-600" />
              Today
            </div>
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {summary.completedToday}/{summary.dueToday}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {summary.todayCompletionRate}% of today&apos;s rhythm finished
            </p>
          </div>

          <div className="rounded-2xl border border-border/50 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <ListChecks className="h-4 w-4 text-primary" />
              Remaining This Week
            </div>
            <div className="text-3xl font-bold tracking-tight text-foreground">
              {Math.max(0, summary.totalScheduled - summary.totalCompleted)}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Scheduled rhythm checks still open this week
            </p>
          </div>
        </div>
      )}

      {/* Grid */}
      <WeeklyPlannerGrid
        rhythms={rhythms}
        logs={logs}
        progressByRhythmId={summary.byRhythmId}
        weekStart={weekStartStr}
      />

      {/* Empty state */}
      {rhythms.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-dashed border-border/60 rounded-3xl">
          <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
            <Repeat2 className="w-8 h-8 text-primary/50" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">No rhythms yet</h2>
          <p className="text-muted-foreground text-sm max-w-sm mb-6">
            Create your first Weekly Rhythm — a set of recurring tasks that repeat every week. Start with habits like &quot;Code Review&quot; or &quot;Team Sync.&quot;
          </p>
          <div className="flex items-center gap-3">
            <AiSuggestionsPanel showLabel />
            <RhythmSettingsDialog showLabel />
          </div>
        </div>
      )}
    </div>
  )
}
