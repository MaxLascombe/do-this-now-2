import { describe, expect, it } from 'vitest'

import {
  historyKey,
  progressTodayKey,
  statsKey,
  taskKeys,
  timerMutationKey,
} from '../queries'

// These keys are the React Query cache contract. taskKeys.all is the prefix
// that invalidateTaskCaches relies on to clear top/list/one(id) in one call,
// so any drift in their shape would silently break invalidation.
describe('query-key contract', () => {
  it('taskKeys.all is the shared prefix of every task key', () => {
    expect(taskKeys.all).toEqual(['tasks'])
    for (const key of [taskKeys.top, taskKeys.list, taskKeys.one('abc')]) {
      expect(key[0]).toBe(taskKeys.all[0])
    }
  })

  it('pins each task key shape', () => {
    expect(taskKeys.top).toEqual(['tasks', 'top'])
    expect(taskKeys.list).toEqual(['tasks', 'all'])
    expect(taskKeys.one('abc')).toEqual(['tasks', 'get', 'abc'])
  })

  it('one(id) threads the id through verbatim', () => {
    expect(taskKeys.one('')).toEqual(['tasks', 'get', ''])
    expect(taskKeys.one('a/b?c')).toEqual(['tasks', 'get', 'a/b?c'])
  })

  it('historyKey scopes by date string', () => {
    expect(historyKey('2026-3-5')).toEqual(['history', '2026-3-5'])
    expect(historyKey('2026-3-5')).not.toEqual(historyKey('2026-3-6'))
  })

  it('pins the singleton keys', () => {
    expect(progressTodayKey).toEqual(['progresstoday'])
    expect(statsKey).toEqual(['stats'])
  })

  it('timer mutation key shares the tasks namespace', () => {
    expect(timerMutationKey).toEqual(['tasks', 'timer'])
  })
})
