import {
  faCalendar,
  faCircleExclamation,
  faClock,
  faRepeat,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { newSafeDate } from '@dtn/shared/helpers'
import { minutesToHours } from '@dtn/shared/time'
import { format } from 'date-fns'

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

export const DateTag = ({ due }: { due: string }) => {
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
  } catch (e) {
    console.error(e)
    return null
  }
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
  if (repeat === 'No Repeat') return null

  if (repeat === 'Custom') {
    let suffix = ''
    if (repeatUnit === 'week' && repeatWeekdays.some((x) => x)) {
      suffix =
        ': ' +
        repeatWeekdays
          .map((x, i) =>
            x ? ['su', 'mo', 'tu', 'we', 'th', 'fr', 'sa'][i] : '',
          )
          .filter((x) => x)
          .join(', ')
    }
    const base =
      repeatInterval > 1
        ? `${repeatInterval} ${repeatUnit}s`
        : `${repeatUnit}ly`
    return <Tag icon={faRepeat} text={(base + suffix).toLowerCase()} />
  }

  return <Tag icon={faRepeat} text={repeat.toLowerCase()} />
}

export const Strict = ({ strictDeadline }: { strictDeadline?: boolean }) => {
  if (!strictDeadline) return null
  return <Tag icon={faCircleExclamation} text="strict" />
}
