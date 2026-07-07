import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

import { unselect } from '../../server/lib/actions'
import { getSelection } from '../../server/lib/selection'
import { withAuth } from '../../server/lib/http'

export const Route = createFileRoute('/api/selection')({
  server: {
    handlers: {
      GET: withAuth(async ({ userId }) => json(await getSelection(userId))),
      DELETE: withAuth(async ({ userId }) => json(await unselect(userId))),
    },
  },
})
