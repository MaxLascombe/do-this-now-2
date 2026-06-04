import { useDeleteTask, useTask, useUpdateTask } from '@dtn/shared/queries'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'

import { useConfirm } from '../components/ConfirmProvider'
import { ErrorState } from '../components/ErrorState'
import { Loading } from '../components/Loading'
import { MobileChrome } from '../components/MobileChrome'
import { PageHeading } from '../components/PageHeading'
import TaskForm from '../components/TaskForm'
import { TimerWidget } from '../components/TimerWidget'
import { TopBar } from '../components/TopBar'

export const Route = createFileRoute('/tasks/$id/edit')({
  head: () => ({ meta: [{ title: 'Edit Task · Do This Now' }] }),
  component: EditTask,
})

function EditTask() {
  const { id } = Route.useParams()
  const router = useRouter()
  const taskQuery = useTask(id)
  const mutation = useUpdateTask()
  const deleteMutation = useDeleteTask()
  const confirm = useConfirm()
  const [sheetOpen, setSheetOpen] = useState(false)

  const task = taskQuery.data
  // If this is a 0-time-frame child, its timer state actually lives on
  // the keeper. Load the keeper so the widget displays + mutates the
  // right row. Plain tasks just use their own row.
  const keeperQuery = useTask(task?.timekeeperId ?? '')
  const timerTask = task?.timekeeperId ? keeperQuery.data : task

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
          {taskQuery.isPending ? (
            <Loading />
          ) : taskQuery.isError ? (
            <ErrorState
              message="Couldn't load this task."
              onRetry={() => taskQuery.refetch()}
            />
          ) : (
            <ErrorState message="Task not found." />
          )}
        </div>
      </div>
    )
  }

  const onDelete = async () => {
    const ok = await confirm({
      message: `Are you sure you want to delete '${task.title}'?`,
      confirmLabel: 'Delete',
    })
    if (!ok) return
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

      {timerTask && (
        <div className="mx-auto w-full max-w-2xl px-5 pb-6 md:px-10">
          <TimerWidget
            task={timerTask}
            actionId={id}
            plannedMinutes={timerTask.timeFrame}
            compact
          />
        </div>
      )}

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
        timekeeperId={task.timekeeperId}
        timeframeType={task.timeframeType}
        subtasks={task.subtasks}
        notes={task.notes}
        tags={task.tags}
        isEdit
        taskId={id}
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
