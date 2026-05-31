type InviteEmailInput = {
  to: string
  inviteUrl: string
  workspaceName?: string | null
}

type ResendErrorPayload = {
  message?: string
  error?: string
  name?: string
}

const RESEND_CONFIG_ERROR = 'Resend is not configured. Add RESEND_API_KEY and INVITE_EMAIL_FROM to send invite emails.'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function readResendError(response: Response) {
  try {
    const payload = (await response.json()) as ResendErrorPayload
    return payload.message || payload.error || payload.name || `Resend returned HTTP ${response.status}`
  } catch {
    const text = await response.text().catch(() => '')
    return text || `Resend returned HTTP ${response.status}`
  }
}

export async function sendWorkspaceInviteEmail({ to, inviteUrl, workspaceName }: InviteEmailInput) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.INVITE_EMAIL_FROM

  if (!apiKey || !from) {
    return { sent: false, error: RESEND_CONFIG_ERROR }
  }

  const safeWorkspaceName = escapeHtml(workspaceName || 'your workspace')
  const safeInviteUrl = escapeHtml(inviteUrl)

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject: `You have been invited to ${workspaceName || 'a SprintRoom workspace'}`,
      text: [
        `You have been invited to ${workspaceName || 'a SprintRoom workspace'}.`,
        '',
        'Sign in or create an account with this email address, then open your invitations:',
        inviteUrl,
      ].join('\n'),
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
          <h1 style="font-size:20px;margin:0 0 12px">You have been invited to ${safeWorkspaceName}</h1>
          <p style="margin:0 0 16px">Sign in or create an account with this email address, then open your invitations.</p>
          <p style="margin:0 0 20px">
            <a href="${safeInviteUrl}" style="background:#111827;color:#ffffff;padding:10px 14px;border-radius:8px;text-decoration:none;display:inline-block">
              Open invitations
            </a>
          </p>
          <p style="margin:0;color:#6b7280;font-size:13px">If the button does not work, copy and paste this link: ${safeInviteUrl}</p>
        </div>
      `,
    }),
  })

  if (!response.ok) {
    return { sent: false, error: `Resend could not send the invite email. ${await readResendError(response)}` }
  }

  return { sent: true, error: undefined }
}
