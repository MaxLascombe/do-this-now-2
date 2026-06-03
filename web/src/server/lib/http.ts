import { auth } from '@clerk/tanstack-react-start/server'
import { json } from '@tanstack/react-start'

import { MAX_TZ_OFFSET_MIN } from './validate'

// Uniform error envelope for REST routes.
//   code:    machine-readable identifier ('unauthenticated', 'not_found', 'invalid')
//   message: optional human-readable string
//   details: optional structured payload (e.g. zod issue list for 'invalid')
export type ApiErrorBody = {
  code: string
  message?: string
  details?: unknown
}

export const errorJson = (
  body: ApiErrorBody,
  status: number,
): ReturnType<typeof json> => json(body, { status })

export const unauthenticated = () => errorJson({ code: 'unauthenticated' }, 401)
export const notFound = (message?: string) =>
  errorJson({ code: 'not_found', message }, 404)
export const invalid = (details: unknown) =>
  errorJson({ code: 'invalid', details }, 400)

// Wraps a REST handler with Clerk auth. The wrapped handler receives `userId`
// directly and never has to inline the 401 check. Forwards TanStack Start's
// route ctx (params + request) through unchanged.
type RouteCtx<TParams> = { params: TParams; request: Request }
export function withAuth<TParams = Record<string, never>>(
  handler: (
    ctx: { userId: string } & RouteCtx<TParams>,
  ) => Promise<Response> | Response,
) {
  return async (ctx: RouteCtx<TParams>) => {
    const { userId } = await auth()
    if (!userId) return unauthenticated()
    return handler({ userId, ...ctx })
  }
}

// Read the user's TZ offset (minutes west of UTC, matching
// Date.prototype.getTimezoneOffset()) from the request header set by the
// client adapter. Falls back to 0 (UTC) when missing or out of range —
// server-side day
// boundaries will be wrong, so this is a soft failure rather than a hard 400.
// If we want stricter, switch to throwing invalid().
export function getTzFromRequest(request: Request): number {
  const v = request.headers.get('x-tz-offset')
  if (v === null) return 0
  const n = parseInt(v, 10)
  if (Number.isNaN(n) || n < -MAX_TZ_OFFSET_MIN || n > MAX_TZ_OFFSET_MIN)
    return 0
  return n
}
