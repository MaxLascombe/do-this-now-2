import {
  faArrowDown,
  faChevronDown,
  faFire,
  faHeart,
  faStar,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import {
  MINUTES_IN_DAY,
  START_OF_DAY_MINUTES,
  minutesToHours,
} from '@dtn/shared/time'
import { useDate } from '../hooks/useDate'
import { useProgressToday } from '@dtn/shared/queries'
import { Tag } from './Tags'

export function Progress() {
  const now = useDate()
  const { data } = useProgressToday()
  const [open, setOpen] = useState(false)

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
    Math.min(
      1,
      (timeOfDay - START_OF_DAY_MINUTES) /
        (MINUTES_IN_DAY - START_OF_DAY_MINUTES),
    ),
  )
  const shouldBeDone = maxTodo * percentageOfDay
  const diff = done - shouldBeDone
  const livesUsed = Math.min(lives, Math.max(0, todo - done))
  const donePct = Math.min((done / todo) * 100, 100)
  const usedPct = Math.min(((done + livesUsed) / todo) * 100, 100)

  const summary =
    diff > 0
      ? `${minutesToHours(Math.floor(diff))} ahead`
      : diff < 0
        ? `${minutesToHours(Math.ceil(-diff))} behind`
        : 'On schedule'

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center gap-3 px-2 py-1"
      >
        <FontAwesomeIcon
          icon={faFire}
          size={14}
          color={streakIsActive ? '#f59e0b' : '#6b7280'}
        />
        <Text className="text-sm text-white">{streak}</Text>
        <View className="h-1.5 w-32 overflow-hidden rounded-full bg-gray-800">
          <View
            className="h-full bg-gray-500"
            style={{ width: `${usedPct}%` }}
          />
          <View
            className="-mt-1.5 h-full bg-white"
            style={{ width: `${donePct}%` }}
          />
        </View>
        <Text className="text-xs text-gray-400">{summary}</Text>
        <FontAwesomeIcon icon={faChevronDown} size={10} color="#6b7280" />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <ProgressDetail data={data} now={now} onClose={() => setOpen(false)} />
      </Modal>
    </>
  )
}

function ProgressDetail({
  data,
  now,
  onClose,
}: {
  data: NonNullable<ReturnType<typeof useProgressToday>['data']>
  now: Date
  onClose: () => void
}) {
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
    Math.min(
      1,
      (timeOfDay - START_OF_DAY_MINUTES) /
        (MINUTES_IN_DAY - START_OF_DAY_MINUTES),
    ),
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
    <SafeAreaView className="flex-1 bg-black">
      <View className="flex-row items-center justify-between border-b border-gray-900 px-4 py-3">
        <Text className="text-lg font-semibold text-white">
          Today&apos;s progress
        </Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <FontAwesomeIcon icon={faXmark} size={20} color="#9ca3af" />
        </Pressable>
      </View>

      <View className="px-4 py-6">
        <Text className="mb-2 text-center text-sm text-white">
          {diff > 0
            ? `${minutesToHours(Math.floor(diff))} ahead of schedule`
            : diff < 0
              ? `${minutesToHours(Math.ceil(-diff))} behind schedule`
              : 'On schedule'}
        </Text>

        <View className="mt-3 h-3 overflow-hidden rounded-full border border-gray-700">
          <View
            className="h-full bg-gray-500"
            style={{
              width: `${Math.min(((done + livesUsed) / todo) * 100, 100)}%`,
            }}
          />
          <View
            className="-mt-3 h-full rounded-full bg-white"
            style={{ width: `${Math.min((done / todo) * 100, 100)}%` }}
          />
        </View>

        <View className="mt-6 flex-row flex-wrap justify-center gap-x-5 gap-y-2">
          <Tag icon={faStar} text={'' + points} />
          <Tag
            icon={faFire}
            text={'' + streak}
            color={streakIsActive ? '#f59e0b' : 'rgba(255,255,255,0.5)'}
          />
          {livesLeft > 0 ? (
            <Tag
              icon={faHeart}
              text={minutesToHours(livesLeft)}
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
              text={
                minutesToHours(minutesToReduceTomorrowDays - done) + ' to'
              }
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
      </View>
    </SafeAreaView>
  )
}
