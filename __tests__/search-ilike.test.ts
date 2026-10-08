import { describe, expect, it } from 'vitest'
import { toIlikePattern } from '@/lib/search/ilike'

describe('toIlikePattern', () => {
  it('wraps a plain term for a contains match', () => {
    expect(toIlikePattern('launch')).toBe('%launch%')
  })

  it('escapes LIKE wildcards so they match literally', () => {
    expect(toIlikePattern('100%')).toBe('%100\\%%')
    expect(toIlikePattern('a_b')).toBe('%a\\_b%')
  })

  it('escapes the escape character itself', () => {
    expect(toIlikePattern('c:\\temp')).toBe('%c:\\\\temp%')
  })

  it('trims surrounding whitespace', () => {
    expect(toIlikePattern('  plan  ')).toBe('%plan%')
  })
})
