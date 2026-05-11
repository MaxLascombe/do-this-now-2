import {
  faCalendar,
  faCircleExclamation,
  faClock,
  faRepeat,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react'
import { format } from 'date-fns'
import { type MouseEvent, useState } from 'react'

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

// Editable date tag — clicking opens a popover with a date input.
export const EditableDateTag = ({
  due,
  onChange,
}: {
  due: string
  onChange: (next: string) => void
}) => {
  const text = dueLabel(due) ?? 'Set date'
  // <input type="date"> wants YYYY-MM-DD with zero-padded month/day.
  const inputValue =
    due === 'No Due Date' ? '' : isoFromDueString(due)

  return (
    <Popover className="relative">
      <PopoverButton as="span" className={triggerClasses} onClick={stop}>
        <Tag text={text} icon={faCalendar} />
      </PopoverButton>
      <PopoverPanel
        anchor={{ to: 'bottom start', gap: 6 }}
        onClick={stop}
        className="z-20 rounded-md border border-gray-800 bg-black p-1 shadow-xl"
      >
        {({ close }) => (
          <input
            type="date"
            value={inputValue}
            autoFocus
            onChange={(e) => {
              if (!e.target.value) return
              const [y, m, d] = e.target.value.split('-').map((x) => parseInt(x))
              onChange(`${y}-${m}-${d}`)
              close()
            }}
            className="bg-transparent px-2 py-1 text-xs text-white outline-none [color-scheme:dark]"
          />
        )}
      </PopoverPanel>
    </Popover>
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

// Editable time-frame tag — clicking opens a popover with hour/min inputs.
export const EditableTimeFrame = ({
  timeFrame,
  onChange,
}: {
  timeFrame: number
  onChange: (next: number) => void
}) => {
  const [hours, setHours] = useState(Math.floor(timeFrame / 60))
  const [mins, setMins] = useState(timeFrame % 60)

  const text = timeFrame ? minutesToHours(timeFrame) : 'Set time'

  return (
    <Popover className="relative">
      <PopoverButton as="span" className={triggerClasses} onClick={stop}>
        <Tag text={text} icon={faClock} />
      </PopoverButton>
      <PopoverPanel
        anchor={{ to: 'bottom start', gap: 6 }}
        onClick={stop}
        className="z-20 rounded-md border border-gray-800 bg-black p-1 shadow-xl"
      >
        {({ close }) => {
          const commit = () => {
            onChange(Math.max(0, hours * 60 + mins))
            close()
          }
          return (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                commit()
              }}
              className="flex items-center gap-0.5 px-1 text-xs text-white"
            >
              <TimeNumberField
                value={hours}
                onChange={setHours}
                min={0}
                max={99}
                autoFocus
              />
              <span className="text-gray-500">h</span>
              <TimeNumberField
                value={mins}
                onChange={setMins}
                min={0}
                max={59}
              />
              <span className="text-gray-500">m</span>
              <button type="submit" className="sr-only">
                Save
              </button>
            </form>
          )
        }}
      </PopoverPanel>
    </Popover>
  )
}

function TimeNumberField({
  value,
  onChange,
  min,
  max,
  autoFocus,
}: {
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  autoFocus?: boolean
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      autoFocus={autoFocus}
      onFocus={(e) => e.target.select()}
      onChange={(e) => {
        const n = parseInt(e.target.value)
        onChange(isNaN(n) ? 0 : Math.max(min, Math.min(max, n)))
      }}
      className="w-8 bg-transparent text-right text-xs text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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

