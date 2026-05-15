import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getFinancialEntries, getFinancialMetrics } from '@/app/actions/finances'
import { getFinancialInsights } from '@/app/actions/ai-finances'
import { getWorkspaceProjects } from '@/app/actions/projects'
import { FinancialDashboard } from '@/components/finances/financial-dashboard'
import { AddEntryDialog } from '@/components/finances/add-entry-dialog'
import { Wallet, Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export default async function FinancesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 1. Get workspace membership
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .single()

  if (!membership) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertTitle>No Workspace</AlertTitle>
          <AlertDescription>
            You are not a member of any workspace. Please create or join a workspace to track finances.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const workspaceId = membership.workspace_id
  const isAdmin = ['admin', 'owner'].includes(membership.role)

  // 2. Fetch data in parallel
  const [entries, metrics, aiInsights, projects] = await Promise.all([
    getFinancialEntries(workspaceId),
    getFinancialMetrics(workspaceId),
    getFinancialInsights(workspaceId),
    getWorkspaceProjects(workspaceId)
  ])

  return (
    <div className="flex-1 space-y-8 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Financial Tracker</h2>
            <p className="text-slate-500">
              {isAdmin 
                ? "Manage workspace-wide finances and project costs." 
                : "Track your personal expenses and income."}
            </p>
          </div>
        </div>
        <AddEntryDialog workspaceId={workspaceId} projects={projects} />
      </div>

      <FinancialDashboard 
        entries={entries as any} 
        metrics={metrics || { totalIncome: 0, totalExpense: 0, netBalance: 0, byProject: {} }}
        aiInsights={aiInsights}
      />
    </div>
  )
}
