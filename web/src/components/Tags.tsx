import {
  faCalendar,
  faCircleExclamation,
  faClock,
  faRepeat,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  Dialog,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'
import { format } from 'date-fns'
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
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

// Editable date tag — clicking opens a small modal with a date input.
export const EditableDateTag = ({
  due,
  onChange,
}: {
  due: string
  onChange: (next: string) => void
}) => {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(due)

  useEffect(() => {
    if (open) setDraft(due)
  }, [open, due])

  const text = dueLabel(due) ?? 'Set date'
  const inputValue = draft === 'No Due Date' ? '' : isoFromDueString(draft)

  const save = () => {
    if (draft && draft !== 'No Due Date') onChange(draft)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          stop(e)
          setOpen(true)
        }}
        className={triggerClasses}
      >
        <Tag text={text} icon={faCalendar} />
      </button>
      <EditModal
        open={open}
        title="Due date"
        onClose={() => setOpen(false)}
        onSave={save}
      >
        <input
          type="date"
          value={inputValue}
          autoFocus
          onChange={(e) => {
            if (!e.target.value) return
            const [y, m, d] = e.target.value.split('-').map((x) => parseInt(x))
            setDraft(`${y}-${m}-${d}`)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
          }}
          className="w-full rounded border border-gray-700 bg-black px-3 py-2 text-sm text-white outline-none [color-scheme:dark] focus:border-gray-500"
        />
      </EditModal>
    </>
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

// Editable time-frame tag — clicking opens a small modal with hour/min
// inputs.
export const EditableTimeFrame = ({
  timeFrame,
  onChange,
}: {
  timeFrame: number
  onChange: (next: number) => void
}) => {
  const [open, setOpen] = useState(false)
  const [hours, setHours] = useState(Math.floor(timeFrame / 60))
  const [mins, setMins] = useState(timeFrame % 60)

  useEffect(() => {
    if (open) {
      setHours(Math.floor(timeFrame / 60))
      setMins(timeFrame % 60)
    }
  }, [open, timeFrame])

  const text = timeFrame ? minutesToHours(timeFrame) : 'Set time'

  const save = () => {
    onChange(Math.max(0, hours * 60 + mins))
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          stop(e)
          setOpen(true)
        }}
        className={triggerClasses}
      >
        <Tag text={text} icon={faClock} />
      </button>
      <EditModal
        open={open}
        title="Time frame"
        onClose={() => setOpen(false)}
        onSave={save}
      >
        <div className="flex items-center justify-center gap-3 py-2">
          <NumberField
            value={hours}
            onChange={setHours}
            min={0}
            max={99}
            label="hours"
            autoFocus
            onEnter={save}
          />
          <NumberField
            value={mins}
            onChange={setMins}
            min={0}
            max={59}
            label="minutes"
            onEnter={save}
          />
        </div>
      </EditModal>
    </>
  )
}

function NumberField({
  value,
  onChange,
  min,
  max,
  label,
  autoFocus,
  onEnter,
}: {
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  label: string
  autoFocus?: boolean
  onEnter?: () => void
}) {
  return (
    <label className="flex flex-col items-center gap-1">
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        autoFocus={autoFocus}
        onFocus={(e) => e.target.select()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault()
            onEnter()
          }
        }}
        onChange={(e) => {
          const n = parseInt(e.target.value)
          onChange(isNaN(n) ? 0 : Math.max(min, Math.min(max, n)))
        }}
        className="w-20 rounded border border-gray-700 bg-black py-2 text-center text-lg text-white outline-none focus:border-gray-500"
      />
      <span className="text-xs text-gray-500">{label}</span>
    </label>
  )
}

function EditModal({
  open,
  title,
  onClose,
  onSave,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  onSave: () => void
  children: ReactNode
}) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div
        className="fixed inset-0 bg-black/60"
        aria-hidden="true"
        onClick={stop}
      />
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        onClick={stop}
      >
        <DialogPanel className="w-full max-w-xs rounded-lg border border-gray-700 bg-gray-950 p-4 shadow-2xl">
          <DialogTitle className="mb-3 text-sm font-medium text-white">
            {title}
          </DialogTitle>
          <div>{children}</div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-xs text-gray-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className="rounded bg-white px-3 py-1.5 text-xs font-medium text-black hover:bg-gray-200"
            >
              Save
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
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

