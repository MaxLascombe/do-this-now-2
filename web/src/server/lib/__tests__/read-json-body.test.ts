import { describe, expect, it } from 'vitest'

import { readJsonBody } from '../http'

const post = (body: string) =>
  new Request('http://localhost/api', { method: 'POST', body })

describe('readJsonBody', () => {
  it('parses a JSON object body', async () => {
    expect(await readJsonBody(post('{"a":1,"b":"x"}'))).toEqual({ a: 1, b: 'x' })
  })

  it('returns {} for an empty body', async () => {
    expect(await readJsonBody(post(''))).toEqual({})
  })

  it('returns undefined for malformed JSON', async () => {
    expect(await readJsonBody(post('{not json'))).toBeUndefined()
    expect(await readJsonBody(post('plain text'))).toBeUndefined()
  })
})
