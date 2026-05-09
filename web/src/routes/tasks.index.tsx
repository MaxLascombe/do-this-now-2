import {
  faArrowDown,
  faCheckCircle,
  faHome,
  faPen,
  faPlusCircle,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import { Fragment, useRef, useState } from 'react'

import { Button } from '../components/Button'
import Hints from '../components/Hints'
import { Loading } from '../components/Loading'
import { Progress } from '../components/Progress'
import { TaskBox } from '../components/TaskBox'
import useDing from '../hooks/useDing'
import useKeyAction, { type KeyAction } from '../hooks/useKeyAction'
import { newSafeDate } from '../lib/helpers'
import {
  useAllTasks,
  useCompleteTask,
  useDeleteTask,
  useTopTasks,
} from '../lib/mutations'
import { sortTasks } from '../lib/task-sorting'

export const Route = createFileRoute('/tasks/')({
  component: TasksList,
})

function TasksList() {
  const navigate = useNavigate()
  const ding = useDing()
  const [selectedTask, setSelectedTask] = useState(0)
  const [sort, setSort] = useState<'CHRON' | 'TOP'>('CHRON')
  const taskElems = useRef<HTMLElement[]>([])

  const allTasksOpts = useAllTasks()
  const allTasks = useQuery(allTasksOpts)
  const topTasksOpts = useTopTasks()
  const topTasks = useQuery(topTasksOpts)

  const data = allTasks.data ?? []
  const dataTop = topTasks.data ?? []

  let tasks = sort === 'CHRON' ? [...data] : [...dataTop]

  if (sort === 'CHRON') {
    tasks.sort((a, b) =>
      a.due === 'No Due Date'
        ? -1
        : b.due === 'No Due Date'
          ? 1
          : newSafeDate(a.due).getTime() - newSafeDate(b.due).getTime(),
    )
  } else {
    const today = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
    )
    sortTasks(tasks, today)
  }

  const doneMutation = useCompleteTask()
  const deleteMutation = useDeleteTask()

  const completeAction = () => {
    if (!tasks[selectedTask]) return
    ding()
    doneMutation.mutate(tasks[selectedTask].id)
  }

  const scrollIntoView = (elem?: HTMLElement) => {
    if (!elem) return
    window.scrollTo({
      behavior: 'smooth',
      top:
        elem.getBoundingClientRect().top -
        document.body.getBoundingClientRect().top -
        200,
    })
  }

  const keyActions: KeyAction[] = [
    { key: 'd', description: 'Mark task as done', action: completeAction },
    {
      key: 'n',
      description: 'New task',
      action: () => navigate({ to: '/new-task' }),
    },
    {
      key: 'o',
      description: 'Toggle order between date and top',
      action: () => setSort((s) => (s === 'CHRON' ? 'TOP' : 'CHRON')),
    },
    {
      key: 'u',
      description: 'Update task',
      action: () => {
        if (!tasks[selectedTask]) return
        navigate({
          to: '/tasks/$id/edit',
          params: { id: tasks[selectedTask].id },
        })
      },
    },
    {
      key: 'up',
      description: 'Select previous task',
      action: () => {
        setSelectedTask(Math.max(selectedTask - 1, 0))
        scrollIntoView(taskElems.current[selectedTask - 1])
      },
    },
    {
      key: 'down',
      description: 'Select next task',
      action: () => {
        setSelectedTask(Math.min(selectedTask + 1, tasks.length - 1))
        scrollIntoView(taskElems.current[selectedTask + 1])
      },
    },
    {
      key: 'Escape',
      description: 'Home',
      action: () => navigate({ to: '/' }),
    },
    {
      key: 'Backspace',
      description: 'Delete current task',
      action: () => {
        const t = tasks[selectedTask]
        if (!t) return
        if (window.confirm(`Are you sure you want to delete '${t.title}'?`))
          deleteMutation.mutate(t.id)
      },
    },
  ]
  useKeyAction(keyActions)

  const formatDate = (date: Date) => {
    try {
      return format(
        new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate() + 1,
          0,
          0,
          0,
        ),
        'EEEE, LLLL do, u',
      )
    } catch (e) {
      console.error(e)
      return date.toDateString()
    }
  }

  const firstTaskDueAfterToday = tasks.findIndex(
    (task) => newSafeDate(task.due) > new Date(),
  )
  const firstSnoozedTask = tasks.findIndex(
    (task) => task.snooze && new Date(task.snooze) > new Date(),
  )

  return (
    <div className="flex h-screen flex-col">
      <div className="flex flex-col gap-4 py-4">
        <Progress />
        <div className="flex flex-row flex-wrap justify-center">
          <Button
            onClick={() => navigate({ to: '/' })}
            icon={faHome}
            text="Home"
          />
          <Button
            onClick={() => navigate({ to: '/new-task' })}
            icon={faPlusCircle}
            text="New Task"
          />
          <Button
            onClick={() => setSort((s) => (s === 'CHRON' ? 'TOP' : 'CHRON'))}
            icon={faArrowDown}
            text="Toggle Order"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-5 flex flex-col items-center gap-1">
          {sort === 'CHRON' ? (
            Object.entries(
              tasks.reduce<Record<string, typeof tasks>>((groups, task) => {
                const date = formatDate(newSafeDate(task.due))
                if (!groups[date]) groups[date] = []
                groups[date].push(task)
                return groups
              }, {}),
            ).map(([date, dateTasks]) => (
              <div key={date} className="flex w-full flex-col items-center">
                <div
                  className={
                    (newSafeDate(dateTasks[0].due) <
                    new Date(
                      new Date().getFullYear(),
                      new Date().getMonth(),
                      new Date().getDate(),
                      0,
                      0,
                      0,
                    )
                      ? 'text-orange-300'
                      : 'text-white') +
                    ' sticky top-0 w-full bg-black py-2 text-center text-sm md:max-w-sm'
                  }
                >
                  {newSafeDate(dateTasks[0].due).toDateString()}
                </div>
                <div className="flex w-full flex-col items-center gap-1">
                  {dateTasks.map((task) => (
                    <Fragment key={task.id}>
                      <TaskBox
                        innerRef={(e: HTMLButtonElement) => {
                          taskElems.current[tasks.indexOf(task)] = e
                        }}
                        isSelected={tasks.indexOf(task) === selectedTask}
                        onClick={() => setSelectedTask(tasks.indexOf(task))}
                        task={task}
                      />
                      {tasks.indexOf(task) === selectedTask && (
                        <ActionRow
                          completeAction={completeAction}
                          editAction={() =>
                            navigate({
                              to: '/tasks/$id/edit',
                              params: { id: task.id },
                            })
                          }
                          deleteAction={() =>
                            window.confirm(
                              `Are you sure you want to delete '${task.title}'?`,
                            ) && deleteMutation.mutate(task.id)
                          }
                          completing={
                            doneMutation.isPending &&
                            doneMutation.variables === task.id
                          }
                          deleting={
                            deleteMutation.isPending &&
                            deleteMutation.variables === task.id
                          }
                        />
                      )}
                    </Fragment>
                  ))}
                </div>
              </div>
            ))
          ) : (
            tasks.map((task, i) => (
              <Fragment key={task.id}>
                {i === firstTaskDueAfterToday && (
                  <div className="sticky top-0 w-full bg-black py-2 text-center text-sm text-white md:max-w-sm">
                    Due after today
                  </div>
                )}
                {i === firstSnoozedTask && (
                  <div className="sticky top-0 w-full bg-black py-2 text-center text-sm text-white md:max-w-sm">
                    Snoozed
                  </div>
                )}
                <TaskBox
                  innerRef={(e: HTMLButtonElement) => {
                    taskElems.current[i] = e
                  }}
                  isSelected={i === selectedTask}
                  onClick={() => setSelectedTask(i)}
                  task={task}
                />
                {i === selectedTask && (
                  <ActionRow
                    completeAction={completeAction}
                    editAction={() =>
                      navigate({
                        to: '/tasks/$id/edit',
                        params: { id: task.id },
                      })
                    }
                    deleteAction={() =>
                      window.confirm(
                        `Are you sure you want to delete '${task.title}'?`,
                      ) && deleteMutation.mutate(task.id)
                    }
                    completing={
                      doneMutation.isPending &&
                      doneMutation.variables === task.id
                    }
                    deleting={
                      deleteMutation.isPending &&
                      deleteMutation.variables === task.id
                    }
                  />
                )}
              </Fragment>
            ))
          )}
          {((sort === 'CHRON' && allTasks.isFetching) ||
            (sort === 'TOP' && topTasks.isFetching)) && <Loading />}
        </div>
        <Hints keyActions={keyActions} />
      </div>
    </div>
  )
}

const ActionRow = ({
  completeAction,
  editAction,
  deleteAction,
  completing,
  deleting,
}: {
  completeAction: () => void
  editAction: () => void
  deleteAction: () => void
  completing: boolean
  deleting: boolean
}) => (
  <div className="flex flex-row flex-wrap justify-center py-2">
    <Button
      text="Complete"
      icon={faCheckCircle}
      onClick={completeAction}
      loading={completing}
    />
    <Button text="Update" icon={faPen} onClick={editAction} />
    <Button
      text="Delete"
      icon={faTrash}
      onClick={deleteAction}
      loading={deleting}
    />
  </div>
)
