export type NoteSegment = { text: string; href: string | null }

const URL_RE = /(https?:\/\/[^\s]+)/g

// Split free text into plain + link segments so notes can render clickable
// URLs. Only http(s) is linkified — never javascript:/data: etc. Trailing
// sentence punctuation is peeled off the URL so "see https://x.com." links
// just the address, not the period.
export function splitOnLinks(text: string): NoteSegment[] {
  const out: NoteSegment[] = []
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0
    if (start > last) out.push({ text: text.slice(last, start), href: null })

    let url = m[0]
    let trailing = ''
    while (/[.,;:!?]$/.test(url)) {
      trailing = url.slice(-1) + trailing
      url = url.slice(0, -1)
    }
    out.push({ text: url, href: url })
    if (trailing) out.push({ text: trailing, href: null })
    last = start + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last), href: null })
  return out
}
