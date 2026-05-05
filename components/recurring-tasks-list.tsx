'use client'

import { format } from 'date-fns'
import { Calendar, Trash2, Power, PowerOff } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toggleRecurringTaskRule, deleteRecurringTaskRule } from '@/app/actions/scheduling'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'

export function RecurringTasksList({ rules }: { rules: any[] }) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleToggle = async (ruleId: string, currentState: boolean) => {
    setIsUpdating(true)
    await toggleRecurringTaskRule(ruleId, !currentState)
    setIsUpdating(false)
  }

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this recurring task rule?')) return
    setIsUpdating(true)
    await deleteRecurringTaskRule(ruleId)
    setIsUpdating(false)
  }

  return (
    <div className="space-y-4">
      {rules.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground border rounded-xl border-dashed">
          No recurring tasks set up yet.
        </div>
      ) : (
        rules.map((rule) => (
          <div key={rule.id} className="flex items-center justify-between p-4 border rounded-xl bg-white shadow-sm">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-sm">{rule.template_title}</h4>
                <Badge variant={rule.is_active ? "default" : "secondary"} className="text-[10px] h-5">
                  {rule.frequency}
                </Badge>
                {!rule.is_active && (
                  <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">paused</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-2">
                <Calendar className="w-3.5 h-3.5" /> 
                Next run: {format(new Date(rule.next_run_at), 'MMM d, h:mm a')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => handleToggle(rule.id, rule.is_active)}
                disabled={isUpdating}
                className={rule.is_active ? "text-amber-600 hover:text-amber-700 hover:bg-amber-50" : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"}
                title={rule.is_active ? "Pause rule" : "Resume rule"}
              >
                {rule.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => handleDelete(rule.id)}
                disabled={isUpdating}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
