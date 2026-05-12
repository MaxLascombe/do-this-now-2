import {
  faCalendar,
  faCircleExclamation,
  faClock,
  faRepeat,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { formatDueLabel, formatRepeat } from '@dtn/shared/format'
import { minutesToHours } from '@dtn/shared/time'

export const Tag = ({
  icon,
  text,
  color,
  iconRight = false,
}: {
  icon?: typeof faCalendar
  text: string
  color?: string
  iconRight?: boolean
}) => (
  <span className="text-xs font-light">
    <span className="flex items-center gap-1 whitespace-nowrap">
      {!iconRight && icon && (
        <FontAwesomeIcon icon={icon} className={(color ?? '') + ' block h-3'} />
      )}
      <span>{text}</span>
      {iconRight && icon && (
        <FontAwesomeIcon icon={icon} className={(color ?? '') + ' block h-3'} />
      )}
    </span>
  </span>
)

export const DateTag = ({
  due,
  dueTime,
}: {
  due: string
  dueTime?: string | null
}) => {
  const text = formatDueLabel(due, dueTime)
  if (!text) return null
  // Show the clock icon when the user set a specific time (clearer signal
  // than a calendar icon — the label is the time, not a date).
  return <Tag text={text} icon={dueTime ? faClock : faCalendar} />
}

export const TimeFrame = ({ timeFrame }: { timeFrame?: number }) => {
  if (!timeFrame) return null
  return <Tag icon={faClock} text={minutesToHours(timeFrame)} />
}

export const Repeat = ({
  repeat,
  repeatInterval,
  repeatUnit,
  repeatWeekdays,
}: {
  repeat: string
  repeatInterval: number
  repeatUnit: string
  repeatWeekdays: readonly boolean[]
}) => {
  const text = formatRepeat(repeat, repeatInterval, repeatUnit, repeatWeekdays)
  if (!text) return null
  return <Tag icon={faRepeat} text={text} />
}

export const Strict = ({ strictDeadline }: { strictDeadline?: boolean }) => {
  if (!strictDeadline) return null
  return <Tag icon={faCircleExclamation} text="strict" />
}
