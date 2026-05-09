import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  return (
    <div className="flex h-screen items-center justify-center text-gray-400">
      Home — coming up
    </div>
  )
}
