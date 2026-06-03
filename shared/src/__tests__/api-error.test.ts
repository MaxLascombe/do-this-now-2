import { describe, expect, it } from 'vitest'

import { ApiError } from '../api-client'

describe('ApiError', () => {
  it('is an Error subclass named ApiError', () => {
    const e = new ApiError({ code: 'not_found', status: 404 })
    expect(e).toBeInstanceOf(Error)
    expect(e).toBeInstanceOf(ApiError)
    expect(e.name).toBe('ApiError')
  })

  it('defaults the message to the code', () => {
    expect(new ApiError({ code: 'unauthenticated', status: 401 }).message).toBe(
      'unauthenticated',
    )
  })

  it('keeps an explicit message and exposes code/status/details', () => {
    const e = new ApiError({
      code: 'invalid',
      status: 400,
      message: 'Bad input',
      details: { field: 'title' },
    })
    expect(e.message).toBe('Bad input')
    expect(e.code).toBe('invalid')
    expect(e.status).toBe(400)
    expect(e.details).toEqual({ field: 'title' })
  })
})
