import { useDeleteTask, useTask, useUpdateTask } from '@dtn/shared/queries'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { Loading } from '../components/Loading'
import { MobileChrome } from '../components/MobileChrome'
import { PageHeading } from '../components/PageHeading'
import TaskForm from '../components/TaskForm'
import { TopBar } from '../components/TopBar'

export const Route = createFileRoute('/tasks/$id/edit')({
  component: EditTask,
})

function EditTask() {
  const { id } = Route.useParams()
  const router = useRouter()
  const taskQuery = useTask(id)
  const mutation = useUpdateTask()
  const deleteMutation = useDeleteTask()
  const [sheetOpen, setSheetOpen] = useState(false)

  const task = taskQuery.data

  if (taskQuery.isPending || !task) {
    return (
      <div className="flex min-h-screen flex-col">
        <TopBar />
        <MobileChrome
          sheetOpen={sheetOpen}
          onOpenSheet={() => setSheetOpen(true)}
          onCloseSheet={() => setSheetOpen(false)}
        />
        <div className="flex flex-1 items-center justify-center">
          <Loading />
        </div>
      </div>
    )
  }

  const onDelete = () => {
    if (!window.confirm(`Are you sure you want to delete '${task.title}'?`))
      return
    deleteMutation.mutate(task.id, {
      onSuccess: () => router.history.back(),
    })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <MobileChrome
        sheetOpen={sheetOpen}
        onOpenSheet={() => setSheetOpen(true)}
        onCloseSheet={() => setSheetOpen(false)}
      />

      <div className="flex items-end justify-between px-5 pt-2 pb-6 md:px-10">
        <PageHeading eyebrow="editing task">Edit task</PageHeading>
        <button
          type="button"
          onClick={() => router.history.back()}
          className="hidden items-center gap-2 rounded-full border border-zinc-800 px-3 py-1.5 font-mono text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-50 md:flex"
        >
          <span>←</span>
          <span>Back</span>
          <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-[10px] font-bold text-zinc-300">
            Esc
          </kbd>
        </button>
      </div>

      <TaskForm
        title={task.title}
        emoji={task.emoji}
        due={task.due}
        dueTime={task.dueTime}
        strictDeadline={task.strictDeadline}
        repeat={task.repeat}
        repeatInterval={task.repeatInterval}
        repeatUnit={task.repeatUnit}
        repeatWeekdays={task.repeatWeekdays}
        timeFrame={task.timeFrame}
        subtasks={task.subtasks}
        isEdit
        isSaving={mutation.isPending}
        errorMessage={mutation.error?.message ?? null}
        onCancel={() => router.history.back()}
        onDelete={onDelete}
        submitForm={(input) =>
          mutation.mutate(
            { id, input },
            { onSuccess: () => router.history.back() },
          )
        }
      />
    </div>
  )
}
