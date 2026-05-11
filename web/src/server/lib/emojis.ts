import Anthropic from '@anthropic-ai/sdk'

// Lazy singleton — instantiating at import time would crash any code path
// that imports this lib in an environment where the key isn't set (tests,
// local dev without the .env, etc.).
let _client: Anthropic | null = null
function client(): Anthropic {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not set — emoji suggestions and backfill are disabled',
    )
  }
  _client = new Anthropic({ apiKey })
  return _client
}

// Pull emoji codepoints out of a string, dropping spaces / numbering / etc.
// Returns each emoji as its own string element. Handles ZWJ sequences and
// Variation Selector-16 (️) so flag-style emojis come through whole.
function extractEmojis(text: string): string[] {
  const matches = [
    ...text.matchAll(
      /\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*/gu,
    ),
  ]
  return matches.map((m) => m[0])
}

const MODEL = 'claude-haiku-4-5-20251001'

/** Suggest 5 emoji for a task title. Returns at most 5 strings. */
export async function suggestEmojis(title: string): Promise<string[]> {
  const trimmed = title.trim()
  if (!trimmed) return []
  const resp = await client().messages.create({
    model: MODEL,
    max_tokens: 60,
    messages: [
      {
        role: 'user',
        content: `Suggest 5 distinct emoji that fit this to-do task title. Output exactly 5 emoji separated by spaces, nothing else.\n\nTask: ${trimmed}`,
      },
    ],
  })
  const text = resp.content
    .filter(
      (b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text',
    )
    .map((b) => b.text)
    .join('')
  const emojis = extractEmojis(text).slice(0, 5)
  return emojis
}

/**
 * Pick one emoji per task title in a single Claude call. Used by the
 * admin backfill to upgrade legacy '📝' tasks. Returns parallel array.
 * Missing entries fall back to '📝'.
 */
export async function bulkPickEmoji(titles: string[]): Promise<string[]> {
  if (titles.length === 0) return []
  const list = titles.map((t, i) => `${i + 1}. ${t}`).join('\n')
  const resp = await client().messages.create({
    model: MODEL,
    max_tokens: 50 + titles.length * 8,
    messages: [
      {
        role: 'user',
        content: `For each task title below, pick one fitting emoji. Output one emoji per line in the same order, no numbering, no other text.\n\n${list}`,
      },
    ],
  })
  const text = resp.content
    .filter(
      (b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text',
    )
    .map((b) => b.text)
    .join('')
  // One emoji per line; if Claude collapses to spaces we still recover.
  const lines = text
    .split(/\n+/)
    .map((l) => extractEmojis(l)[0])
    .filter((e): e is string => !!e)
  // Pad / truncate to match input length.
  return titles.map((_, i) => lines[i] ?? '📝')
}
