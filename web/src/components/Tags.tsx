import {
  faCalendar,
  faCircleExclamation,
  faClock,
  faRepeat,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { format } from 'date-fns'
import {
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  useState,
} from 'react'

import { newSafeDate } from '../lib/helpers'
import { minutesToHours } from '../lib/time'

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

const dueLabel = (due: string): string | null => {
  if (due === 'No Due Date') return 'No date'
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

    if (dueDate.getTime() === today.getTime()) return 'Today'
    if (dueDate.getTime() === tomorrow.getTime()) return 'Tomorrow'
    if (dueDate.getTime() === yesterday.getTime()) return 'Yesterday'
    return format(dueDate, 'iii LLL d')
  } catch (e) {
    console.error(e)
    return null
  }
}

const stop = (e: MouseEvent) => e.stopPropagation()

// Editable tag affordance: subtle dotted underline on hover/focus, no
// padding/background so the row layout stays identical to the read-only tags.
const triggerClasses =
  'cursor-pointer outline-none hover:underline focus:underline decoration-dotted decoration-gray-500 underline-offset-4'

// Read-only date tag (used in history etc.)
export const DateTag = ({ due }: { due: string }) => {
  if (due === 'No Due Date') return null
  const text = dueLabel(due)
  if (!text) return null
  return <Tag text={text} icon={faCalendar} />
}

// Editable date tag — clicking turns the tag into an inline date input.
// Enter or blur commits, Esc cancels.
export const EditableDateTag = ({
  due,
  onChange,
}: {
  due: string
  onChange: (next: string) => void
}) => {
  const [editing, setEditing] = useState(false)
  const text = dueLabel(due) ?? 'Set date'

  if (editing) {
    const inputValue = due === 'No Due Date' ? '' : isoFromDueString(due)
    const commit = (raw: string) => {
      setEditing(false)
      if (!raw) return
      const [y, m, d] = raw.split('-').map((x) => parseInt(x))
      const next = `${y}-${m}-${d}`
      if (next !== due) onChange(next)
    }
    return (
      <span
        className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-light"
        onClick={stop}
        onMouseDown={stop}
      >
        <FontAwesomeIcon icon={faCalendar} className="block h-3" />
        <input
          type="date"
          defaultValue={inputValue}
          autoFocus
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit(e.currentTarget.value)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              setEditing(false)
            }
          }}
          className="bg-transparent text-xs text-white outline-none [color-scheme:dark]"
        />
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        stop(e)
        setEditing(true)
      }}
      className={triggerClasses}
    >
      <Tag text={text} icon={faCalendar} />
    </button>
  )
}

function isoFromDueString(due: string): string {
  const [y, m, d] = due.split('-').map((s) => parseInt(s))
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  return `${y}-${pad(m)}-${pad(d)}`
}

// Read-only time-frame tag.
export const TimeFrame = ({ timeFrame }: { timeFrame?: number }) => {
  if (!timeFrame) return null
  return <Tag icon={faClock} text={minutesToHours(timeFrame)} />
}

// Editable time-frame tag — clicking turns the tag into two inline number
// inputs ([hh]h [mm]m). Tab between fields stays in edit mode; clicking out
// or pressing Enter commits, Esc cancels.
export const EditableTimeFrame = ({
  timeFrame,
  onChange,
}: {
  timeFrame: number
  onChange: (next: number) => void
}) => {
  const [editing, setEditing] = useState(false)
  const [hours, setHours] = useState(Math.floor(timeFrame / 60))
  const [mins, setMins] = useState(timeFrame % 60)

  const text = timeFrame ? minutesToHours(timeFrame) : 'Set time'

  const startEdit = () => {
    setHours(Math.floor(timeFrame / 60))
    setMins(timeFrame % 60)
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    const next = Math.max(0, hours * 60 + mins)
    if (next !== timeFrame) onChange(next)
  }

  const cancel = () => setEditing(false)

  const onContainerBlur = (e: FocusEvent<HTMLSpanElement>) => {
    // Stay in edit mode if focus moved to a sibling within the editor.
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    commit()
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  if (editing) {
    return (
      <span
        className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-light"
        onClick={stop}
        onMouseDown={stop}
        onBlur={onContainerBlur}
      >
        <FontAwesomeIcon icon={faClock} className="block h-3" />
        <InlineNumber
          value={hours}
          onChange={setHours}
          min={0}
          max={99}
          autoFocus
          onKeyDown={onKey}
        />
        <span className="text-gray-500">h</span>
        <InlineNumber
          value={mins}
          onChange={setMins}
          min={0}
          max={59}
          onKeyDown={onKey}
        />
        <span className="text-gray-500">m</span>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        stop(e)
        startEdit()
      }}
      className={triggerClasses}
    >
      <Tag text={text} icon={faClock} />
    </button>
  )
}

function InlineNumber({
  value,
  onChange,
  min,
  max,
  autoFocus,
  onKeyDown,
}: {
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  autoFocus?: boolean
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      autoFocus={autoFocus}
      onFocus={(e) => e.target.select()}
      onKeyDown={onKeyDown}
      onChange={(e) => {
        const n = parseInt(e.target.value)
        onChange(isNaN(n) ? 0 : Math.max(min, Math.min(max, n)))
      }}
      className="w-7 bg-transparent text-right text-xs text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  )
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

