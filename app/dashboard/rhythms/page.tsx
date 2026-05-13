import { createClient } from '@/lib/supabase/server'
import { getRhythms, getWeeklyRhythmLogs } from '@/app/actions/rhythm'
import { WeeklyPlannerGrid } from '@/components/dashboard/weekly-planner-grid'
import { RhythmSettingsDialog } from '@/components/dashboard/rhythm-settings-dialog'
import { AiSuggestionsPanel } from '@/components/dashboard/ai-suggestions-panel'
import { Plus, Repeat2, Sparkles } from 'lucide-react'
import { startOfWeek, endOfWeek, format } from 'date-fns'

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

      {/* Grid */}
      <WeeklyPlannerGrid
        rhythms={rhythms}
        logs={logs}
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
