import { describe, expect, it } from 'vitest'

import { bulkPickEmoji, suggestEmojis } from '../emojis'

// suggestEmojis/bulkPickEmoji build the Anthropic client lazily and throw if
// ANTHROPIC_API_KEY is unset — but their empty-input fast paths return before
// reaching the client. Pin that so the no-key-needed contract can't regress
// into an eager client() call that would crash on blank input.
describe('emoji helpers: empty-input fast paths', () => {
  it('suggestEmojis resolves to [] for an empty or whitespace-only title', async () => {
    await expect(suggestEmojis('')).resolves.toEqual([])
    await expect(suggestEmojis('   ')).resolves.toEqual([])
  })

  it('bulkPickEmoji resolves to [] for an empty list', async () => {
    await expect(bulkPickEmoji([])).resolves.toEqual([])
  })
})
