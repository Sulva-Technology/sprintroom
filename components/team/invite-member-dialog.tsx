"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { inviteMember } from "@/app/actions/team"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { UserPlus, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function InviteMemberDialog({
  workspaceId,
  open,
  onOpenChange
}: {
  workspaceId: string,
  open: boolean,
  onOpenChange: (open: boolean) => void
}) {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsSubmitting(true)
    const result = await inviteMember(workspaceId, email)
    setIsSubmitting(false)

    if (result.success) {
      toast.success(`Invitation sent to ${email}`)
      setEmail("")
      onOpenChange(false)
    } else {
      const err = result.error as any
      toast.error(err.message || "Failed to send invitation")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
             <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Enter the email address of the person you&apos;d like to invite to this workspace.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">Email Address</label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@example.com"
              required
              autoFocus
              className="rounded-xl border-border/50"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="rounded-xl bg-primary text-primary-foreground shadow-sm">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : "Send Invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
