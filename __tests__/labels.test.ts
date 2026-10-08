import { describe, expect, it } from 'vitest'
import { LABEL_COLORS, normalizeLabelName, pickLabelColor, labelStyle } from '@/lib/labels'

describe('labels', () => {
  it('normalises names: trims, collapses spaces, caps at 40 chars', () => {
    expect(normalizeLabelName('  Bug   fix ')).toBe('Bug fix')
    expect(normalizeLabelName('x'.repeat(60))).toHaveLength(40)
    expect(normalizeLabelName('   ')).toBe('')
  })

  it('picks a stable palette colour from the name, case-insensitively', () => {
    expect(pickLabelColor('Bug')).toBe(pickLabelColor('bug'))
    expect(LABEL_COLORS).toContain(pickLabelColor('client'))
  })

  it('falls back to slate for unknown colours', () => {
    expect(labelStyle('neon')).toBe(labelStyle('slate'))
  })
})
