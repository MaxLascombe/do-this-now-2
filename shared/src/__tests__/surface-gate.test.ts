import { describe, expect, it } from 'vitest'

import { newSafeDate } from '../helpers'
import { showsInTopTasks, taskSurface } from '../task-sorting'
import { makeTask } from './_factories'

const today = newSafeDate('2026-5-1')

describe('Surface gate (showsInTopTasks)', () => {
  it('anytime always shows, regardless of due date', () => {
    const t = makeTask({ surface: 'anytime', due: '2026-9-1' })
    expect(showsInTopTasks(t, today, 14)).toBe(true)
  })

  it('once-it-counts shows only inside the horizon', () => {
    const inside = makeTask({ surface: 'counting', due: '2026-5-14' })
    const edge = makeTask({ surface: 'counting', due: '2026-5-15' })
    const outside = makeTask({ surface: 'counting', due: '2026-5-16' })
    expect(showsInTopTasks(inside, today, 14)).toBe(true)
    expect(showsInTopTasks(edge, today, 14)).toBe(true) // today + 14 inclusive
    expect(showsInTopTasks(outside, today, 14)).toBe(false)
  })

  it('once-it-counts follows the horizon setting', () => {
    const t = makeTask({ surface: 'counting', due: '2026-5-10' })
    expect(showsInTopTasks(t, today, 14)).toBe(true)
    expect(showsInTopTasks(t, today, 7)).toBe(false)
  })

  it('once-due shows from the due date on, overdue included', () => {
    const future = makeTask({ surface: 'due', due: '2026-5-2' })
    const todayDue = makeTask({ surface: 'due', due: '2026-5-1' })
    const overdue = makeTask({ surface: 'due', due: '2026-4-20' })
    expect(showsInTopTasks(future, today, 14)).toBe(false)
    expect(showsInTopTasks(todayDue, today, 14)).toBe(true)
    expect(showsInTopTasks(overdue, today, 14)).toBe(true)
  })

  it('legacy rows without surface derive it from canDoEarly', () => {
    const legacyOpen = makeTask({ due: '2026-9-1' })
    const legacyGated = makeTask({ canDoEarly: false, due: '2026-5-2' })
    delete (legacyOpen as { surface?: unknown }).surface
    delete (legacyGated as { surface?: unknown }).surface
    expect(taskSurface(legacyOpen)).toBe('anytime')
    expect(taskSurface(legacyGated)).toBe('due')
    expect(showsInTopTasks(legacyGated, today, 14)).toBe(false)
  })
})
