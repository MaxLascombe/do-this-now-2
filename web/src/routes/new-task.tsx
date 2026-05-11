import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { Button } from '../components/Button'
import { Loading } from '../components/Loading'
import TaskForm from '../components/TaskForm'
import { useCreateTask } from '@dtn/shared/queries'

export const Route = createFileRoute('/new-task')({
  component: NewTask,
})

function NewTask() {
  const router = useRouter()
  const mutation = useCreateTask()

  return (
    <div className="space-y-8 divide-y divide-gray-700 p-10 text-white">
      {mutation.isPending && (
        <div className="fixed inset-0 flex h-screen flex-col justify-center bg-gray-800 opacity-90">
          <Loading />
        </div>
      )}
      <div className="space-y-8 divide-y divide-gray-700 sm:space-y-5">
        <div>
          <div className="flex">
            <Button onClick={() => router.history.back()} icon={faArrowLeft} />
            <h3 className="ml-2 pt-1 text-lg font-medium">New Task</h3>
          </div>
          {!!mutation.error && (
            <div className="mt-4 text-red-500">
              {mutation.error.message ?? 'Something went wrong.'}
            </div>
          )}
          <TaskForm
            submitForm={(input) =>
              mutation.mutate(input, {
                onSuccess: () => router.history.back(),
              })
            }
          />
        </div>
      </div>
    </div>
  )
}
