import {
  faArrowRight,
  faMinus,
  faPlus,
  faPlusCircle,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { format } from 'date-fns'
import { type ComponentProps, type RefObject, useRef, useState } from 'react'
import { ZodError } from 'zod'

import { dateString, newSafeDate } from '@dtn/shared/helpers'
import {
  type RepeatOption,
  type RepeatUnit,
  type RepeatWeekdays,
  type SubTask,
  type TaskInput,
  taskInputSchema,
} from '@dtn/shared/task-input'
import useKeyAction, { type KeyAction } from '../hooks/useKeyAction'
import { Button } from './Button'
import { Input } from './Input'
import { Switch } from './Switch'

const days = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

const repeatOptions: RepeatOption[] = [
  'No Repeat',
  'Daily',
  'Weekdays',
  'Weekly',
  'Monthly',
  'Yearly',
  'Custom',
]
const repeatUnits: RepeatUnit[] = ['day', 'week', 'month', 'year']

// HTML <input type="date"> uses YYYY-MM-DD (zero-padded); our shared schema
// uses YYYY-M-D. Convert at the input boundary.
const toIso = (due: string): string => {
  if (due === 'No Due Date') return ''
  const [y, m, d] = due.split('-').map((s) => parseInt(s))
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  return `${y}-${pad(m)}-${pad(d)}`
}

const dayDiffFor = (due: string): number => {
  const today = newSafeDate(dateString(new Date()))
  const target = newSafeDate(due)
  return Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
}

const dayDiffPhrase = (diff: number): string => {
  if (diff < 0) return `${Math.abs(diff)} days ago`
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return `in ${diff} days`
}

const TaskForm = ({
  title: initialTitle,
  due: initialDue,
  errorMessage,
  strictDeadline: initialStrictDeadline,
  repeat: initialRepeat,
  repeatInterval: initialRepeatInterval,
  repeatUnit: initialRepeatUnit,
  repeatWeekdays: initialRepeatWeekdays,
  timeFrame: initialTimeFrame,
  subtasks: initialSubtasks,
  submitForm,
  isSaving = false,
}: Partial<TaskInput> & {
  errorMessage?: string | null
  submitForm: (input: TaskInput) => void
  isSaving?: boolean
}) => {
  const [formError, setFormError] = useState<ZodError>()
  const [title, setTitle] = useState(initialTitle ?? '')
  const [due, setDue] = useState<string>(
    initialDue ?? dateString(new Date()),
  )
  const [strictDeadline, setStrictDeadline] = useState(
    initialStrictDeadline ?? false,
  )
  const [repeat, setRepeat] = useState<RepeatOption>(
    initialRepeat ?? 'No Repeat',
  )
  const [repeatInterval, setRepeatInterval] = useState(
    initialRepeatInterval ?? 1,
  )
  const [repeatUnit, setRepeatUnit] = useState<RepeatUnit>(
    initialRepeatUnit ?? 'day',
  )
  const [repeatWeekdays, setRepeatWeekdays] = useState<RepeatWeekdays>(
    initialRepeatWeekdays ?? [false, false, false, false, false, false, false],
  )
  const [timeFrame, setTimeFrame] = useState(initialTimeFrame ?? 0)
  const timeFrameMinutesRef = useRef<HTMLInputElement>(null)
  const timeFrameHoursRef = useRef<HTMLInputElement>(null)
  const [subtasks, setSubtasks] = useState<SubTask[]>(initialSubtasks ?? [])

  const [hasSubtasks, setHasSubtasks] = useState((subtasks.length ?? 0) > 0)
  if ((subtasks.length ?? 0) > 0 && !hasSubtasks) setHasSubtasks(true)

  const shiftDue = (deltaDays: number) => {
    const d = newSafeDate(due)
    d.setDate(d.getDate() + deltaDays)
    setDue(dateString(d))
  }

  const errors = Object.fromEntries(
    formError?.issues.map((issue) => [issue.path[0], issue.message]) ?? [],
  )

  // Drag-and-drop reorder for subtasks
  const [draggedSubtask, setDraggedSubtask] = useState<SubTask | undefined>()
  const handleDragStart = (e: React.DragEvent, item: SubTask) => {
    setDraggedSubtask(item)
    e.dataTransfer?.setData('text/plain', '')
  }
  const handleDragEnd = () => setDraggedSubtask(undefined)
  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const handleDrop = (e: React.DragEvent, target: SubTask) => {
    e.preventDefault()
    if (!draggedSubtask) return
    const currentIndex = subtasks.indexOf(draggedSubtask)
    const targetIndex = subtasks.indexOf(target)
    const next = [...subtasks]
    if (currentIndex !== -1 && targetIndex !== -1) {
      next.splice(currentIndex, 1)
      next.splice(targetIndex, 0, draggedSubtask)
      setSubtasks(next)
    }
  }

  const submit = () => {
    const input = taskInputSchema.safeParse({
      title,
      due,
      strictDeadline,
      repeat,
      repeatInterval,
      repeatUnit,
      repeatWeekdays,
      timeFrame,
      subtasks,
    })
    if (!input.success) return setFormError(input.error)
    submitForm(input.data)
  }

  const keyActions: KeyAction[] = [
    {
      key: 'escape',
      description: 'Home',
      action: () => window.history.back(),
    },
  ]
  useKeyAction(keyActions)

  const dueDate = newSafeDate(due)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="mt-6 block space-y-6 sm:mt-5 sm:space-y-5"
    >
      {errorMessage && <div className="mt-4 text-red-500">{errorMessage}</div>}

      <Row label="Title" htmlFor="titleInput">
        <div className="mt-1 flex flex-col gap-2 sm:col-span-2 sm:mt-0">
          <div className="flex max-w-lg rounded-md shadow-sm">
            <Input
              id="titleInput"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Do this thing"
            />
          </div>
          {errors.title && (
            <div className="text-sm text-red-500">{errors.title}</div>
          )}
        </div>
      </Row>

      <Row label="Due Date" htmlFor="due-date">
        <div className="mt-1 sm:col-span-2 sm:mt-0">
          <div className="flex max-w-lg items-center gap-2 rounded-md shadow-sm">
            <FormButton icon={faMinus} onClick={() => shiftDue(-1)} />
            <Input
              id="due-date"
              type="date"
              value={toIso(due)}
              onChange={(e) => {
                if (!e.target.value) return
                const [y, m, d] = e.target.value.split('-').map((x) =>
                  parseInt(x),
                )
                setDue(`${y}-${m}-${d}`)
              }}
              className="[color-scheme:dark]"
            />
            <FormButton onClick={() => shiftDue(1)} icon={faPlus} />
          </div>
          <div className="mt-1 max-w-lg text-center text-gray-600">
            {format(dueDate, 'EEEE, LLLL do, u')} ({dayDiffPhrase(dayDiffFor(due))})
          </div>
        </div>
      </Row>

      <Row label="Strict Deadline?">
        <div className="mt-1 sm:col-span-2 sm:mt-0">
          <Switch checked={strictDeadline} onChange={setStrictDeadline} />
        </div>
      </Row>

      <Row label="Repeat?">
        <div className="mt-1 sm:col-span-2 sm:mt-0">
          <div className="flex max-w-lg rounded-md shadow-sm">
            <FormSelect
              id="repeat"
              value={repeat}
              onChange={(e) => {
                const v = e.target.value
                if ((repeatOptions as readonly string[]).includes(v))
                  setRepeat(v as RepeatOption)
              }}
            >
              {repeatOptions.map((opt) => (
                <option key={opt}>{opt}</option>
              ))}
            </FormSelect>
          </div>
          {repeat === 'Custom' && (
            <>
              <div className="mt-3 flex max-w-lg">
                <div className="flex-1 py-2.5 text-sm">Every:</div>
                <Input
                  type="number"
                  step={1}
                  min={1}
                  className="mr-3"
                  value={repeatInterval}
                  onChange={(e) => setRepeatInterval(parseInt(e.target.value))}
                />
                <FormSelect
                  defaultValue={repeatUnit}
                  onChange={(e) => {
                    const v = e.target.value
                    if ((repeatUnits as readonly string[]).includes(v))
                      setRepeatUnit(v as RepeatUnit)
                  }}
                >
                  {repeatUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}s
                    </option>
                  ))}
                </FormSelect>
              </div>
              {repeatUnit === 'week' && (
                <div className="pointer-events-auto mt-3 flex max-w-lg justify-evenly">
                  {repeatWeekdays.map((_, i) => (
                    <SwitchWithLabel
                      key={days[i]}
                      label={days[i]}
                      onChange={(v) =>
                        setRepeatWeekdays((s) => [
                          i === 0 ? v : s[0],
                          i === 1 ? v : s[1],
                          i === 2 ? v : s[2],
                          i === 3 ? v : s[3],
                          i === 4 ? v : s[4],
                          i === 5 ? v : s[5],
                          i === 6 ? v : s[6],
                        ])
                      }
                      checked={repeatWeekdays[i]}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Row>

      <Row label="Expected Time Frame">
        <div className="mt-1 sm:col-span-2 sm:mt-0">
          <div className="flex max-w-lg flex-col items-center justify-evenly gap-2 md:flex-row">
            {timeFrame >= 60 && (
              <NumberInput
                innerRef={timeFrameHoursRef}
                label="hrs"
                minusDisabled={false}
                minusFn={() => setTimeFrame(Math.max(0, timeFrame - 60))}
                onChange={(e) =>
                  setTimeFrame(
                    parseInt(e.target.value) * 60 +
                      parseInt(timeFrameMinutesRef.current?.value ?? '0'),
                  )
                }
                plusFn={() => setTimeFrame(timeFrame + 60)}
                value={Math.floor(timeFrame / 60)}
                step={1}
                min={0}
              />
            )}
            <NumberInput
              innerRef={timeFrameMinutesRef}
              label="mins"
              minusDisabled={timeFrame === 0}
              minusFn={() => setTimeFrame(Math.max(0, timeFrame - 15))}
              onChange={(e) =>
                setTimeFrame(
                  Math.max(
                    0,
                    parseInt(timeFrameHoursRef.current?.value ?? '0') * 60 +
                      parseInt(e.target.value),
                  ),
                )
              }
              plusFn={() => setTimeFrame(timeFrame + 15)}
              value={timeFrame % 60}
              step={15}
              min={-15}
            />
          </div>
        </div>
      </Row>

      <Row label="Subtasks">
        <div className="mt-1 sm:col-span-2 sm:mt-0">
          <div className="flex max-w-lg">
            <Switch
              checked={hasSubtasks}
              onChange={(e) => {
                if (
                  !e &&
                  subtasks.length > 0 &&
                  !window.confirm('Are you sure you want to remove all subtasks?')
                )
                  return
                if (!e) setSubtasks([])
                else setSubtasks([{ done: false, title: '' }])
                setHasSubtasks(e)
              }}
            />
          </div>
          {hasSubtasks && (
            <>
              {subtasks.map((subtask, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={(e) => handleDragStart(e, subtask)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, subtask)}
                  className="mt-3 flex max-w-lg items-center gap-2"
                >
                  <button type="button">⠿</button>
                  <Input
                    type="text"
                    value={subtask.title}
                    onChange={(e) => {
                      setSubtasks([
                        ...subtasks.slice(0, i),
                        { ...subtask, title: e.target.value },
                        ...subtasks.slice(i + 1),
                      ])
                    }}
                    placeholder={`Subtask ${i + 1}`}
                  />
                  <FormButton
                    icon={faTrash}
                    onClick={() =>
                      setSubtasks((s) => [...s.slice(0, i), ...s.slice(i + 1)])
                    }
                  />
                  <SwitchWithLabel
                    label="Done?"
                    checked={subtask.done}
                    onChange={(v) =>
                      setSubtasks((s) => [
                        ...s.slice(0, i),
                        { ...s[i], done: v },
                        ...s.slice(i + 1),
                      ])
                    }
                  />
                </div>
              ))}
              <div className="mt-3 flex max-w-lg justify-center">
                <Button
                  icon={faPlusCircle}
                  text="New Subtask"
                  onClick={() =>
                    setSubtasks([...subtasks, { done: false, title: '' }])
                  }
                  type="button"
                />
              </div>
            </>
          )}
        </div>
      </Row>

      <div className="flex justify-center pt-5 sm:border-t sm:border-gray-700">
        <Button
          loading={isSaving}
          icon={faArrowRight}
          text="Submit"
          type="submit"
        />
      </div>
    </form>
  )
}

const Row = ({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor?: string
  children: React.ReactNode
}) => (
  <div className="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-700 sm:pt-5">
    <label
      htmlFor={htmlFor}
      className="block text-sm font-medium sm:mt-px sm:pt-2"
    >
      {label}
    </label>
    {children}
  </div>
)

const NumberInput = (
  props: ComponentProps<'input'> & {
    innerRef: RefObject<HTMLInputElement | null>
    label: string
    minusDisabled: boolean
    minusFn: () => void
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
    plusFn: () => void
    step: number
    min: number
  },
) => (
  <div className="flex w-full items-center gap-2">
    {!props.minusDisabled && (
      <FormButton icon={faMinus} onClick={props.minusFn} />
    )}
    <div className="flex-1 flex-grow">
      <Input
        id={props.id}
        ref={props.innerRef}
        type="number"
        step={props.step}
        min={props.min}
        value={props.value}
        onChange={props.onChange}
        className="w-full"
      />
    </div>
    <FormButton icon={faPlus} onClick={props.plusFn} />
    <label htmlFor={props.id} className="text-sm">
      {props.label}
    </label>
  </div>
)

const FormButton = (
  props: Omit<ComponentProps<typeof Button>, 'className'>,
) => <Button {...props} type="button" className="border-gray-800" />

const FormSelect = (props: ComponentProps<'select'>) => (
  <select
    {...props}
    className={
      'mw-11/12 mx-auto block w-96 min-w-0 flex-1 rounded border border-gray-800 bg-black p-2.5 text-white placeholder-gray-400 outline-none ring-white ring-offset-0 ring-offset-black focus:border-gray-700 focus:bg-gray-900 focus:ring sm:text-sm ' +
      (props.className ?? '')
    }
  >
    {props.children}
  </select>
)

const SwitchWithLabel = ({
  label,
  ...props
}: { label: string } & ComponentProps<typeof Switch>) => (
  <div className="flex flex-col items-center text-xs">
    <label htmlFor={props.id}>{label}</label>
    <Switch {...props} />
  </div>
)

export default TaskForm
export type { TaskInput as TaskFormInput }
