import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user?.id).single()

  return (
    <div className="h-full flex flex-col pb-6 max-w-3xl mx-auto space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your workspace preferences.</p>
      </div>

      <Card className="glass-card border-none">
        <CardHeader>
          <CardTitle className="text-lg">Profile Details</CardTitle>
          <CardDescription>Update your personal information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input disabled defaultValue={profile?.full_name} className="input-base shadow-none bg-muted/50" />
            <p className="text-[11px] text-muted-foreground mt-1">Contact your admin to change your name.</p>
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input disabled defaultValue={profile?.email} className="input-base shadow-none bg-muted/50" />
          </div>
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
