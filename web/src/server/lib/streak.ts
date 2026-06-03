import { DAY_MS } from '@dtn/shared/time'

// Longest run of consecutive hit days from a set of YYYY-M-D keys. Parses
// each key to a local-midnight timestamp, sorts, and counts the longest
// run where adjacent days are one calendar day apart (a minute of slack
// absorbs DST shifts).
export function computeLongestStreak(hitDates: Iterable<string>): number {
  const sorted = [...hitDates]
    .map((s) => {
      const [y, m, d] = s.split('-').map((p) => parseInt(p))
      return new Date(y, m - 1, d).getTime()
    })
    .sort((a, b) => a - b)

  let longest = 0
  let run = 0
  let prev: number | null = null
  for (const t of sorted) {
    if (prev === null || t - prev > DAY_MS + 60000) run = 1
    else run++
    if (run > longest) longest = run
    prev = t
  }
  return longest
}
