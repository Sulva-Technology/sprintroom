"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { UserPlus } from "lucide-react"
import { InviteMemberDialog } from "./invite-member-dialog"

export function TeamPulseHeader({ workspaceId, canInvite }: { workspaceId: string, canInvite?: boolean }) {
  const [showInviteDialog, setShowInviteDialog] = useState(false)

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-2">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-foreground mb-1">Team Pulse</h1>
          <p className="text-muted-foreground font-medium text-sm md:text-base">See who is active, blocked, overloaded, or silent.</p>
        </div>

        {canInvite && (
          <Button
            onClick={() => setShowInviteDialog(true)}
            className="rounded-full shadow-sm bg-primary text-primary-foreground h-10 px-6 font-semibold"
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Invite Member
          </Button>
        )}
      </div>

      <InviteMemberDialog
        workspaceId={workspaceId}
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
      />
    </>
  )
}
