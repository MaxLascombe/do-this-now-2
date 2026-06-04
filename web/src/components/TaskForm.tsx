import { useApi } from '@dtn/shared/api-client'
import { formatDueDistance } from '@dtn/shared/format'
import { dateString, newSafeDate } from '@dtn/shared/helpers'
import { useAllTasks } from '@dtn/shared/queries'
import { taskInputSchema } from '@dtn/shared/task-input'
import { useNavigate } from '@tanstack/react-router'
import { format } from 'date-fns'
import {
  Fragment,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { ZodError } from 'zod'

import useKeyAction, { type KeyAction } from '../hooks/useKeyAction'
import { useConfirm } from './ConfirmProvider'
import { KeyHints } from './KeyHints'
import type {
  RepeatOption,
  RepeatUnit,
  RepeatWeekdays,
  SubTask,
  TaskInput,
  TimeframeType,
} from '@dtn/shared/task-input'

const repeatOptions: Array<RepeatOption> = [
  'No Repeat',
  'Daily',
  'Weekdays',
  'Weekly',
  'Monthly',
  'Yearly',
  'Custom',
]

const repeatUnits: Array<RepeatUnit> = ['day', 'week', 'month', 'year']

const dayShort = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const

const toIso = (due: string): string => {
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

type FormSub = SubTask & { _key: string }

const TaskForm = ({
  title: initialTitle,
  emoji: initialEmoji,
  due: initialDue,
  dueTime: initialDueTime,
  errorMessage,
  strictDeadline: initialStrictDeadline,
  repeat: initialRepeat,
  repeatInterval: initialRepeatInterval,
  repeatUnit: initialRepeatUnit,
  repeatWeekdays: initialRepeatWeekdays,
  timeFrame: initialTimeFrame,
  timekeeperId: initialTimekeeperId,
  timeframeType: initialTimeframeType,
  subtasks: initialSubtasks,
  notes: initialNotes,
  submitForm,
  isSaving = false,
  isEdit = false,
  taskId,
  onDelete,
  onCancel,
}: Partial<TaskInput> & {
  errorMessage?: string | null
  submitForm: (input: TaskInput) => void
  isSaving?: boolean
  isEdit?: boolean
  // Required in edit mode so we can exclude the task from its own
  // keeper-candidate list. Optional on new-task (no current task yet).
  taskId?: string
  onDelete?: () => void
  onCancel?: () => void
}) => {
  const api = useApi()
  const navigate = useNavigate()
  const confirm = useConfirm()
  const [formError, setFormError] = useState<ZodError>()
  const [title, setTitle] = useState(initialTitle ?? '')
  const [emoji, setEmoji] = useState(initialEmoji ?? '')
  const [emojiOptions, setEmojiOptions] = useState<Array<string>>(
    initialEmoji ? [initialEmoji] : [],
  )
  const [emojiLoading, setEmojiLoading] = useState(false)
  const [customEmoji, setCustomEmoji] = useState<string>('')
  const [showCustomEmoji, setShowCustomEmoji] = useState(false)

  const [due, setDue] = useState<string>(initialDue ?? dateString(new Date()))
  const [dueTime, setDueTime] = useState<string | null>(initialDueTime ?? null)
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
  const [timekeeperId, setTimekeeperId] = useState<string | null>(
    initialTimekeeperId ?? null,
  )
  const [timeframeType, setTimeframeType] = useState<TimeframeType>(
    initialTimeframeType ?? 'fixed',
  )

  const nextSubtaskKey = useRef(0)
  const newKey = () => `s${++nextSubtaskKey.current}`
  const [subtasks, setSubtasks] = useState<Array<FormSub>>(() =>
    (initialSubtasks ?? []).map((s) => ({ ...s, _key: newKey() })),
  )
  const [hasSubtasks, setHasSubtasks] = useState(subtasks.length > 0)
  if (subtasks.length > 0 && !hasSubtasks) setHasSubtasks(true)

  const [notes, setNotes] = useState(initialNotes ?? '')

  // Debounced emoji suggestions.
  useEffect(() => {
    const t = title.trim()
    if (!t) {
      setEmojiOptions(initialEmoji ? [initialEmoji] : [])
      return
    }
    let cancelled = false
    const timer = setTimeout(async () => {
      setEmojiLoading(true)
      try {
        const emojis = await api.tasks.suggestEmojis(t)
        if (cancelled) return
        setEmojiOptions(emojis)
        setEmoji((prev) => prev || emojis[0] || '')
      } catch (e) {
        console.warn('emoji suggest failed', e)
      } finally {
        if (!cancelled) setEmojiLoading(false)
      }
    }, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [title, api, initialEmoji])

  const shiftDue = (deltaDays: number) => {
    const d = newSafeDate(due)
    d.setDate(d.getDate() + deltaDays)
    setDue(dateString(d))
  }

  const errors = Object.fromEntries(
    formError?.issues.map((issue) => [issue.path[0], issue.message]) ?? [],
  )

  // Drag-and-drop reorder for subtasks.
  const [draggedSubtask, setDraggedSubtask] = useState<FormSub | undefined>()
  const handleDragStart = (e: React.DragEvent, item: FormSub) => {
    setDraggedSubtask(item)
    e.dataTransfer.setData('text/plain', '')
  }
  const handleDragEnd = () => setDraggedSubtask(undefined)
  const handleDragOver = (e: React.DragEvent) => e.preventDefault()
  const handleDrop = (e: React.DragEvent, target: FormSub) => {
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
    const finalEmoji = showCustomEmoji && customEmoji ? customEmoji : emoji
    const input = taskInputSchema.safeParse({
      title,
      emoji: finalEmoji,
      due,
      dueTime,
      strictDeadline,
      repeat,
      repeatInterval,
      repeatUnit,
      repeatWeekdays,
      timeFrame,
      timekeeperId,
      timeframeType,
      subtasks,
      notes,
    })
    if (!input.success) return setFormError(input.error)
    submitForm(input.data)
  }

  const keyActions: Array<KeyAction> = [
    {
      key: 'escape',
      description: 'Cancel',
      action: () => (onCancel ? onCancel() : window.history.back()),
    },
    { key: 'n', description: 'Home', action: () => navigate({ to: '/' }) },
    {
      key: 't',
      description: 'Tasks',
      action: () => navigate({ to: '/tasks' }),
    },
    {
      key: 'h',
      description: 'History',
      action: () => navigate({ to: '/history' }),
    },
    {
      key: 'a',
      description: 'Stats',
      action: () => navigate({ to: '/stats' }),
    },
  ]
  // Don't bind `c → /new-task` in edit mode — pressing it on /new-task would
  // be a no-op anyway, and we'd shadow whatever Backspace-like delete needs.
  if (!isEdit) {
    keyActions.push({
      key: '=',
      description: 'New task',
      shift: true,
      action: () => navigate({ to: '/new-task' }),
    })
  }
  if (isEdit && onDelete) {
    keyActions.push({
      key: 'backspace',
      description: 'Delete',
      action: onDelete,
    })
  }
  useKeyAction(keyActions)

  const dueDate = newSafeDate(due)
  // Time frame is stored as decimal minutes after the timer redesign; UI
  // rounds up so a 30.4-min EMA still reads "31 min" rather than "30".
  const displayedMinutes = Math.ceil(timeFrame)
  const stepMins = (delta: number) => {
    const next = Math.max(0, Math.round(timeFrame) + delta)
    setTimeFrame(next)
    // Keep the XOR invariant: positive timeFrame implies no keeper.
    if (next > 0 && timekeeperId !== null) setTimekeeperId(null)
  }

  // Eligible timekeepers: this user's fixed-type tasks with a positive
  // time frame, excluding the current task (a task can't be its own
  // keeper — the DB CHECK enforces this too).
  const allTasksQuery = useAllTasks({ enabled: timeFrame === 0 })
  const keeperCandidates = (allTasksQuery.data ?? [])
    .filter(
      (t) =>
        t.timeframeType === 'fixed' &&
        t.timeFrame > 0 &&
        (!taskId || t.id !== taskId),
    )
    .sort((a, b) => a.title.localeCompare(b.title))
  const [keeperFilter, setKeeperFilter] = useState('')
  const filteredKeepers = keeperFilter.trim()
    ? keeperCandidates.filter((t) =>
        t.title.toLowerCase().includes(keeperFilter.trim().toLowerCase()),
      )
    : keeperCandidates

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="flex min-h-[calc(100vh-160px)] flex-col"
    >
      <div className="flex-1 px-5 pb-[200px] md:px-10 md:pb-32">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          {errorMessage && (
            <div role="alert" className="font-mono text-sm text-rose-400">
              {errorMessage}
            </div>
          )}

          <Field label="Title">
            <input
              id="titleInput"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Do this thing"
              className="dtn-task-title w-full border-b border-zinc-700 bg-transparent pb-2 text-[1.85rem] leading-[1.1] text-zinc-50 outline-none placeholder:text-zinc-700 focus:border-zinc-50 md:text-[2.25rem]"
            />
            {errors.title && (
              <div className="mt-2 font-mono text-xs text-rose-400">
                {errors.title}
              </div>
            )}
          </Field>

          <Field label="Notes" trailing="optional">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context, links, anything you want to remember…"
              rows={3}
              className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 font-mono text-sm text-zinc-200 outline-none placeholder:text-zinc-700 focus:border-zinc-600"
            />
            {errors.notes && (
              <div className="mt-2 font-mono text-xs text-rose-400">
                {errors.notes}
              </div>
            )}
          </Field>

          <Field
            label="Emoji"
            trailing={
              emojiLoading
                ? 'suggesting…'
                : emojiOptions.length > 0
                  ? '✨ suggested by Claude'
                  : 'type a title for suggestions'
            }
          >
            <div className="flex flex-wrap gap-2">
              {emojiOptions.map((e, i) => (
                <button
                  key={`${e}-${i}`}
                  type="button"
                  onClick={() => {
                    setEmoji(e)
                    setShowCustomEmoji(false)
                  }}
                  className={
                    'flex h-12 w-12 items-center justify-center rounded-xl border text-2xl transition-colors ' +
                    (emoji === e && !showCustomEmoji
                      ? 'border-zinc-100 bg-zinc-100/10'
                      : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700')
                  }
                  aria-pressed={emoji === e && !showCustomEmoji}
                  aria-label={`Use ${e}`}
                >
                  {e}
                </button>
              ))}
              {showCustomEmoji ? (
                <input
                  type="text"
                  value={customEmoji}
                  onChange={(e) =>
                    setCustomEmoji(
                      Array.from(e.target.value).slice(0, 2).join(''),
                    )
                  }
                  autoFocus
                  className="h-12 w-12 rounded-xl border border-zinc-100 bg-zinc-100/10 text-center text-2xl outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCustomEmoji(true)}
                  className="flex h-12 w-12 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-lg text-zinc-500 hover:text-zinc-300"
                  aria-label="Custom emoji"
                  title="Custom emoji"
                >
                  ＋
                </button>
              )}
            </div>
            {errors.emoji && (
              <div className="mt-2 font-mono text-xs text-rose-400">
                {errors.emoji}
              </div>
            )}
          </Field>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-[1.6fr_1fr]">
            <Field label="Due date">
              <div className="flex items-center gap-2 font-mono">
                <Stepper onClick={() => shiftDue(-1)}>−</Stepper>
                <input
                  id="due-date"
                  type="date"
                  value={toIso(due)}
                  onChange={(e) => {
                    if (!e.target.value) return
                    const [y, m, d] = e.target.value
                      .split('-')
                      .map((x) => parseInt(x))
                    setDue(`${y}-${m}-${d}`)
                  }}
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 outline-none tabular-nums [color-scheme:dark] focus:border-zinc-600"
                />
                <Stepper onClick={() => shiftDue(1)}>+</Stepper>
              </div>
              <div className="mt-1.5 font-mono text-xs text-zinc-500">
                {format(dueDate, 'EEEE, LLL d')} ·{' '}
                {formatDueDistance(dayDiffFor(due))}
              </div>
            </Field>

            <Field label="Due time?">
              <div className="flex items-center gap-3 font-mono">
                <Toggle
                  label="Set a due time"
                  on={dueTime !== null}
                  onChange={(on) => setDueTime(on ? '09:00' : null)}
                />
                {dueTime !== null && (
                  <input
                    id="due-time"
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value || '09:00')}
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 outline-none tabular-nums [color-scheme:dark] focus:border-zinc-600"
                  />
                )}
              </div>
              {dueTime !== null && (
                <div className="mt-1.5 font-mono text-xs text-zinc-500">
                  ranks to top once {dueTime} arrives
                </div>
              )}
            </Field>
          </div>

          <Field label="Repeat">
            <div className="flex flex-wrap gap-1.5 font-mono">
              {repeatOptions.map((r) => (
                <RepeatChip
                  key={r}
                  label={r}
                  active={repeat === r}
                  onClick={() => setRepeat(r)}
                />
              ))}
            </div>
            {(repeat === 'Weekly' ||
              (repeat === 'Custom' && repeatUnit === 'week')) && (
              <div className="mt-3 flex flex-wrap gap-1.5 font-mono">
                {dayShort.map((d, i) => {
                  const on = repeatWeekdays[i]
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setRepeatWeekdays((s) => [
                          i === 0 ? !on : s[0],
                          i === 1 ? !on : s[1],
                          i === 2 ? !on : s[2],
                          i === 3 ? !on : s[3],
                          i === 4 ? !on : s[4],
                          i === 5 ? !on : s[5],
                          i === 6 ? !on : s[6],
                        ])
                      }
                      className={
                        'flex h-9 w-9 items-center justify-center rounded-full border text-xs ' +
                        (on
                          ? 'border-zinc-100 bg-zinc-100 text-zinc-900'
                          : 'border-zinc-800 text-zinc-400 hover:border-zinc-600')
                      }
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            )}
            {repeat === 'Custom' && (
              <div className="mt-3 flex items-center gap-3 font-mono">
                <span className="font-mono text-xs text-zinc-500">every</span>
                <input
                  type="number"
                  min={1}
                  value={repeatInterval}
                  onChange={(e) =>
                    setRepeatInterval(parseInt(e.target.value) || 1)
                  }
                  className="w-20 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 outline-none tabular-nums focus:border-zinc-600"
                />
                <select
                  value={repeatUnit}
                  onChange={(e) => setRepeatUnit(e.target.value as RepeatUnit)}
                  className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
                >
                  {repeatUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}s
                    </option>
                  ))}
                </select>
              </div>
            )}
          </Field>

          <Field
            label="Time frame"
            trailing={
              timeFrame === 0 ? 'tracked under another task' : 'minutes'
            }
          >
            <div className="flex flex-wrap items-center gap-2 font-mono">
              <Stepper onClick={() => stepMins(-15)} disabled={timeFrame === 0}>
                −15
              </Stepper>
              <Stepper onClick={() => stepMins(-1)} disabled={timeFrame === 0}>
                −1
              </Stepper>
              <span
                className="dtn-heading tabular-nums"
                style={{
                  fontSize: '1.5rem',
                  minWidth: '4ch',
                  textAlign: 'center',
                }}
              >
                {displayedMinutes}
              </span>
              <Stepper onClick={() => stepMins(1)}>+1</Stepper>
              <Stepper onClick={() => stepMins(15)}>+15</Stepper>
            </div>
            {errors.timeFrame && (
              <div className="mt-2 font-mono text-xs text-rose-400">
                {errors.timeFrame}
              </div>
            )}
          </Field>

          {timeFrame > 0 ? (
            <Field label="Time frame type">
              <div className="flex flex-col gap-2">
                <TimeframeTypeOption
                  active={timeframeType === 'fixed'}
                  label="Fixed — target time"
                  description="The time frame is the goal. If you overshoot, the extra rolls into the next instance. Best for habits where the time itself is the point (read 30 min/day)."
                  onClick={() => setTimeframeType('fixed')}
                />
                <TimeframeTypeOption
                  active={timeframeType === 'fluid'}
                  label="Fluid — measured time"
                  description="The time frame is a live estimate. Each completion self-tunes the value via a 14-day rolling average. Best when you want a realistic recurring estimate (workout, design review)."
                  onClick={() => setTimeframeType('fluid')}
                />
              </div>
            </Field>
          ) : (
            <Field
              label="Tracked under"
              trailing={
                timekeeperId ? null : 'pick a task whose timer covers this one'
              }
            >
              <input
                type="text"
                value={keeperFilter}
                onChange={(e) => setKeeperFilter(e.target.value)}
                placeholder="Search keepers…"
                className="mb-2 w-full rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-zinc-600"
              />
              <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
                {filteredKeepers.length === 0 ? (
                  <div className="font-mono text-xs text-zinc-500">
                    {allTasksQuery.isPending
                      ? 'Loading…'
                      : 'No matching keepers. Create one with a positive time frame first.'}
                  </div>
                ) : (
                  filteredKeepers.map((t) => {
                    const selected = timekeeperId === t.id
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTimekeeperId(t.id)}
                        className={
                          'flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ' +
                          (selected
                            ? 'border-zinc-100 bg-zinc-100/10'
                            : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700')
                        }
                      >
                        <span className="text-xl leading-none">{t.emoji}</span>
                        <span className="flex-1 truncate font-mono text-sm text-zinc-100">
                          {t.title}
                        </span>
                        <span className="font-mono text-xs text-zinc-500 tabular-nums">
                          {Math.ceil(t.timeFrame)}m
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
              {errors.timekeeperId && (
                <div className="mt-2 font-mono text-xs text-rose-400">
                  {errors.timekeeperId}
                </div>
              )}
            </Field>
          )}

          <Field label="Strict deadline?">
            <div className="flex items-center gap-3 font-mono">
              <Toggle
                label="Strict deadline"
                on={strictDeadline}
                onChange={setStrictDeadline}
              />
            </div>
          </Field>

          <Field
            label="Subtasks"
            trailing={hasSubtasks ? 'drag ⠿ to reorder' : undefined}
          >
            <div className="flex items-center gap-3 font-mono">
              <Toggle
                label="Add subtasks"
                on={hasSubtasks}
                onChange={async (on) => {
                  if (!on && subtasks.length > 0) {
                    const ok = await confirm({
                      message: 'Remove all subtasks?',
                      confirmLabel: 'Remove',
                    })
                    if (!ok) return
                  }
                  if (!on) setSubtasks([])
                  else if (subtasks.length === 0)
                    setSubtasks([{ done: false, title: '', _key: newKey() }])
                  setHasSubtasks(on)
                }}
              />
            </div>
            {hasSubtasks && (
              <div className="mt-3 flex flex-col gap-1.5 font-mono">
                {subtasks.map((s, i) => (
                  <Fragment key={s._key}>
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, s)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, s)}
                      className="group flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2"
                    >
                      <span className="cursor-grab text-zinc-600 select-none">
                        ⠿
                      </span>
                      <input
                        type="text"
                        value={s.title}
                        onChange={(e) =>
                          setSubtasks([
                            ...subtasks.slice(0, i),
                            { ...s, title: e.target.value },
                            ...subtasks.slice(i + 1),
                          ])
                        }
                        placeholder={`Subtask ${i + 1}`}
                        aria-label={`Subtask ${i + 1}`}
                        className="flex-1 bg-transparent font-mono text-base text-zinc-100 outline-none placeholder:text-zinc-700"
                      />
                      <label className="flex items-center gap-1.5 text-[10px] tracking-wider text-zinc-500 uppercase">
                        <input
                          type="checkbox"
                          checked={s.done}
                          onChange={(e) =>
                            setSubtasks((sub) => [
                              ...sub.slice(0, i),
                              { ...sub[i], done: e.target.checked },
                              ...sub.slice(i + 1),
                            ])
                          }
                          className="accent-zinc-100"
                        />
                        done?
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setSubtasks((sub) => [
                            ...sub.slice(0, i),
                            ...sub.slice(i + 1),
                          ])
                        }
                        className="px-2 text-zinc-600 hover:text-rose-400"
                        aria-label="Remove subtask"
                        title="Remove subtask"
                      >
                        ✕
                      </button>
                    </div>
                  </Fragment>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setSubtasks([
                      ...subtasks,
                      { done: false, title: '', _key: newKey() },
                    ])
                  }
                  className="mt-1 flex items-center gap-2 self-start rounded-full border border-dashed border-zinc-700 px-3 py-1.5 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                >
                  <span>+</span>
                  <span>Add subtask</span>
                </button>
              </div>
            )}
          </Field>
        </div>
      </div>

      <div className="fixed right-0 bottom-[88px] left-0 z-40 flex items-center justify-between gap-3 border-t border-zinc-900 bg-black/60 px-5 py-4 backdrop-blur md:bottom-0 md:px-10 md:py-5">
        <div className="hidden md:block">
          <KeyHints
            items={[
              ['↵', 'submit'],
              ['Esc', 'cancel'],
              ...(isEdit ? ([['⌫', 'delete']] as const) : []),
            ]}
          />
        </div>
        <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
          {isEdit && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete task"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-rose-500/30 font-mono text-rose-300 hover:bg-rose-500/10 md:h-auto md:w-auto md:gap-2 md:px-4 md:py-2.5 md:text-sm"
            >
              <span>✕</span>
              <span className="hidden md:inline">Delete task</span>
              <kbd className="hidden rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold md:inline">
                ⌫
              </kbd>
            </button>
          )}
          <button
            type="submit"
            disabled={isSaving}
            className="flex flex-1 items-center justify-center gap-3 rounded-full bg-zinc-50 px-6 py-3 font-mono font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-60 md:flex-none"
          >
            <span>{isEdit ? 'Save' : 'Create task'}</span>
            <kbd className="hidden rounded-md bg-black/15 px-2 py-1 text-xs font-bold md:inline">
              ↵
            </kbd>
          </button>
        </div>
      </div>
    </form>
  )
}

const Field = ({
  label,
  trailing,
  children,
}: {
  label: string
  trailing?: ReactNode
  children: ReactNode
}) => {
  const labelId = useId()
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <div
          id={labelId}
          className="font-mono text-[10px] tracking-[0.3em] text-zinc-500 uppercase"
        >
          {label}
        </div>
        {trailing && (
          <div className="font-mono text-[10px] text-zinc-600">{trailing}</div>
        )}
      </div>
      <div role="group" aria-labelledby={labelId}>
        {children}
      </div>
    </div>
  )
}

const Stepper = ({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className="flex h-8 min-w-[2rem] items-center justify-center rounded-full border border-zinc-800 px-2 font-mono text-xs leading-none text-zinc-300 hover:border-zinc-600 disabled:opacity-30 disabled:hover:border-zinc-800"
  >
    {children}
  </button>
)

const TimeframeTypeOption = ({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean
  label: string
  description: string
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className={
      'rounded-xl border px-4 py-3 text-left font-mono transition-colors ' +
      (active
        ? 'border-zinc-100 bg-zinc-100/10'
        : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700')
    }
    aria-pressed={active}
  >
    <div className="flex items-center gap-2">
      <span
        className={
          'h-3 w-3 rounded-full border ' +
          (active ? 'border-zinc-50 bg-zinc-50' : 'border-zinc-600')
        }
      />
      <span className="text-sm font-semibold text-zinc-100">{label}</span>
    </div>
    <p className="mt-1 pl-5 text-xs leading-5 text-zinc-500">{description}</p>
  </button>
)

const Toggle = ({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (on: boolean) => void
  label: string
}) => (
  <button
    type="button"
    onClick={() => onChange(!on)}
    aria-pressed={on}
    aria-label={label}
    className={
      'relative inline-block h-6 w-11 rounded-full transition-colors ' +
      (on ? 'bg-zinc-50' : 'bg-zinc-800')
    }
  >
    <span
      className={
        'absolute top-0.5 h-5 w-5 rounded-full transition-all ' +
        (on ? 'left-[22px] bg-zinc-900' : 'left-0.5 bg-zinc-400')
      }
    />
  </button>
)

const RepeatChip = ({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    onClick={onClick}
    className={
      'rounded-full border px-3 py-1.5 text-sm transition-colors ' +
      (active
        ? 'border-zinc-100 bg-zinc-100 text-zinc-900'
        : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-600 hover:text-zinc-100')
    }
  >
    {label}
  </button>
)

export default TaskForm
export type { TaskInput as TaskFormInput }
