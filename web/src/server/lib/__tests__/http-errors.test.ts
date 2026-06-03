import { describe, expect, it } from 'vitest'

import { errorJson, invalid, notFound, unauthenticated } from '../http'

// These envelopes are the contract the mobile ApiError client parses, so the
// code / status / shape have to stay stable.
describe('http error envelopes', () => {
  it('unauthenticated → 401', async () => {
    const res = unauthenticated()
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ code: 'unauthenticated' })
  })

  it('notFound → 404, with or without a message', async () => {
    const withMsg = notFound('gone')
    expect(withMsg.status).toBe(404)
    expect(await withMsg.json()).toEqual({ code: 'not_found', message: 'gone' })

    const noMsg = notFound()
    expect(noMsg.status).toBe(404)
    expect(await noMsg.json()).toEqual({ code: 'not_found' })
  })

  it('invalid → 400 with details', async () => {
    const res = invalid({ formErrors: ['bad'] })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({
      code: 'invalid',
      details: { formErrors: ['bad'] },
    })
  })

  it('errorJson honours an arbitrary status', async () => {
    const res = errorJson({ code: 'teapot' }, 418)
    expect(res.status).toBe(418)
    expect(await res.json()).toEqual({ code: 'teapot' })
  })
})
