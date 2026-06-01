"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { inviteMember } from "@/app/actions/team"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Check, Copy, Loader2, UserPlus } from "lucide-react"
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
  const [inviteLink, setInviteLink] = useState("")
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    const submittedEmail = email
    setIsSubmitting(true)
    const result = await inviteMember(workspaceId, email)
    setIsSubmitting(false)

    if (result.success) {
      setInviteLink(result.inviteUrl ?? "")
      setCopied(false)
      if (result.emailSent === false) {
        toast.warning("Invite saved, but the email could not be sent", {
          description: result.emailError || `Share the invite link with ${submittedEmail}.`,
        })
      } else {
        toast.success(`Invitation sent to ${submittedEmail}`)
      }
      setEmail("")
    } else {
      const err = result.error as any
      toast.error(err.message || "Failed to send invitation", {
        description: err.details,
      })
    }
  }

  const handleCopyInviteLink = async () => {
    if (!inviteLink) return

    try {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      toast.success("Invite link copied")
    } catch {
      toast.error("Could not copy the invite link")
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setInviteLink("")
      setCopied(false)
      setEmail("")
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
             <UserPlus className="w-6 h-6 text-primary" />
          </div>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Enter an email address to send an invite. You can also copy the direct link after it is created.
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
        {inviteLink && (
          <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Check className="h-4 w-4 text-primary" />
              Invite link ready
            </div>
            <div className="flex gap-2">
              <Input value={inviteLink} readOnly className="h-9 rounded-lg bg-white text-xs" />
              <Button type="button" variant="outline" size="icon-lg" onClick={handleCopyInviteLink} className="rounded-lg">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
