import { describe, expect, it, vi } from 'vitest'

import { createUndoStack, MAX_UNDO } from '../undo'

describe('undo stack', () => {
  it('pops newest-first and reports the entry', async () => {
    const stack = createUndoStack()
    const ran: string[] = []
    stack.push({ label: 'a', run: async () => void ran.push('a') })
    stack.push({ label: 'b', run: async () => void ran.push('b') })
    expect(stack.size).toBe(2)
    const popped = await stack.undoLast()
    expect(popped?.label).toBe('b')
    expect(ran).toEqual(['b'])
    expect(stack.size).toBe(1)
  })

  it('resolves null on an empty stack', async () => {
    expect(await createUndoStack().undoLast()).toBeNull()
  })

  it('is bounded to MAX_UNDO entries, dropping the oldest', async () => {
    const stack = createUndoStack()
    for (let i = 0; i < MAX_UNDO + 5; i++) {
      stack.push({ label: `e${i}`, run: async () => {} })
    }
    expect(stack.size).toBe(MAX_UNDO)
    // Newest survived; the five oldest were dropped.
    expect((await stack.undoLast())?.label).toBe(`e${MAX_UNDO + 4}`)
  })

  it('drops a failing entry instead of retrying it forever', async () => {
    const stack = createUndoStack()
    const run = vi.fn().mockRejectedValue(new Error('boom'))
    stack.push({ label: 'bad', run })
    await expect(stack.undoLast()).rejects.toThrow('boom')
    expect(stack.size).toBe(0)
  })

  it('notifies size changes for reactive consumers', () => {
    const sizes: number[] = []
    const stack = createUndoStack((n) => sizes.push(n))
    stack.push({ label: 'a', run: async () => {} })
    stack.push({ label: 'b', run: async () => {} })
    void stack.undoLast()
    expect(sizes).toEqual([1, 2, 1])
  })
})
