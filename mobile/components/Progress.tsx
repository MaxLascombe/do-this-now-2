import {
  faArrowDown,
  faFire,
  faHeart,
  faStar,
} from '@fortawesome/free-solid-svg-icons'
import { Text, View } from 'react-native'

import { minutesToHours } from '@dtn/shared/time'
import { useDate } from '../hooks/useDate'
import { useProgressToday } from '../lib/queries'
import { Tag } from './Tags'

const START_OF_DAY = 8 * 60 + 30
const MINUTES_IN_DAY = 24 * 60

export function Progress() {
  const now = useDate()
  const { data } = useProgressToday()
  if (!data) return null

  const {
    done,
    lives,
    streak,
    streakIsActive,
    todo,
    daysUntilAllDone,
    minutesToReduceTomorrowDays,
  } = data

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
    <View className="mx-5 items-center gap-1">
      <Text className="text-xs font-light text-white">
        {diff > 0
          ? `${minutesToHours(Math.floor(diff))} ahead of schedule`
          : diff < 0
            ? `${minutesToHours(Math.ceil(-diff))} behind schedule`
            : 'On schedule'}
      </Text>
      <View className="mx-5 flex-row flex-wrap justify-center gap-y-1">
        <Tag icon={faStar} text={'' + points} />
        <Tag
          icon={faFire}
          text={'' + streak}
          color={streakIsActive ? '#f59e0b' : 'rgba(255,255,255,0.5)'}
        />
        {livesLeft > 0 ? (
          <Tag
            icon={faHeart}
            text={'' + minutesToHours(livesLeft)}
            color={done >= todo ? '#f87171' : 'rgba(255,255,255,0.5)'}
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
      </View>
      <View
        style={{ width: Math.round((144 * todo) / 600) }}
        className="mt-0.5 h-2 overflow-hidden rounded-full border border-gray-700"
      >
        <View
          className="h-full rounded-full bg-gray-500"
          style={{ width: `${Math.min(((done + livesUsed) / todo) * 100, 100)}%` }}
        />
        <View
          className="-mt-1.5 h-full rounded-full bg-white"
          style={{ width: `${Math.min((done / todo) * 100, 100)}%` }}
        />
      </View>
    </View>
  )
}
