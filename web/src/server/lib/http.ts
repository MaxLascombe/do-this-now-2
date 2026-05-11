import { json } from '@tanstack/react-start'

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

export const unauthenticated = () =>
  errorJson({ code: 'unauthenticated' }, 401)
export const notFound = (message?: string) =>
  errorJson({ code: 'not_found', message }, 404)
export const invalid = (details: unknown) =>
  errorJson({ code: 'invalid', details }, 400)
