import {
  faCalendar,
  faCircleExclamation,
  faClock,
  faRepeat,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { format } from 'date-fns'
import { Text, View } from 'react-native'

import { formatRepeat } from '@dtn/shared/format'
import { newSafeDate } from '@dtn/shared/helpers'
import { minutesToHours } from '@dtn/shared/time'

export function Tag({
  icon,
  text,
  color,
  iconRight = false,
}: {
  icon?: typeof faCalendar
  text: string
  color?: string
  iconRight?: boolean
}) {
  return (
    <View className="mr-3 flex-row items-center gap-1">
      {!iconRight && icon && (
        <FontAwesomeIcon icon={icon} size={10} color={color ?? '#9ca3af'} />
      )}
      <Text className="text-xs font-light text-gray-400">{text}</Text>
      {iconRight && icon && (
        <FontAwesomeIcon icon={icon} size={10} color={color ?? '#9ca3af'} />
      )}
    </View>
  )
}

export function DateTag({ due }: { due: string }) {
  if (due === 'No Due Date') return null
  try {
    const dueDate = newSafeDate(due)
    const today = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
    )
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const text =
      dueDate.getTime() === today.getTime()
        ? 'Today'
        : dueDate.getTime() === tomorrow.getTime()
          ? 'Tomorrow'
          : dueDate.getTime() === yesterday.getTime()
            ? 'Yesterday'
            : format(dueDate, 'iii LLL d')
    return <Tag text={text} icon={faCalendar} />
  } catch {
    return null
  }
}

export function TimeFrame({ timeFrame }: { timeFrame?: number }) {
  if (!timeFrame) return null
  return <Tag icon={faClock} text={minutesToHours(timeFrame)} />
}

export function Repeat({
  repeat,
  repeatInterval,
  repeatUnit,
  repeatWeekdays,
}: {
  repeat: string
  repeatInterval: number
  repeatUnit: string
  repeatWeekdays: readonly boolean[]
}) {
  const text = formatRepeat(repeat, repeatInterval, repeatUnit, repeatWeekdays)
  if (!text) return null
  return <Tag icon={faRepeat} text={text} />
}

export function Strict({ strictDeadline }: { strictDeadline?: boolean }) {
  if (!strictDeadline) return null
  return <Tag icon={faCircleExclamation} text="strict" />
}
