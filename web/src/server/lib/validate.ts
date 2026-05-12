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
export const v = {
  id: z.string().uuid(),
  tzOffsetMin: z.number().int(),
  ymd: ymdSchema,
} as const
