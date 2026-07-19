import { createPrivateKey, createHash, sign as cryptoSign } from 'node:crypto'
import { connect } from 'node:http2'

// Direct APNs client for Live Activity pushes (`liveactivity` push type).
// Expo's push service doesn't carry Live Activity events, so we talk to
// Apple ourselves: ES256 provider JWT + HTTP/2. Config via env:
//   APNS_TEAM_ID, APNS_KEY_ID, APNS_PRIVATE_KEY (the .p8 contents),
//   APNS_BUNDLE_ID (defaults to the app id), APNS_SANDBOX=1 for dev builds.

const BUNDLE_ID = process.env.APNS_BUNDLE_ID ?? 'com.maxlascombe.dothisnow'

export function apnsConfigured(): boolean {
  return !!(
    process.env.APNS_TEAM_ID &&
    process.env.APNS_KEY_ID &&
    process.env.APNS_PRIVATE_KEY
  )
}

const b64url = (buf: Buffer): string =>
  buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

// Provider token cache: Apple wants tokens refreshed between 20 and 60
// minutes; re-signing every request gets throttled (TooManyProviderTokenUpdates).
let cachedJwt: { token: string; issuedAt: number } | null = null

function providerJwt(now = Date.now()): string {
  if (cachedJwt && now - cachedJwt.issuedAt < 45 * 60 * 1000) {
    return cachedJwt.token
  }
  // The env var may carry literal \n from the Vercel dashboard.
  const pem = process.env.APNS_PRIVATE_KEY!.replace(/\\n/g, '\n')
  const key = createPrivateKey(pem)
  const header = b64url(
    Buffer.from(JSON.stringify({ alg: 'ES256', kid: process.env.APNS_KEY_ID })),
  )
  const claims = b64url(
    Buffer.from(
      JSON.stringify({
        iss: process.env.APNS_TEAM_ID,
        iat: Math.floor(now / 1000),
      }),
    ),
  )
  const signingInput = `${header}.${claims}`
  // APNs wants the raw (r,s) JOSE signature, not ASN.1 DER.
  const sig = cryptoSign('sha256', Buffer.from(signingInput), {
    key,
    dsaEncoding: 'ieee-p1363',
  })
  const token = `${signingInput}.${b64url(sig)}`
  cachedJwt = { token, issuedAt: now }
  return token
}

export type LiveActivityEvent = 'start' | 'update' | 'end'

export type LiveActivityPush = {
  event: LiveActivityEvent
  contentState: Record<string, unknown>
  // Required for 'start': ActivityKit matches this to the Swift
  // ActivityAttributes type name to know which activity to launch.
  attributesType?: string
  attributes?: Record<string, unknown>
  // For 'end': when the system should remove it from the lock screen.
  dismissalDate?: Date
  timestamp?: Date
}

// Pure payload builder — unit-tested without any APNs traffic.
export function buildLiveActivityPayload(push: LiveActivityPush): {
  aps: Record<string, unknown>
} {
  const aps: Record<string, unknown> = {
    timestamp: Math.floor((push.timestamp ?? new Date()).getTime() / 1000),
    event: push.event,
    'content-state': push.contentState,
  }
  if (push.event === 'start') {
    aps['attributes-type'] = push.attributesType
    aps.attributes = push.attributes ?? {}
    // Push-to-start requires an alert object; it isn't shown as a banner
    // for live activities but APNs rejects the payload without one.
    // The bundled silent sound suppresses the otherwise-forced system chime.
    aps.alert = { title: 'Do This Now', body: 'Timer', sound: 'silence.caf' }
  }
  if (push.event === 'end' && push.dismissalDate) {
    aps['dismissal-date'] = Math.floor(push.dismissalDate.getTime() / 1000)
  }
  return { aps }
}

export class ApnsError extends Error {
  status: number
  reason: string
  constructor(status: number, reason: string) {
    super(`APNs ${status}: ${reason}`)
    this.status = status
    this.reason = reason
  }
}

// Send one Live Activity push. Resolves on 200; throws ApnsError otherwise
// (410/BadDeviceToken etc. — callers use it to prune dead tokens). One
// short-lived h2 session per call: sends are rare (a few per user action)
// and Vercel functions don't keep sockets warm anyway.
export async function sendLiveActivityPush(
  deviceToken: string,
  push: LiveActivityPush,
): Promise<void> {
  const host = process.env.APNS_SANDBOX
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com'
  const payload = JSON.stringify(buildLiveActivityPayload(push))

  return new Promise((resolve, reject) => {
    const session = connect(host)
    session.on('error', reject)
    const req = session.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${providerJwt()}`,
      'apns-topic': `${BUNDLE_ID}.push-type.liveactivity`,
      'apns-push-type': 'liveactivity',
      'apns-priority': '10',
      'content-type': 'application/json',
    })
    let status = 0
    let body = ''
    req.on('response', (headers) => {
      status = Number(headers[':status'] ?? 0)
    })
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => {
      body += chunk
    })
    req.on('end', () => {
      session.close()
      if (status === 200) return resolve()
      let reason = body
      try {
        reason = (JSON.parse(body) as { reason?: string }).reason ?? body
      } catch {
        // keep raw body
      }
      reject(new ApnsError(status, reason))
    })
    req.on('error', (err) => {
      session.close()
      reject(err)
    })
    req.end(payload)
  })
}

// Stable hash for logging tokens without leaking them.
export const tokenDigest = (token: string): string =>
  createHash('sha256').update(token).digest('hex').slice(0, 8)
