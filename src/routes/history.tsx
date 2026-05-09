import {
  faBackward,
  faForward,
  faHome,
} from '@fortawesome/free-solid-svg-icons'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '../components/Button'
import Hints from '../components/Hints'
import { Loading } from '../components/Loading'
import { Progress } from '../components/Progress'
import { TaskBox } from '../components/TaskBox'
import useKeyAction, { type KeyAction } from '../hooks/useKeyAction'
import { dateString } from '../lib/helpers'
import { useHistoryOpts } from '../lib/mutations'
import type { Task } from '../db/schema'

export const Route = createFileRoute('/history')({
  component: History,
})

function History() {
  const navigate = useNavigate()
  const [daysAgo, setDaysAgo] = useState(0)

  const date = dateString(
    new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate() - daysAgo,
    ),
  )

  const { data, isLoading } = useQuery(useHistoryOpts(date))

  const keyActions: KeyAction[] = [
    { key: 'escape', description: 'Home', action: () => navigate({ to: '/' }) },
  ]
  useKeyAction(keyActions)

  return (
    <>
      <div className="mx-5 my-10 flex h-screen flex-col items-center">
        <Progress />
        <div className="mt-2 flex flex-row flex-wrap justify-center pb-2">
          <Button
            onClick={() => navigate({ to: '/' })}
            icon={faHome}
            text="Home"
          />
        </div>
        <div className="flex justify-center gap-2">
          <Button
            icon={faBackward}
            onClick={() => setDaysAgo((da) => da + 1)}
          />
          <div className="pt-2.5 text-xs text-white">
            {new Date(
              new Date().setDate(new Date().getDate() - daysAgo),
            ).toLocaleDateString()}
          </div>
          <Button
            icon={faForward}
            onClick={() => setDaysAgo((da) => Math.max(0, da - 1))}
          />
        </div>
        {isLoading ? (
          <Loading />
        ) : (
          <div className="mt-2 flex flex-col gap-1">
            {(data ?? []).map((row) => {
              const t = row.taskSnapshot as Task
              return (
                <TaskBox
                  key={row.id}
                  isSelected={false}
                  task={t}
                />
              )
            })}
            {(data ?? []).length === 0 && (
              <div className="text-gray-400">Nothing completed.</div>
            )}
          </div>
        )}
      </div>
      <Hints keyActions={keyActions} />
    </>
  )
}
