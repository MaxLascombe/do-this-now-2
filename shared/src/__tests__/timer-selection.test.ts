import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import {
  registerTimerMutationDefaults,
  selectionKey,
  timerMutationKey,
} from '../queries'
import type { ApiClient } from '../api-client'

// Starting a timer selects the task. The pointer is written optimistically and
// again once the server commits — these guard the ordering that broke the
// Focus View: a selection GET issued before the start committed would land
// afterwards carrying the old null pointer.

const fakeApi = () =>
  ({
    tasks: { complete: vi.fn(), timer: vi.fn() },
  }) as unknown as ApiClient

const serverTask = { id: 'keeper-1', timeframeType: 'fluid', timeFrame: 0 }

function defaultsFor(qc: QueryClient) {
  registerTimerMutationDefaults(qc, fakeApi())
  const d = qc.getMutationDefaults([...timerMutationKey])
  if (!d.onMutate || !d.onSuccess) throw new Error('timer defaults missing')
  return d
}

describe('timer start ↔ selection pointer', () => {
  it('optimistically points selection at the task the user acted on', async () => {
    const qc = new QueryClient()
    const d = defaultsFor(qc)
    const vars = { id: 'child-1', action: { kind: 'start' } }

    await d.onMutate!(vars as never)

    expect(qc.getQueryData(selectionKey)).toEqual({ selectedTaskId: 'child-1' })
  })

  it('re-asserts the pointer on success, overriding a stale null that raced it', async () => {
    const qc = new QueryClient()
    const d = defaultsFor(qc)
    const vars = { id: 'child-1', action: { kind: 'start' } }

    const ctx = await d.onMutate!(vars as never)
    // A selection GET issued before the start committed resolves now, writing
    // the pointer the server had *before* the start landed.
    qc.setQueryData(selectionKey, { selectedTaskId: null })

    await d.onSuccess!(serverTask as never, vars as never, ctx as never)

    expect(qc.getQueryData(selectionKey)).toEqual({ selectedTaskId: 'child-1' })
  })

  it('leaves the pointer alone for a pause', async () => {
    const qc = new QueryClient()
    const d = defaultsFor(qc)
    qc.setQueryData(selectionKey, { selectedTaskId: 'child-1' })
    const vars = { id: 'child-1', action: { kind: 'pause' } }

    const ctx = await d.onMutate!(vars as never)
    await d.onSuccess!(serverTask as never, vars as never, ctx as never)

    expect(qc.getQueryData(selectionKey)).toEqual({ selectedTaskId: 'child-1' })
  })
})
