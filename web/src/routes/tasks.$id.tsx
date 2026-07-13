import { Outlet, createFileRoute } from '@tanstack/react-router'

// Layout for the /tasks/$id branch. The detail page is retired, so the only
// real child is `edit`; the index is a redirect stub.
export const Route = createFileRoute('/tasks/$id')({
  head: () => ({ meta: [{ title: 'Task · Do This Now' }] }),
  component: () => <Outlet />,
})
