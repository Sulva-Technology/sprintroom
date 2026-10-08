import { describe, expect, it } from 'vitest'
import { isTypingTarget, globalShortcutFor, taskShortcutFor } from '@/lib/shortcuts'

describe('isTypingTarget', () => {
  it('is true for text fields and contenteditable', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true)
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true)
    expect(isTypingTarget(document.createElement('select'))).toBe(true)
    const div = document.createElement('div')
    div.setAttribute('contenteditable', 'true')
    expect(isTypingTarget(div)).toBe(true)
  })
  it('is false for buttons, plain elements and null', () => {
    expect(isTypingTarget(document.createElement('button'))).toBe(false)
    expect(isTypingTarget(document.createElement('div'))).toBe(false)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('globalShortcutFor', () => {
  it('maps the global keys', () => {
    expect(globalShortcutFor({ key: 'k', metaKey: true })).toBe('toggle-palette')
    expect(globalShortcutFor({ key: 'K', ctrlKey: true })).toBe('toggle-palette')
    expect(globalShortcutFor({ key: '/' })).toBe('open-palette')
    expect(globalShortcutFor({ key: 'c' })).toBe('create-task')
  })
  it('ignores modified single keys and unknown keys', () => {
    expect(globalShortcutFor({ key: 'c', metaKey: true })).toBeNull()
    expect(globalShortcutFor({ key: 'x' })).toBeNull()
  })
})

describe('taskShortcutFor', () => {
  it('maps s/a/p/d', () => {
    expect(taskShortcutFor({ key: 's' })).toBe('status')
    expect(taskShortcutFor({ key: 'a' })).toBe('assignee')
    expect(taskShortcutFor({ key: 'p' })).toBe('priority')
    expect(taskShortcutFor({ key: 'd' })).toBe('due')
  })
  it('ignores modifiers so browser shortcuts keep working', () => {
    expect(taskShortcutFor({ key: 's', ctrlKey: true })).toBeNull()
  })
})
