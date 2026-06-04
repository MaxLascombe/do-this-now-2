import { describe, expect, it } from 'vitest'

import { ApiError, apiErrorFromResponse } from '../api-client'

describe('apiErrorFromResponse', () => {
  it('maps a well-formed envelope into a typed ApiError', () => {
    const raw = JSON.stringify({
      code: 'not_found',
      message: 'Task missing',
      details: { id: 'abc' },
    })
    const err = apiErrorFromResponse(404, 'Not Found', raw)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.code).toBe('not_found')
    expect(err.status).toBe(404)
    expect(err.message).toBe('Task missing')
    expect(err.details).toEqual({ id: 'abc' })
  })

  it("falls back to 'http_error' + statusText when the body is not JSON", () => {
    const err = apiErrorFromResponse(502, 'Bad Gateway', '<html>nginx</html>')
    expect(err.code).toBe('http_error')
    expect(err.status).toBe(502)
    expect(err.message).toBe('Bad Gateway')
    expect(err.details).toBeUndefined()
  })

  it('falls back when the body is empty', () => {
    const err = apiErrorFromResponse(500, 'Internal Server Error', '')
    expect(err.code).toBe('http_error')
    expect(err.message).toBe('Internal Server Error')
  })

  it('uses statusText when the envelope omits a message', () => {
    const err = apiErrorFromResponse(400, 'Bad Request', JSON.stringify({ code: 'invalid' }))
    expect(err.code).toBe('invalid')
    expect(err.message).toBe('Bad Request')
  })
})
