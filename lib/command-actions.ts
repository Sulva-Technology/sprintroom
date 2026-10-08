import { NAV_ITEMS } from '@/lib/navigation'

export type CommandAction =
  | { id: string; kind: 'navigate'; label: string; href: string; keywords: string }
  | { id: string; kind: 'create-task'; label: string; title: string; keywords: string }
  | { id: string; kind: 'start-focus'; label: string; keywords: string }

/** Destinations reachable from ⌘K that are not in the main nav. */
export const EXTRA_DESTINATIONS: { href: string; label: string }[] = [
  { href: '/dashboard/inbox', label: 'Inbox' },
  { href: '/dashboard/invites', label: 'Invites' },
]

function staticActions(): CommandAction[] {
  const destinations = [...NAV_ITEMS.map(({ href, label }) => ({ href, label })), ...EXTRA_DESTINATIONS]
  return [
    { id: 'start-focus', kind: 'start-focus', label: 'Start a focus session', keywords: 'focus pomodoro timer start' },
    ...destinations.map(
      (d): CommandAction => ({
        id: `go-${d.href}`,
        kind: 'navigate',
        label: `Go to ${d.label}`,
        href: d.href,
        keywords: `go open ${d.label.toLowerCase()}`,
      })
    ),
  ]
}

export function buildCommandActions(query: string, opts: { canEdit: boolean; createOnly?: boolean }): CommandAction[] {
  const q = query.trim()
  const create: CommandAction[] =
    q && opts.canEdit ? [{ id: 'create-task', kind: 'create-task', label: `Create task "${q}"`, title: q, keywords: '' }] : []
  if (opts.createOnly) return create

  const lower = q.toLowerCase()
  const matches = staticActions()
    .filter((a) => a.kind !== 'start-focus' || opts.canEdit)
    .filter((a) => !lower || a.label.toLowerCase().includes(lower) || a.keywords.includes(lower))
  return [...create, ...matches]
}
