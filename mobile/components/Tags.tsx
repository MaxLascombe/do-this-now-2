import {
  faCalendar,
  faCircleExclamation,
  faClock,
  faRepeat,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { Text, View } from 'react-native'

import { formatDueLabel, formatRepeat } from '@dtn/shared/format'
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

export function DateTag({
  due,
  dueTime,
}: {
  due: string
  dueTime?: string | null
}) {
  const text = formatDueLabel(due, dueTime)
  if (!text) return null
  return <Tag text={text} icon={dueTime ? faClock : faCalendar} />
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
