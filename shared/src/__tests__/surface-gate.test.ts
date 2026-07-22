import { describe, expect, it } from 'vitest'

import { newSafeDate } from '../helpers'
import { showsInTopTasks, waitsForDue } from '../task-sorting'
import { makeTask } from './_factories'

const today = newSafeDate('2026-5-1')

describe('Top Tasks gate — counting by default', () => {
  it('a default task shows only inside the horizon', () => {
    const inside = makeTask({ surface: 'counting', due: '2026-5-14' })
    const edge = makeTask({ surface: 'counting', due: '2026-5-15' })
    const outside = makeTask({ surface: 'counting', due: '2026-5-16' })
    expect(showsInTopTasks(inside, today, 14)).toBe(true)
    expect(showsInTopTasks(edge, today, 14)).toBe(true) // today + 14 inclusive
    expect(showsInTopTasks(outside, today, 14)).toBe(false)
  })

  it("the retired 'anytime' level behaves exactly like counting", () => {
    const outside = makeTask({ surface: 'anytime', due: '2026-9-1' })
    const inside = makeTask({ surface: 'anytime', due: '2026-5-10' })
    expect(showsInTopTasks(outside, today, 14)).toBe(false)
    expect(showsInTopTasks(inside, today, 14)).toBe(true)
  })

  it('the gate follows the horizon setting', () => {
    const t = makeTask({ surface: 'counting', due: '2026-5-10' })
    expect(showsInTopTasks(t, today, 14)).toBe(true)
    expect(showsInTopTasks(t, today, 7)).toBe(false)
  })

  it('once-due waits for the due date, overdue always shows', () => {
    const future = makeTask({ surface: 'due', due: '2026-5-2' })
    const todayDue = makeTask({ surface: 'due', due: '2026-5-1' })
    const overdue = makeTask({ surface: 'due', due: '2026-4-20' })
    expect(showsInTopTasks(future, today, 14)).toBe(false)
    expect(showsInTopTasks(todayDue, today, 14)).toBe(true)
    expect(showsInTopTasks(overdue, today, 14)).toBe(true)
  })

  it('legacy canDoEarly=false rows still wait for due', () => {
    const legacyGated = makeTask({ canDoEarly: false, due: '2026-5-2' })
    delete (legacyGated as { surface?: unknown }).surface
    expect(waitsForDue(legacyGated)).toBe(true)
    expect(showsInTopTasks(legacyGated, today, 14)).toBe(false)
  })
})
