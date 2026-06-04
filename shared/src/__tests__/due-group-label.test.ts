import { describe, expect, it } from 'vitest'

import { dueGroupLabel, tasksListEyebrow } from '../format'

// Reference "today" = Fri May 15 2026, mid-morning.
const today = new Date(2026, 4, 15, 9, 0)

describe('dueGroupLabel', () => {
  it('labels today and tomorrow by name', () => {
    expect(dueGroupLabel('2026-5-15', today)).toEqual({
      label: 'Today',
      eyebrow: 'Friday, May 15',
      overdueSuffix: null,
    })
    expect(dueGroupLabel('2026-5-16', today)).toEqual({
      label: 'Tomorrow',
      eyebrow: 'Saturday, May 16',
      overdueSuffix: null,
    })
  })

  it('labels further-out days by weekday with no overdue tag', () => {
    expect(dueGroupLabel('2026-5-18', today)).toEqual({
      label: 'Monday',
      eyebrow: 'May 18',
      overdueSuffix: null,
    })
  })

  it('tags overdue days and singularizes one day', () => {
    expect(dueGroupLabel('2026-5-14', today)).toEqual({
      label: 'Thursday',
      eyebrow: 'May 14',
      overdueSuffix: '1 day overdue',
    })
    expect(dueGroupLabel('2026-5-12', today)).toEqual({
      label: 'Tuesday',
      eyebrow: 'May 12',
      overdueSuffix: '3 days overdue',
    })
  })
})

describe('tasksListEyebrow', () => {
  // today = Fri May 15; the Sun–Sat window is [May 10, May 17).
  it('counts tasks due in the current calendar week', () => {
    const tasks = [
      { due: '2026-5-15' }, // Fri, this week
      { due: '2026-5-16' }, // Sat, this week
      { due: '2026-5-18' }, // next Mon, out
      { due: '2026-5-9' }, // last Sat, out
    ]
    expect(tasksListEyebrow(tasks, today)).toBe('4 active · 2 this week')
  })

  it('includes the week-start Sunday and excludes the next Sunday', () => {
    const tasks = [
      { due: '2026-5-10' }, // this week's Sunday — inclusive start
      { due: '2026-5-16' }, // Saturday — last day in window
      { due: '2026-5-17' }, // next Sunday — exclusive end, out
      { due: '2026-5-9' }, // previous Saturday — before start, out
    ]
    expect(tasksListEyebrow(tasks, today)).toBe('4 active · 2 this week')
  })

  it('handles an empty list', () => {
    expect(tasksListEyebrow([], today)).toBe('0 active · 0 this week')
  })
})
