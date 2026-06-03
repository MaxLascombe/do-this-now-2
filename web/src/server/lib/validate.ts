import { z } from 'zod'

import { ymdSchema } from '@dtn/shared/task-input'

/**
 * Server-fn inputValidator helper.
 *
 * `createServerFn().inputValidator((d: unknown) => schema.parse(d))` repeats
 * the same boilerplate at every server-fn. `validate(schema)` returns the
 * same callable in one expression while preserving the parsed type.
 *
 *   .inputValidator(validate(z.object({ id: v.id, tzOffsetMin: v.tzOffsetMin })))
 */
export const validate =
  <S extends z.ZodTypeAny>(schema: S) =>
  (d: unknown): z.infer<S> =>
    schema.parse(d)

/**
 * Atomic zod schemas reused across server-fn inputs. Compose into shapes:
 *
 *   z.object({ id: v.id })
 *   z.object({ id: v.id, tzOffsetMin: v.tzOffsetMin })
 */
// Real-world UTC offsets span UTC-12..UTC+14, i.e. -840..+720 minutes west
// of UTC; 840 is a symmetric bound that covers every valid zone.
export const MAX_TZ_OFFSET_MIN = 840

export const v = {
  id: z.string().uuid(),
  tzOffsetMin: z.number().int().min(-MAX_TZ_OFFSET_MIN).max(MAX_TZ_OFFSET_MIN),
  ymd: ymdSchema,
} as const
