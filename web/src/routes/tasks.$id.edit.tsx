import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { useTask, useUpdateTask } from '@dtn/shared/queries'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { Button } from '../components/Button'
import { Loading } from '../components/Loading'
import TaskForm, { type TaskFormInput } from '../components/TaskForm'
import { newSafeDate } from '../lib/helpers'

export const Route = createFileRoute('/tasks/$id/edit')({
  component: EditTask,
})

function EditTask() {
  const { id } = Route.useParams()
  const router = useRouter()
  const taskQuery = useTask(id)
  const mutation = useUpdateTask()

  const task = taskQuery.data

  if (taskQuery.isPending || !task) {
    return (
      <div className="absolute inset-0 flex h-screen flex-col justify-center bg-gray-800 opacity-90">
        <Loading />
      </div>
    )
  }

  const dueDate = newSafeDate(task.due)

  return (
    <div className="space-y-8 divide-y divide-gray-700 p-10 text-white">
      <div>
        <div className="flex">
          <Button onClick={() => router.history.back()} icon={faArrowLeft} />
          <h3 className="ml-2 pt-1 text-lg font-medium">
            Update Task: {task.title}
          </h3>
        </div>
        <TaskForm
          title={task.title}
          dueMonth={dueDate.getMonth() + 1}
          dueDay={dueDate.getDate()}
          dueYear={dueDate.getFullYear()}
          strictDeadline={task.strictDeadline}
          repeat={task.repeat}
          repeatInterval={task.repeatInterval}
          repeatUnit={task.repeatUnit}
          repeatWeekdays={task.repeatWeekdays}
          timeFrame={task.timeFrame}
          subtasks={task.subtasks}
          submitForm={(input: TaskFormInput) => {
            const due = `${input.dueYear}-${input.dueMonth}-${input.dueDay}`
            mutation.mutate(
              {
                id,
                input: {
                  title: input.title,
                  due,
                  strictDeadline: input.strictDeadline,
                  repeat: input.repeat,
                  repeatInterval: input.repeatInterval,
                  repeatUnit: input.repeatUnit,
                  repeatWeekdays: input.repeatWeekdays,
                  timeFrame: Number(input.timeFrame),
                  subtasks: input.subtasks,
                },
              },
              { onSuccess: () => router.history.back() },
            )
          }}
          isSaving={mutation.isPending}
        />
      </div>
    </div>
  )
}
