import { describe, expect, it } from 'vitest'

import { activeNavFromPath } from '../nav'

describe('activeNavFromPath', () => {
  it('maps the root path to home', () => {
    expect(activeNavFromPath('/')).toBe('home')
  })

  it('maps each section prefix to its nav id', () => {
    expect(activeNavFromPath('/tasks')).toBe('tasks')
    expect(activeNavFromPath('/tasks/abc/edit')).toBe('tasks')
    expect(activeNavFromPath('/new-task')).toBe('new')
    expect(activeNavFromPath('/history')).toBe('history')
    expect(activeNavFromPath('/stats')).toBe('stats')
  })

  it('falls back to home for an unknown path', () => {
    expect(activeNavFromPath('/something-else')).toBe('home')
  })
})
