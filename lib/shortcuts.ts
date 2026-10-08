export type KeyLike = { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean }

/** True when a keypress belongs to a text field, not to a shortcut. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.getAttribute('contenteditable') === 'true') return true
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT'
}

export function globalShortcutFor(e: KeyLike): 'toggle-palette' | 'open-palette' | 'create-task' | null {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') return 'toggle-palette'
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  if (e.key === '/') return 'open-palette'
  if (e.key === 'c') return 'create-task'
  return null
}

const TASK_KEYS: Record<string, 'status' | 'assignee' | 'priority' | 'due'> = {
  s: 'status',
  a: 'assignee',
  p: 'priority',
  d: 'due',
}

export function taskShortcutFor(e: KeyLike): 'status' | 'assignee' | 'priority' | 'due' | null {
  if (e.metaKey || e.ctrlKey || e.altKey) return null
  return TASK_KEYS[e.key] ?? null
}
