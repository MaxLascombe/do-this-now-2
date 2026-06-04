import { describe, expect, it } from 'vitest'

import { dateString, nextDueDate } from '../helpers'

import { makeTask } from './_factories'

const monthly = (due: string, interval = 1) =>
  dateString(
    nextDueDate(
      interval === 1
        ? makeTask({ due, repeat: 'Monthly' })
        : makeTask({
            due,
            repeat: 'Custom',
            repeatUnit: 'month',
            repeatInterval: interval,
          }),
    )!,
  )

const yearly = (due: string) =>
  dateString(nextDueDate(makeTask({ due, repeat: 'Yearly' }))!)

describe('nextDueDate monthly clamps to the month end', () => {
  it('keeps a normal day unchanged', () => {
    expect(monthly('2026-1-15')).toBe('2026-2-15')
  })

  it('clamps Jan 31 to the last day of February (no skipped month)', () => {
    expect(monthly('2026-1-31')).toBe('2026-2-28')
  })

  it('clamps to Feb 29 in a leap year', () => {
    expect(monthly('2028-1-31')).toBe('2028-2-29')
  })

  it('clamps Mar 31 to Apr 30', () => {
    expect(monthly('2026-3-31')).toBe('2026-4-30')
  })

  it('only clamps when the target month is shorter (Jan 31 +2mo → Mar 31)', () => {
    expect(monthly('2026-1-31', 2)).toBe('2026-3-31')
  })

  it('rolls into the next year', () => {
    expect(monthly('2026-12-31')).toBe('2027-1-31')
  })
})

describe('nextDueDate yearly clamps the leap day', () => {
  it('keeps a normal day unchanged', () => {
    expect(yearly('2026-6-15')).toBe('2027-6-15')
  })

  it('clamps Feb 29 to Feb 28 in the following (non-leap) year', () => {
    expect(yearly('2028-2-29')).toBe('2029-2-28')
  })
})
