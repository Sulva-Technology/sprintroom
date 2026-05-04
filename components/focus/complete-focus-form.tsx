'use client'

import { useState } from 'react'
import { completeFocusSession } from '@/app/actions/focus'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Loader2 } from 'lucide-react'

export function CompleteFocusForm({ 
  sessionId, 
  finalDistractions = 0,
  isAbandonedRecovery = false
}: { 
  sessionId: string
  finalDistractions?: number
  isAbandonedRecovery?: boolean
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    
    const formData = new FormData(e.currentTarget)
    const progressNote = formData.get('progressNote') as string
    const isMeaningful = formData.get('isMeaningful') === 'on'
    
    if (!progressNote || progressNote.trim().length < 3) {
      setError('Please write a brief note about what you accomplished.')
      setIsLoading(false)
      return
    }
    
    const res = await completeFocusSession(sessionId, progressNote, isMeaningful, finalDistractions)
    if (res?.error) {
      setError(res?.error)
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-left w-full">
      <div className="space-y-2">
        <Label htmlFor="progressNote" className="font-semibold text-slate-700">What did you accomplish?</Label>
        <Textarea 
          id="progressNote"
          name="progressNote"
          placeholder="e.g. Drafted the API routes for user authentication"
          autoFocus
          className="min-h-[100px] resize-none rounded-xl border-slate-200 outline-none focus-visible:ring-primary/20 bg-slate-50 focus:bg-white transition-colors"
          disabled={isLoading}
        />
      </div>

      <div className="flex items-center space-x-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
        <Checkbox id="isMeaningful" name="isMeaningful" defaultChecked disabled={isLoading} className="border-slate-300 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-none text-white rounded-[4px] w-5 h-5"/>
        <Label htmlFor="isMeaningful" className="font-medium text-slate-700 cursor-pointer">
          This was meaningful progress
        </Label>
      </div>

      {error && (
        <div className="text-sm font-medium text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" disabled={isLoading} className="w-full h-12 rounded-xl text-md font-bold shadow-sm">
        {isLoading ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : (isAbandonedRecovery ? 'Recover Session' : 'Complete Session')}
      </Button>
    </form>
  )
}
