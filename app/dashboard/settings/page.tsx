import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RecurringTasksList } from '@/components/recurring-tasks-list'
import { CreateRecurringTaskDialog } from '@/components/create-recurring-task-dialog'
import { ProfileForm } from '@/components/settings/profile-form'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single()

  const { data: recurringRules } = await supabase
    .from('task_recurrence_rules')
    .select('*')
    .eq('user_id', user?.id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col pb-6 max-w-3xl mx-auto space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your workspace preferences.</p>
      </div>

      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="text-lg">Profile Details</CardTitle>
          <CardDescription>Update your personal information and avatar.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm profile={profile} />
        </CardContent>
      </Card>

      <Card className="glass-card border-none">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">Recurring Tasks</CardTitle>
            <CardDescription>Automatically create tasks on a schedule.</CardDescription>
          </div>
          <CreateRecurringTaskDialog />
        </CardHeader>
        <CardContent>
          <RecurringTasksList rules={recurringRules || []} />
        </CardContent>
      </Card>

      <Card className="glass-card border-none border-t-destructive/20 border-t-4">
        <CardHeader>
          <CardTitle className="text-lg text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" className="rounded-xl shadow-sm">Delete Account</Button>
        </CardContent>
      </Card>
    </div>
  )
}
