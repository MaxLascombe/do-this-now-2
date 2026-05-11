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

const tagPillClasses =
  'rounded px-1.5 py-0.5 -mx-1.5 -my-0.5 hover:bg-gray-800 focus:bg-gray-800 outline-none cursor-pointer'

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
      <PopoverButton as="span" className={tagPillClasses} onClick={stop}>
        <Tag text={text} icon={faCalendar} />
      </PopoverButton>
      <PopoverPanel
        anchor={{ to: 'bottom start', gap: 4 }}
        onClick={stop}
        className="z-20 rounded-md border border-gray-700 bg-gray-900 p-2 shadow-lg"
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
            className="rounded border border-gray-700 bg-black px-2 py-1 text-sm text-white outline-none"
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
      <PopoverButton as="span" className={tagPillClasses} onClick={stop}>
        <Tag text={text} icon={faClock} />
      </PopoverButton>
      <PopoverPanel
        anchor={{ to: 'bottom start', gap: 4 }}
        onClick={stop}
        className="z-20 rounded-md border border-gray-700 bg-gray-900 p-2 shadow-lg"
      >
        {({ close }) => {
          const commit = () => {
            const total = Math.max(0, hours * 60 + mins)
            onChange(total)
            close()
          }
          return (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                commit()
              }}
              className="flex items-center gap-2"
            >
              <NumberField
                value={hours}
                onChange={setHours}
                label="h"
                min={0}
                max={99}
              />
              <NumberField
                value={mins}
                onChange={setMins}
                label="m"
                min={0}
                max={59}
              />
              <button
                type="submit"
                className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-white hover:bg-gray-700"
              >
                Save
              </button>
            </form>
          )
        }}
      </PopoverPanel>
    </Popover>
  )
}

function NumberField({
  value,
  onChange,
  label,
  min,
  max,
}: {
  value: number
  onChange: (n: number) => void
  label: string
  min: number
  max: number
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-gray-300">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = parseInt(e.target.value)
          onChange(isNaN(n) ? 0 : Math.max(min, Math.min(max, n)))
        }}
        className="w-14 rounded border border-gray-700 bg-black px-1 py-1 text-center text-sm text-white outline-none"
      />
      {label}
    </label>
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

