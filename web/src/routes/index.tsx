import {
  faBackward,
  faBars,
  faBell,
  faChartLine,
  faCheckCircle,
  faPen,
  faPlusCircle,
  faRightFromBracket,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { useClerk } from '@clerk/tanstack-react-start'
import {
  useCompleteTask,
  useDeleteTask,
  usePrefetchTask,
  usePrimeTaskCache,
  useSnoozeTask,
  useTopTasks,
} from '@dtn/shared/queries'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Fragment, useState } from 'react'

import { Button } from '../components/Button'
import Hints from '../components/Hints'
import { LastUpdated } from '../components/LastUpdated'
import { Loading } from '../components/Loading'
import { Progress } from '../components/Progress'
import { TaskBox } from '../components/TaskBox'
import useDing from '../hooks/useDing'
import useKeyAction, { type KeyAction } from '../hooks/useKeyAction'
import { isSnoozed } from '@dtn/shared/task-sorting'

export const Route = createFileRoute('/')({
  component: Home,
})

function Home() {
  const navigate = useNavigate()
  const ding = useDing()
  const { signOut } = useClerk()
  const topTasksQuery = useTopTasks()

  const tasks = (topTasksQuery.data ?? []).filter((t) => !isSnoozed(t))

  const [selectedTaskIndex, setSelectedTaskIndex] = useState<0 | 1 | 2>(0)
  const selectedTask =
    tasks.length > selectedTaskIndex ? tasks[selectedTaskIndex] : tasks[0]

  if (tasks.length > 0 && tasks.length <= selectedTaskIndex)
    setSelectedTaskIndex(tasks.length === 2 ? 1 : 0)

  const doneMutation = useCompleteTask()
  const deleteMutation = useDeleteTask()
  const snoozeMutation = useSnoozeTask()
  const prefetchTask = usePrefetchTask()
  const primeTaskCache = usePrimeTaskCache()

  const completeTaskAction = () => {
    if (!selectedTask) return
    ding()
    doneMutation.mutate(selectedTask.id)
  }

  const snoozeTaskAction = () => {
    if (!selectedTask) return
    snoozeMutation.mutate({ id: selectedTask.id })
  }

  const snoozeAllSubtasksAction = () => {
    if (!selectedTask) return
    snoozeMutation.mutate({ id: selectedTask.id, allSubtasks: true })
  }

  const deleteTaskAction = () => {
    if (!selectedTask) return
    if (
      !window.confirm(
        `Are you sure you want to delete '${selectedTask.title}'?`,
      )
    )
      return
    deleteMutation.mutate(selectedTask.id)
  }

  const goEdit = () => {
    if (!selectedTask) return
    primeTaskCache(selectedTask)
    navigate({ to: '/tasks/$id/edit', params: { id: selectedTask.id } })
  }

  const keyActions: KeyAction[] = [
    { key: 'd', description: 'Task done', action: completeTaskAction },
    {
      key: 'h',
      description: 'History',
      action: () => navigate({ to: '/history' }),
    },
    {
      key: 'a',
      description: 'Stats',
      action: () => navigate({ to: '/stats' }),
    },
    { key: 'l', description: 'Logout', action: () => signOut() },
    {
      key: 'n',
      description: 'New task',
      action: () => navigate({ to: '/new-task' }),
    },
    {
      key: 's',
      description: 'Snooze task',
      action: snoozeTaskAction,
      shift: false,
    },
    {
      key: 'S',
      description: 'Snooze all subtasks',
      action: snoozeAllSubtasksAction,
      shift: true,
    },
    {
      key: 't',
      description: 'Tasks',
      action: () => navigate({ to: '/tasks' }),
    },
    { key: 'u', description: 'Update task', action: goEdit },
    {
      key: '1',
      description: 'Select first task',
      action: () => setSelectedTaskIndex(0),
    },
    {
      key: '2',
      description: 'Select second task',
      action: () => setSelectedTaskIndex(1),
    },
    {
      key: '3',
      description: 'Select third task',
      action: () => setSelectedTaskIndex(2),
    },
    {
      key: 'up',
      description: 'Select previous task',
      action: () =>
        setSelectedTaskIndex((idx) => (idx === 2 ? 1 : 0) as 0 | 1 | 2),
    },
    {
      key: 'down',
      description: 'Select next task',
      action: () =>
        setSelectedTaskIndex((idx) => (idx === 0 ? 1 : 2) as 0 | 1 | 2),
    },
    {
      key: 'backspace',
      description: 'Delete current task',
      action: deleteTaskAction,
    },
  ]
  useKeyAction(keyActions)

  type ButtonInfo = [
    () => void,
    string | undefined,
    typeof faBackward,
    boolean?,
  ]
  const ActionButtons = () => {
    const info: ButtonInfo[] = [
      [
        completeTaskAction,
        'Complete',
        faCheckCircle,
        doneMutation.isPending && doneMutation.variables === selectedTask?.id,
      ],
      [snoozeTaskAction, 'Snooze', faBell],
      [goEdit, undefined, faPen],
      [
        deleteTaskAction,
        undefined,
        faTrash,
        deleteMutation.isPending &&
          deleteMutation.variables === selectedTask?.id,
      ],
    ]
    if (selectedTask && selectedTask.subtasks.length > 0)
      info.splice(2, 0, [snoozeAllSubtasksAction, 'Snooze all subtasks', faBell])

    return (
      <>
        {info.map(([func, text, icon, loading], i) => (
          <Button
            key={i}
            onClick={func}
            text={text}
            icon={icon}
            loading={loading}
          />
        ))}
      </>
    )
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2">
      {topTasksQuery.isPending || deleteMutation.isPending ? (
        <Loading />
      ) : (
        <>
          <Progress />
          <div className="mx-5 mt-1 flex flex-row flex-wrap justify-center">
            <Button
              onClick={() => navigate({ to: '/tasks' })}
              text="All tasks"
              icon={faBars}
            />
            <Button
              onClick={() => navigate({ to: '/new-task' })}
              text="New task"
              icon={faPlusCircle}
            />
            <Button
              onClick={() => navigate({ to: '/history' })}
              text="History"
              icon={faBackward}
            />
            <Button
              onClick={() => navigate({ to: '/stats' })}
              text="Stats"
              icon={faChartLine}
            />
          </div>
          {tasks.length > 0 ? (
            tasks.slice(0, 3).map((task, i) => (
              <Fragment key={task.id}>
                <TaskBox
                  isSelected={selectedTaskIndex === i}
                  onClick={() => {
                    primeTaskCache(task)
                    if (i === 0 || i === 1 || i === 2)
                      setSelectedTaskIndex(i as 0 | 1 | 2)
                  }}
                  onMouseEnter={() => prefetchTask(task.id)}
                  task={task}
                  title={`(Shortcut: ${i + 1})`}
                />
                {selectedTaskIndex === i && (
                  <div className="mx-5 flex flex-row flex-wrap justify-center">
                    <ActionButtons />
                  </div>
                )}
              </Fragment>
            ))
          ) : (
            <div className="text-gray-400">No tasks</div>
          )}
          <LastUpdated query={topTasksQuery} />
        </>
      )}
      <Hints keyActions={keyActions} />
      <div className="fixed right-5 bottom-5">
        <Button
          icon={faRightFromBracket}
          onClick={() => signOut()}
          text="Log out"
        />
      </div>
    </div>
  )
}

// Suppress unused-link warning when first wired up; will be replaced by usage.
void Link
