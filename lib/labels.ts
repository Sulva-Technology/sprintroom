export const LABEL_COLORS = ['slate', 'red', 'amber', 'emerald', 'sky', 'violet', 'pink'] as const
export type LabelColor = (typeof LABEL_COLORS)[number]

const LABEL_STYLE: Record<LabelColor, string> = {
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  pink: 'bg-pink-50 text-pink-700 border-pink-200',
}

export function normalizeLabelName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 40)
}

/** Deterministic colour so nobody has to pick one. */
export function pickLabelColor(name: string): LabelColor {
  let hash = 0
  for (const ch of name.toLowerCase()) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return LABEL_COLORS[hash % LABEL_COLORS.length]
}

export function labelStyle(color: string): string {
  return LABEL_STYLE[(LABEL_COLORS as readonly string[]).includes(color) ? (color as LabelColor) : 'slate']
}
