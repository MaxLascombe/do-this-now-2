import { createFileRoute, redirect } from '@tanstack/react-router'

// The task detail page was retired — the Focus View covers viewing and working
// a task now. Old /tasks/$id links (the page had a "Copy link" button, so some
// exist in the wild) redirect to the task list rather than a blank layout.
export const Route = createFileRoute('/tasks/$id/')({
  beforeLoad: () => {
    throw redirect({ to: '/tasks' })
  },
})
