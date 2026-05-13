'use client'

import { useState, useTransition } from 'react'
import { Sparkles, Loader2, Plus, RefreshCw, Repeat2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog'
import { getTaskSuggestions } from '@/app/actions/ai-suggestions'
import { saveRhythmTemplate } from '@/app/actions/rhythm'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface Suggestion {
  title: string
  description: string
  reason: string
  is_rhythm: boolean
  estimated_pomodoros: number
}

export function AiSuggestionsPanel({ showLabel }: { showLabel?: boolean }) {
  const [open, setOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [isPending, startTransition] = useTransition()
  const [accepted, setAccepted] = useState<Set<number>>(new Set())

  function fetchSuggestions() {
    setSuggestions([])
    setAccepted(new Set())
    startTransition(async () => {
      const result = await getTaskSuggestions()
      if (result.success && result.suggestions) {
        setSuggestions(result.suggestions)
      } else {
        toast.error(result.error || 'Could not generate suggestions.')
      }
    })
  }

  function handleOpenChange(val: boolean) {
    setOpen(val)
    if (val && suggestions.length === 0) {
      fetchSuggestions()
    }
  }

  async function handleAccept(suggestion: Suggestion, index: number) {
    if (accepted.has(index)) return

    // Convert rhythm suggestion → rhythm template with task on every weekday
    if (suggestion.is_rhythm) {
      const res = await saveRhythmTemplate({
        name: suggestion.title,
        description: suggestion.description,
        tasks: [1, 2, 3, 4, 5].map(day => ({ // Mon-Fri
          title: suggestion.title,
          day_of_week: day
        }))
      })
      if (res.success) {
        toast.success(`Rhythm "${suggestion.title}" added!`)
        setAccepted(prev => new Set([...prev, index]))
      } else {
        toast.error('Failed to save rhythm.')
      }
    } else {
      // One-off task → just notify for now, could open create-task dialog
      toast.info(`"${suggestion.title}" — add this to a project from the board.`)
      setAccepted(prev => new Set([...prev, index]))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className={cn(
              'rounded-full h-9 border-primary/30 text-primary hover:bg-primary/5 shadow-sm',
              showLabel ? 'px-4' : 'px-3'
            )}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {showLabel ? 'AI Suggestions' : 'Suggest'}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[540px] rounded-3xl p-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 bg-gradient-to-br from-primary/5 via-purple-50/50 to-white border-b border-border/40">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              AI Task Suggestions
            </DialogTitle>
            <DialogDescription className="mt-1">
              Based on your work history, Gemini suggests what to focus on this week.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {isPending && (
            <div className="flex flex-col items-center py-12 gap-4 text-muted-foreground">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
              <p className="text-sm font-medium">Analysing your work history…</p>
            </div>
          )}

          {!isPending && suggestions.length === 0 && (
            <div className="flex flex-col items-center py-12 gap-3 text-muted-foreground text-center">
              <Sparkles className="w-8 h-8 text-muted-foreground/50" />
              <p className="text-sm">No suggestions generated yet.</p>
              <Button size="sm" variant="outline" onClick={fetchSuggestions} className="rounded-full mt-2">
                <RefreshCw className="w-3.5 h-3.5 mr-2" /> Try Again
              </Button>
            </div>
          )}

          {suggestions.map((s, i) => (
            <div
              key={i}
              className={cn(
                'p-4 rounded-2xl border transition-all',
                accepted.has(i)
                  ? 'bg-emerald-50/60 border-emerald-100'
                  : 'bg-white border-border/50 hover:border-primary/30 hover:shadow-sm'
              )}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-foreground">{s.title}</p>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] rounded-full px-1.5 py-0.5 font-semibold',
                        s.is_rhythm
                          ? 'border-purple-200 bg-purple-50 text-purple-700'
                          : 'border-blue-200 bg-blue-50 text-blue-700'
                      )}
                    >
                      {s.is_rhythm ? (
                        <><Repeat2 className="w-2.5 h-2.5 mr-1 inline" /> Rhythm</>
                      ) : (
                        <><Plus className="w-2.5 h-2.5 mr-1 inline" /> Task</>
                      )}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.description}</p>
                </div>

                {accepted.has(i) ? (
                  <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="shrink-0 rounded-xl h-8 text-xs hover:bg-primary/10 hover:text-primary font-semibold px-3"
                    onClick={() => handleAccept(s, i)}
                  >
                    Add
                  </Button>
                )}
              </div>
              <div className="bg-amber-50/80 border border-amber-100/80 rounded-xl px-3 py-2">
                <p className="text-[11px] text-amber-800/80 leading-relaxed">
                  <span className="font-semibold">Why: </span>{s.reason}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {!isPending && suggestions.length > 0 && (
          <div className="px-6 py-4 border-t border-border/30 flex justify-between items-center bg-slate-50/50">
            <p className="text-xs text-muted-foreground">{suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''} generated</p>
            <Button size="sm" variant="ghost" onClick={fetchSuggestions} className="rounded-full text-xs h-8">
              <RefreshCw className="w-3 h-3 mr-1.5" /> Regenerate
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
