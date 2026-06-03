import { Outlet, createFileRoute } from '@tanstack/react-router'

// Thin layout so the detail (index) and edit pages are siblings under
// /tasks/$id — both render full-screen via this Outlet. Without it the
// edit route nested under the detail page with nowhere to render.
export const Route = createFileRoute('/tasks/$id')({
  component: () => <Outlet />,
})
