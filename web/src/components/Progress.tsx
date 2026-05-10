import {
  faArrowDown,
  faFire,
  faHeart,
  faStar,
} from '@fortawesome/free-solid-svg-icons'
import { useProgressToday } from '@dtn/shared/queries'

import { useDate } from '../hooks/useDate'
import { minutesToHours } from '../lib/time'
import { Tag } from './Tags'

const START_OF_DAY = 8 * 60 + 30 // 8:30 in minutes
const MINUTES_IN_DAY = 24 * 60

export const Progress = () => {
  const now = useDate()
  const progress = useProgressToday()

  if (!progress.data) return null

  const {
    done,
    lives,
    streak,
    streakIsActive,
    todo,
    daysUntilAllDone,
    minutesToReduceTomorrowDays,
  } = progress.data

  const maxTodo = Math.max(todo, minutesToReduceTomorrowDays)

  const timeOfDay = now.getHours() * 60 + now.getMinutes()
  const percentageOfDay = Math.max(
    0,
    Math.min(1, (timeOfDay - START_OF_DAY) / (MINUTES_IN_DAY - START_OF_DAY)),
  )
  const shouldBeDone = maxTodo * percentageOfDay
  const diff = done - shouldBeDone

  const livesUsed = Math.min(lives, Math.max(0, todo - done))
  const livesLeft = lives - livesUsed

  const doneUsingAllLives = Math.min(done, todo - lives)
  const doneUsingLives = Math.min(done, todo)
  const points =
    doneUsingAllLives +
    (doneUsingLives - doneUsingAllLives) * 2 +
    (done - doneUsingLives) * 3

  return (
    <div className="mx-5 flex justify-center">
      <div className="max-w-screen flex flex-col items-center gap-1 text-xs font-light">
        <div className="flex w-full justify-center gap-5 text-white">
          {diff > 0 ? (
            <>{minutesToHours(Math.floor(diff))} ahead of schedule</>
          ) : diff < 0 ? (
            <>{minutesToHours(Math.ceil(-diff))} behind schedule</>
          ) : (
            <>On schedule</>
          )}
        </div>

        <div className="mx-5 flex flex-wrap justify-center gap-5 gap-y-1 text-white">
          <Tag icon={faStar} text={'' + points} />

          <Tag
            icon={faFire}
            text={'' + streak}
            color={streakIsActive ? 'text-amber-500' : 'text-white/50'}
          />

          {livesLeft > 0 ? (
            <Tag
              icon={faHeart}
              text={'' + minutesToHours(livesLeft)}
              color={done >= todo ? 'text-red-400' : 'text-white/50'}
            />
          ) : (
            todo - done - livesUsed > 0 && (
              <Tag
                icon={faFire}
                iconRight
                text={minutesToHours(todo - done - livesUsed) + ' to'}
              />
            )
          )}

          {todo - done > 0 && (
            <Tag
              icon={faHeart}
              iconRight
              text={minutesToHours(todo - done) + ' to'}
            />
          )}

          {minutesToReduceTomorrowDays - done > 0 && (
            <Tag
              icon={faArrowDown}
              iconRight
              text={minutesToHours(minutesToReduceTomorrowDays - done) + ' to'}
            />
          )}

          <Tag
            text={`${daysUntilAllDone} days (${new Date(
              new Date().setDate(now.getDate() + daysUntilAllDone),
            ).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })})`}
          />
        </div>

        <div
          style={{ width: Math.round((144 * todo) / 600) }}
          className="relative mt-0.5 h-2 overflow-hidden rounded-full border border-gray-700"
        >
          <div
            className="h-full rounded-full bg-gray-500"
            style={{
              width: Math.min(((done + livesUsed) / todo) * 100, 100) + '%',
            }}
          />
          <div
            className="-mt-1.5 h-full rounded-full bg-white"
            style={{ width: Math.min((done / todo) * 100, 100) + '%' }}
          />
        </div>
      </div>
    </div>
  )
}
