'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateProfile } from '@/app/actions/profile'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { Camera, Loader2 } from 'lucide-react'

export function ProfileForm({ profile }: { profile: any }) {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')
  const supabase = createClient()

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true)
      if (!e.target.files || e.target.files.length === 0) {
        throw new Error('You must select an image to upload.')
      }

      const file = e.target.files[0]
      const fileExt = file.name.split('.').pop()
      const fileName = `${profile.id}-${Math.random()}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      setAvatarUrl(publicUrl)
      
      // Auto-save the new avatar URL
      const res = await updateProfile(profile.id, { avatar_url: publicUrl })
      if (res.error) throw new Error(res.error)
      
      toast.success('Avatar updated successfully')
    } catch (error: any) {
      toast.error(error.message || 'Error uploading avatar')
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    
    try {
      const res = await updateProfile(profile.id, { full_name: fullName })
      if (res.error) throw new Error(res.error)
      toast.success('Profile updated successfully')
    } catch (error: any) {
      toast.error(error.message || 'Error updating profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6 pb-6 border-b border-border/50">
        <div className="relative group">
          <Avatar className="h-24 w-24 border-2 border-border shadow-md">
            <AvatarImage src={avatarUrl} alt={fullName} />
            <AvatarFallback className="text-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              {fullName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <label 
            htmlFor="avatar-upload" 
            className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
          >
            {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Camera className="w-6 h-6" />}
          </label>
          <input 
            type="file" 
            id="avatar-upload" 
            accept="image/*" 
            className="hidden" 
            onChange={handleUpload} 
            disabled={uploading}
          />
        </div>
        <div className="flex-1 space-y-1 text-center sm:text-left">
          <h3 className="text-lg font-semibold">Profile Picture</h3>
          <p className="text-sm text-muted-foreground">
            Click the avatar to upload a new one. <br/>
            Supports JPG, PNG or GIF. Max 2MB.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="full_name">Full Name</Label>
          <Input 
            id="full_name"
            value={fullName} 
            onChange={(e) => setFullName(e.target.value)}
            className="input-base"
            placeholder="Your full name"
          />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input disabled defaultValue={profile?.email} className="input-base bg-muted/50" />
          <p className="text-[11px] text-muted-foreground">Email cannot be changed.</p>
        </div>
        <Button type="submit" disabled={loading} className="rounded-xl px-8 shadow-sm">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Save Changes
        </Button>
      </form>
    </div>
  )
}
