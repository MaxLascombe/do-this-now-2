import { Outlet, createFileRoute } from '@tanstack/react-router'

// Sibling layout so detail (index) + edit each render full-screen via this Outlet.
export const Route = createFileRoute('/tasks/$id')({
  head: () => ({ meta: [{ title: 'Task · Do This Now' }] }),
  component: () => <Outlet />,
})
