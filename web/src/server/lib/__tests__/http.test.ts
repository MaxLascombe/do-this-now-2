import { describe, expect, it } from 'vitest'

import { getTzFromRequest } from '../http'

const req = (offset?: string) =>
  new Request('https://example.com', {
    headers: offset === undefined ? {} : { 'x-tz-offset': offset },
  })

describe('getTzFromRequest', () => {
  it('reads a valid offset header', () => {
    expect(getTzFromRequest(req('-60'))).toBe(-60)
    expect(getTzFromRequest(req('480'))).toBe(480)
    expect(getTzFromRequest(req('0'))).toBe(0)
  })

  it('falls back to 0 when missing or unparseable', () => {
    expect(getTzFromRequest(req())).toBe(0)
    expect(getTzFromRequest(req('not-a-number'))).toBe(0)
  })

  it('falls back to 0 for out-of-range offsets', () => {
    expect(getTzFromRequest(req('999999'))).toBe(0)
    expect(getTzFromRequest(req('-999999'))).toBe(0)
    expect(getTzFromRequest(req('841'))).toBe(0)
  })
})
