import { useApi } from '@dtn/shared/api-client'
import { formatDueDistance } from '@dtn/shared/format'
import {
  dateString,
  newSafeDate,
  newSafeDateTime,
} from '@dtn/shared/helpers'
import { useAllTasks } from '@dtn/shared/queries'
import {
  type RepeatOption,
  type RepeatUnit,
  type RepeatWeekdays,
  type SubTask,
  type TaskInput,
  type TimeframeType,
  taskInputSchema,
} from '@dtn/shared/task-input'
import DateTimePicker from '@react-native-community/datetimepicker'
import { format } from 'date-fns'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch as RNSwitch,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const ACCENT = '#34d399'
const OVERDUE = '#fb7185'

const dayShort = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const

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

type Props = {
  initial?: Partial<{
    title: string
    emoji: string
    dueMonth: number
    dueDay: number
    dueYear: number
    dueTime: string | null
    strictDeadline: boolean
    repeat: RepeatOption
    repeatInterval: number
    repeatUnit: RepeatUnit
    repeatWeekdays: RepeatWeekdays
    timeFrame: number
    timekeeperId: string | null
    timeframeType: TimeframeType
    subtasks: SubTask[]
    notes: string | null
    tags: string[]
  }>
  // Required in edit mode so we can exclude this task from its own
  // keeper-candidate list.
  taskId?: string
  isSaving?: boolean
  errorMessage?: string | null
  onSubmit: (input: TaskInput) => void
  onDelete?: () => void
}

export function TaskForm({
  initial = {},
  taskId,
  isSaving = false,
  errorMessage,
  onSubmit,
  onDelete,
}: Props) {
  const api = useApi()
  const [title, setTitle] = useState(initial.title ?? '')
  const [emoji, setEmoji] = useState(initial.emoji ?? '')
  const [emojiOptions, setEmojiOptions] = useState<string[]>(
    initial.emoji ? [initial.emoji] : [],
  )
  const [emojiLoading, setEmojiLoading] = useState(false)
  const [dueDate, setDueDate] = useState(
    initial.dueYear && initial.dueMonth && initial.dueDay
      ? new Date(initial.dueYear, initial.dueMonth - 1, initial.dueDay)
      : newSafeDate(dateString(new Date())),
  )
  const [dueTime, setDueTime] = useState<string | null>(initial.dueTime ?? null)
  const [strictDeadline, setStrictDeadline] = useState(
    initial.strictDeadline ?? false,
  )
  const [repeat, setRepeat] = useState<RepeatOption>(
    initial.repeat ?? 'No Repeat',
  )
  const [repeatInterval, setRepeatInterval] = useState(
    initial.repeatInterval ?? 1,
  )
  const [repeatUnit, setRepeatUnit] = useState<RepeatUnit>(
    initial.repeatUnit ?? 'day',
  )
  const [repeatWeekdays, setRepeatWeekdays] = useState<RepeatWeekdays>(
    initial.repeatWeekdays ?? [false, false, false, false, false, false, false],
  )
  const [timeFrame, setTimeFrame] = useState(initial.timeFrame ?? 0)
  const [timekeeperId, setTimekeeperId] = useState<string | null>(
    initial.timekeeperId ?? null,
  )
  const [timeframeType, setTimeframeType] = useState<TimeframeType>(
    initial.timeframeType ?? 'fixed',
  )
  const nextSubtaskKey = useRef(0)
  const newKey = () => `s${++nextSubtaskKey.current}`
  const [subtasks, setSubtasks] = useState<Array<SubTask & { _key: string }>>(
    () => (initial.subtasks ?? []).map((s) => ({ ...s, _key: newKey() })),
  )
  const [hasSubtasks, setHasSubtasks] = useState(subtasks.length > 0)
  const [notes, setNotes] = useState(initial.notes ?? '')
  const [tags, setTags] = useState<Array<string>>(initial.tags ?? [])
  const [tagDraft, setTagDraft] = useState('')
  const addTag = () => {
    const t = tagDraft.trim()
    if (t && !tags.some((x) => x.toLowerCase() === t.toLowerCase()))
      setTags([...tags, t])
    setTagDraft('')
  }
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [openSheet, setOpenSheet] = useState<
    null | 'date' | 'dueTime' | 'time' | 'repeat' | 'keeper'
  >(null)

  // Eligible timekeepers: this user's fixed-type tasks with a positive
  // time frame, excluding the current task.
  const allTasksQuery = useAllTasks({ enabled: timeFrame === 0 })
  const keeperCandidates = (allTasksQuery.data ?? [])
    .filter(
      (t) =>
        t.timeframeType === 'fixed' &&
        t.timeFrame > 0 &&
        (!taskId || t.id !== taskId),
    )
    .sort((a, b) => a.title.localeCompare(b.title))
  const selectedKeeper = keeperCandidates.find((t) => t.id === timekeeperId)

  useEffect(() => {
    const t = title.trim()
    if (!t) {
      setEmojiOptions(initial.emoji ? [initial.emoji] : [])
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
  }, [title, api, initial.emoji])

  const dayDiff = Math.round(
    (dueDate.getTime() - newSafeDate(dateString(new Date())).getTime()) /
      (1000 * 60 * 60 * 24),
  )
  const dayDiffPhrase = formatDueDistance(dayDiff)

  const quickDue = (deltaDays: number) => {
    const d = new Date()
    d.setDate(d.getDate() + deltaDays)
    // Normalize to local midnight so dayDiff (and its phrase) match the
    // picker's behavior — a wall-clock time skews the day-distance label.
    setDueDate(newSafeDate(dateString(d)))
  }
  const dueQuickOptions = [
    { label: 'Today', delta: 0 },
    { label: 'Tomorrow', delta: 1 },
    { label: '+1 wk', delta: 7 },
  ].map((o) => {
    const d = new Date()
    d.setDate(d.getDate() + o.delta)
    return { ...o, due: dateString(d) }
  })

  const repeatSummary =
    repeat === 'No Repeat'
      ? 'Never'
      : repeat === 'Custom'
        ? `every ${repeatInterval} ${repeatUnit}${repeatInterval === 1 ? '' : 's'}`
        : repeat.toLowerCase()

  const displayedMinutes = Math.ceil(timeFrame)
  const timeSummary =
    timeFrame === 0
      ? '0 min (tracked elsewhere)'
      : `${displayedMinutes} min`

  const dueTimeAsDate = dueTime
    ? newSafeDateTime('2000-1-1', dueTime)
    : new Date(2000, 0, 1, 9, 0)
  const dueTimeSummary = dueTime ? format(dueTimeAsDate, 'h:mm a') : 'None'

  const submit = () => {
    const parsed = taskInputSchema.safeParse({
      title,
      emoji,
      due: dateString(dueDate),
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
      tags,
    })
    if (!parsed.success) {
      const flat: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const k = issue.path.join('.') || '_'
        if (!flat[k]) flat[k] = issue.message
      }
      setErrors(flat)
      return
    }
    setErrors({})
    onSubmit(parsed.data)
  }

  const errorList = Object.entries(errors)

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: 140,
          gap: 20,
        }}
      >
        {errorMessage && (
          <Text
            accessibilityLiveRegion="assertive"
            style={{ color: OVERDUE, fontSize: 13, marginTop: 4 }}
          >
            {errorMessage}
          </Text>
        )}

        <Field label="Title">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Do this thing"
            placeholderTextColor="#3f3f46"
            autoFocus={!initial.title}
            style={{
              fontFamily: 'InstrumentSerif_400Regular_Italic',
              fontSize: 28,
              lineHeight: 34,
              color: '#fafafa',
              borderBottomWidth: 1,
              borderBottomColor: '#3f3f46',
              paddingVertical: 8,
            }}
          />
          {errors.title && <FieldError msg={errors.title} />}
        </Field>

        <Field label="Notes">
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Context, links, anything to remember…"
            placeholderTextColor="#3f3f46"
            multiline
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 14,
              lineHeight: 20,
              color: '#e4e4e7',
              minHeight: 64,
              borderWidth: 1,
              borderColor: '#27272a',
              borderRadius: 10,
              backgroundColor: 'rgba(24,24,27,0.4)',
              paddingHorizontal: 12,
              paddingVertical: 10,
              textAlignVertical: 'top',
            }}
          />
          {errors.notes && <FieldError msg={errors.notes} />}
        </Field>

        <Field label="Tags">
          {tags.length > 0 && (
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
                marginBottom: 8,
              }}
            >
              {tags.map((t) => (
                <Pressable
                  key={t}
                  onPress={() => setTags(tags.filter((x) => x !== t))}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove tag ${t}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    borderWidth: 1,
                    borderColor: '#3f3f46',
                    backgroundColor: '#18181b',
                    borderRadius: 999,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  <Text
                    style={{
                      color: '#e4e4e7',
                      fontSize: 12,
                      fontFamily: 'JetBrainsMono_400Regular',
                    }}
                  >
                    {t}
                  </Text>
                  <Text style={{ color: '#71717a', fontSize: 12 }}>✕</Text>
                </Pressable>
              ))}
            </View>
          )}
          <TextInput
            value={tagDraft}
            onChangeText={setTagDraft}
            onSubmitEditing={addTag}
            onBlur={addTag}
            blurOnSubmit={false}
            placeholder="Add a tag…"
            placeholderTextColor="#3f3f46"
            autoCapitalize="none"
            returnKeyType="done"
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 14,
              color: '#e4e4e7',
              borderWidth: 1,
              borderColor: '#27272a',
              borderRadius: 10,
              backgroundColor: 'rgba(24,24,27,0.4)',
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          />
          {errors.tags && <FieldError msg={errors.tags} />}
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
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {emojiOptions.map((e, i) => {
              const selected = e === emoji
              return (
                <Pressable
                  key={`${e}-${i}`}
                  onPress={() => setEmoji(e)}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selected ? '#f4f4f5' : '#27272a',
                    backgroundColor: selected
                      ? 'rgba(244,244,245,0.1)'
                      : 'rgba(24,24,27,0.6)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{e}</Text>
                </Pressable>
              )
            })}
            {emojiLoading && (
              <View
                style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 6,
                }}
              >
                <ActivityIndicator size="small" color="#71717a" />
              </View>
            )}
          </View>
          {errors.emoji && <FieldError msg={errors.emoji} />}
        </Field>

        <Field label="Due date">
          <SettingRow
            value={`${format(dueDate, 'EEE · LLL d, u')}`}
            sub={dayDiffPhrase}
            onPress={() => setOpenSheet('date')}
          />
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
              marginTop: 8,
            }}
          >
            {dueQuickOptions.map((o) => {
              const active = dateString(dueDate) === o.due
              return (
                <Pressable
                  key={o.label}
                  onPress={() => quickDue(o.delta)}
                  style={{
                    borderWidth: 1,
                    borderColor: active ? '#f4f4f5' : '#27272a',
                    backgroundColor: active ? '#fafafa' : 'rgba(24,24,27,0.6)',
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'JetBrainsMono_400Regular',
                      fontSize: 12,
                      color: active ? '#0a0a0a' : '#a1a1aa',
                    }}
                  >
                    {o.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </Field>

        <Field label="Due time">
          <SettingRow
            value={dueTimeSummary}
            sub={dueTime ? `ranks to top once ${dueTimeSummary}` : 'optional'}
            onPress={() => setOpenSheet('dueTime')}
          />
        </Field>

        <Field label="Repeat">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {repeatOptions.map((r) => {
              const active = repeat === r
              return (
                <Pressable
                  key={r}
                  onPress={() => setRepeat(r)}
                  style={{
                    borderWidth: 1,
                    borderColor: active ? '#f4f4f5' : '#27272a',
                    backgroundColor: active
                      ? '#fafafa'
                      : 'rgba(24,24,27,0.6)',
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 999,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'JetBrainsMono_400Regular',
                      fontSize: 12,
                      color: active ? '#0a0a0a' : '#a1a1aa',
                    }}
                  >
                    {r}
                  </Text>
                </Pressable>
              )
            })}
          </View>
          {(repeat === 'Weekly' ||
            (repeat === 'Custom' && repeatUnit === 'week')) && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
              {dayShort.map((d, i) => {
                const on = repeatWeekdays[i]
                return (
                  <Pressable
                    key={d}
                    onPress={() =>
                      setRepeatWeekdays(
                        (s) =>
                          s.map((v, idx) =>
                            idx === i ? !v : v,
                          ) as RepeatWeekdays,
                      )
                    }
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: on ? '#f4f4f5' : '#27272a',
                      backgroundColor: on ? '#fafafa' : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'JetBrainsMono_400Regular',
                        fontSize: 11,
                        color: on ? '#0a0a0a' : '#a1a1aa',
                      }}
                    >
                      {d}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          )}
          {repeat === 'Custom' && (
            <View style={{ marginTop: 12 }}>
              <SettingRow
                value={`every ${repeatInterval} ${repeatUnit}${repeatInterval === 1 ? '' : 's'}`}
                sub="tap to change interval"
                onPress={() => setOpenSheet('repeat')}
              />
            </View>
          )}
        </Field>

        <Field label="Time frame">
          <SettingRow
            value={timeSummary}
            sub="tap to adjust"
            onPress={() => setOpenSheet('time')}
          />
        </Field>

        {timeFrame > 0 ? (
          <Field label="Time frame type">
            <View style={{ gap: 8 }}>
              <TimeframeTypeOption
                active={timeframeType === 'fixed'}
                label="Fixed — target time"
                description="The time frame is the goal. If you overshoot, the extra rolls into the next instance. Best for habits where the time itself is the point (read 30 min/day)."
                onPress={() => setTimeframeType('fixed')}
              />
              <TimeframeTypeOption
                active={timeframeType === 'fluid'}
                label="Fluid — measured time"
                description="The time frame is a live estimate. Each completion self-tunes via a 14-day rolling average. Best when you want a realistic recurring estimate (workout, design review)."
                onPress={() => setTimeframeType('fluid')}
              />
            </View>
          </Field>
        ) : (
          <Field
            label="Tracked under"
            trailing={selectedKeeper ? undefined : 'pick a keeper'}
          >
            <SettingRow
              value={
                selectedKeeper
                  ? `${selectedKeeper.emoji} ${selectedKeeper.title}`
                  : 'No keeper selected'
              }
              sub={
                selectedKeeper
                  ? `${Math.ceil(selectedKeeper.timeFrame)}m timer covers this task`
                  : 'tap to pick a fixed task whose timer covers this one'
              }
              onPress={() => setOpenSheet('keeper')}
            />
            {errors.timekeeperId && (
              <Text style={{ color: OVERDUE, fontSize: 11, marginTop: 6 }}>
                {errors.timekeeperId}
              </Text>
            )}
          </Field>
        )}

        <Field label="Strict deadline">
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 13,
                color: '#a1a1aa',
              }}
            >
              Lock this task to its due time
            </Text>
            <RNSwitch
              accessibilityLabel="Strict deadline"
              value={strictDeadline}
              onValueChange={setStrictDeadline}
              trackColor={{ false: '#27272a', true: ACCENT }}
              thumbColor="#fafafa"
            />
          </View>
        </Field>

        <Field
          label="Subtasks"
          trailing={hasSubtasks ? 'long-press a row to reorder' : undefined}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 13,
                color: '#a1a1aa',
              }}
            >
              Use subtasks
            </Text>
            <RNSwitch
              value={hasSubtasks}
              onValueChange={(v) => {
                if (!v && subtasks.length > 0) {
                  Alert.alert(
                    'Remove subtasks?',
                    'This will clear all subtasks.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => {
                          setSubtasks([])
                          setHasSubtasks(false)
                        },
                      },
                    ],
                  )
                  return
                }
                if (!v) setSubtasks([])
                else if (subtasks.length === 0)
                  setSubtasks([{ done: false, title: '', _key: newKey() }])
                setHasSubtasks(v)
              }}
              trackColor={{ false: '#27272a', true: ACCENT }}
              thumbColor="#fafafa"
            />
          </View>
          {hasSubtasks && (
            <View style={{ marginTop: 12, gap: 6 }}>
              {subtasks.map((s, i) => (
                <View
                  key={s._key}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#27272a',
                    backgroundColor: 'rgba(24,24,27,0.4)',
                  }}
                >
                  <Pressable
                    onPress={() =>
                      setSubtasks((arr) =>
                        arr.map((x, idx) =>
                          idx === i ? { ...x, done: !x.done } : x,
                        ),
                      )
                    }
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      borderWidth: 1,
                      borderColor: s.done ? ACCENT : '#3f3f46',
                      backgroundColor: s.done ? ACCENT : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {s.done && (
                      <Text style={{ color: '#0a0a0a', fontSize: 10 }}>✓</Text>
                    )}
                  </Pressable>
                  <TextInput
                    value={s.title}
                    onChangeText={(text) =>
                      setSubtasks((arr) =>
                        arr.map((x, idx) =>
                          idx === i ? { ...x, title: text } : x,
                        ),
                      )
                    }
                    placeholder={`Subtask ${i + 1}`}
                    placeholderTextColor="#3f3f46"
                    accessibilityLabel={`Subtask ${i + 1}`}
                    style={{
                      flex: 1,
                      fontFamily: 'JetBrainsMono_400Regular',
                      color: '#fafafa',
                      fontSize: 14,
                    }}
                  />
                  <Pressable
                    onPress={() =>
                      setSubtasks((arr) => arr.filter((_, idx) => idx !== i))
                    }
                    hitSlop={8}
                  >
                    <Text style={{ color: '#52525b', fontSize: 16 }}>✕</Text>
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={() =>
                  setSubtasks((s) => [
                    ...s,
                    { done: false, title: '', _key: newKey() },
                  ])
                }
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: '#3f3f46',
                  borderStyle: 'dashed',
                }}
              >
                <Text style={{ color: '#a1a1aa', fontSize: 14 }}>+</Text>
                <Text
                  style={{
                    fontFamily: 'JetBrainsMono_400Regular',
                    color: '#a1a1aa',
                    fontSize: 12,
                  }}
                >
                  Add subtask
                </Text>
              </Pressable>
            </View>
          )}
        </Field>

        {errorList.length > 0 && (
          <View
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(251,113,133,0.3)',
              backgroundColor: 'rgba(251,113,133,0.08)',
              paddingHorizontal: 12,
              paddingVertical: 10,
              gap: 4,
            }}
          >
            {errorList.map(([k, msg]) => (
              <Text
                key={k}
                style={{
                  fontFamily: 'JetBrainsMono_400Regular',
                  color: OVERDUE,
                  fontSize: 11,
                }}
              >
                {k}: {msg}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>

      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: 24,
          backgroundColor: 'rgba(10,10,10,0.95)',
          borderTopWidth: 1,
          borderTopColor: '#18181b',
          flexDirection: 'row',
          gap: 10,
        }}
      >
        {onDelete && (
          <Pressable
            onPress={onDelete}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              borderWidth: 1,
              borderColor: 'rgba(251,113,133,0.3)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: OVERDUE, fontSize: 18 }}>✕</Text>
          </Pressable>
        )}
        <Pressable
          onPress={submit}
          disabled={isSaving}
          style={({ pressed }) => ({
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 14,
            borderRadius: 999,
            backgroundColor: pressed ? '#e4e4e7' : '#fafafa',
            opacity: isSaving ? 0.5 : 1,
          })}
        >
          {isSaving ? (
            <ActivityIndicator color="#0a0a0a" />
          ) : (
            <Text
              style={{
                fontFamily: 'JetBrainsMono_700Bold',
                color: '#0a0a0a',
                fontSize: 15,
                letterSpacing: 0.5,
              }}
            >
              {initial.title ? 'Save' : 'Create task'}
            </Text>
          )}
        </Pressable>
      </View>

      <Sheet
        open={openSheet === 'date'}
        onClose={() => setOpenSheet(null)}
        title="Due date"
      >
        <DateTimePicker
          value={dueDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          themeVariant="dark"
          onChange={(_, selected) => {
            if (Platform.OS !== 'ios') setOpenSheet(null)
            if (selected) setDueDate(selected)
          }}
        />
      </Sheet>

      <Sheet
        open={openSheet === 'dueTime'}
        onClose={() => setOpenSheet(null)}
        title="Due time"
      >
        <View style={{ alignItems: 'center', gap: 16, paddingVertical: 24 }}>
          <Text
            style={{
              fontFamily: 'JetBrainsMono_700Bold',
              fontSize: 28,
              color: '#fafafa',
            }}
          >
            {dueTimeSummary}
          </Text>
          <DateTimePicker
            value={dueTimeAsDate}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            themeVariant="dark"
            onChange={(_, selected) => {
              if (Platform.OS !== 'ios') setOpenSheet(null)
              if (!selected) return
              const hh = String(selected.getHours()).padStart(2, '0')
              const mm = String(selected.getMinutes()).padStart(2, '0')
              setDueTime(`${hh}:${mm}`)
            }}
          />
          {dueTime !== null && (
            <Pressable
              onPress={() => {
                setDueTime(null)
                setOpenSheet(null)
              }}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: '#27272a',
                backgroundColor: 'rgba(24,24,27,0.6)',
              }}
            >
              <Text
                style={{
                  fontFamily: 'JetBrainsMono_400Regular',
                  color: '#fafafa',
                }}
              >
                Remove time
              </Text>
            </Pressable>
          )}
        </View>
      </Sheet>

      <Sheet
        open={openSheet === 'time'}
        onClose={() => setOpenSheet(null)}
        title="Time frame"
      >
        <View style={{ alignItems: 'center', gap: 20, paddingVertical: 24 }}>
          <Text
            style={{
              fontFamily: 'JetBrainsMono_700Bold',
              fontSize: 32,
              color: '#fafafa',
            }}
          >
            {displayedMinutes} min
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
            {[-15, -1, 1, 15].map((delta) => (
              <Pressable
                key={delta}
                onPress={() => {
                  const next = Math.max(0, Math.round(timeFrame) + delta)
                  setTimeFrame(next)
                  // Keep the XOR invariant: positive timeFrame => no keeper.
                  if (next > 0 && timekeeperId !== null) {
                    setTimekeeperId(null)
                  }
                }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: '#27272a',
                  backgroundColor: 'rgba(24,24,27,0.6)',
                }}
              >
                <Text
                  style={{
                    fontFamily: 'JetBrainsMono_400Regular',
                    color: '#fafafa',
                    fontSize: 13,
                  }}
                >
                  {delta > 0 ? `+${delta}m` : `${delta}m`}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setTimeFrame(0)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: '#27272a',
                backgroundColor: 'rgba(24,24,27,0.6)',
              }}
            >
              <Text
                style={{
                  fontFamily: 'JetBrainsMono_400Regular',
                  color: '#fafafa',
                  fontSize: 13,
                }}
              >
                Clear
              </Text>
            </Pressable>
          </View>
        </View>
      </Sheet>

      <Sheet
        open={openSheet === 'repeat'}
        onClose={() => setOpenSheet(null)}
        title="Custom repeat"
      >
        <View style={{ paddingHorizontal: 20, paddingVertical: 16, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                color: '#a1a1aa',
                fontSize: 13,
              }}
            >
              every
            </Text>
            <TextInput
              keyboardType="numeric"
              value={String(repeatInterval)}
              onChangeText={(t) =>
                setRepeatInterval(Math.max(1, parseInt(t) || 1))
              }
              style={{
                width: 64,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: '#27272a',
                backgroundColor: 'rgba(24,24,27,0.6)',
                textAlign: 'center',
                fontFamily: 'JetBrainsMono_400Regular',
                color: '#fafafa',
              }}
            />
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {repeatUnits.map((u) => {
                const active = repeatUnit === u
                return (
                  <Pressable
                    key={u}
                    onPress={() => setRepeatUnit(u)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? '#f4f4f5' : '#27272a',
                      backgroundColor: active
                        ? '#fafafa'
                        : 'rgba(24,24,27,0.6)',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: 'JetBrainsMono_400Regular',
                        color: active ? '#0a0a0a' : '#a1a1aa',
                        fontSize: 12,
                      }}
                    >
                      {u}s
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        </View>
      </Sheet>

      <Sheet
        open={openSheet === 'keeper'}
        onClose={() => setOpenSheet(null)}
        title="Tracked under"
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 8 }}>
          {keeperCandidates.length === 0 ? (
            <Text style={{ color: '#71717a', fontSize: 12 }}>
              {allTasksQuery.isPending
                ? 'Loading…'
                : 'No matching keepers. Create a fixed task with a positive time frame first.'}
            </Text>
          ) : (
            keeperCandidates.map((t) => {
              const selected = timekeeperId === t.id
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    setTimekeeperId(t.id)
                    setOpenSheet(null)
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: selected ? '#f4f4f5' : '#27272a',
                    backgroundColor: selected
                      ? 'rgba(244,244,245,0.1)'
                      : 'rgba(24,24,27,0.4)',
                  }}
                >
                  <Text style={{ fontSize: 22, lineHeight: 24 }}>
                    {t.emoji}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      fontFamily: 'JetBrainsMono_400Regular',
                      color: '#fafafa',
                      fontSize: 14,
                    }}
                  >
                    {t.title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: 'JetBrainsMono_400Regular',
                      color: '#71717a',
                      fontSize: 12,
                    }}
                  >
                    {Math.ceil(t.timeFrame)}m
                  </Text>
                </Pressable>
              )
            })
          )}
        </View>
      </Sheet>
    </View>
  )
}

function TimeframeTypeOption({
  active,
  label,
  description,
  onPress,
}: {
  active: boolean
  label: string
  description: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={{
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active ? '#f4f4f5' : '#27272a',
        backgroundColor: active
          ? 'rgba(244,244,245,0.1)'
          : 'rgba(24,24,27,0.4)',
        paddingHorizontal: 14,
        paddingVertical: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View
          style={{
            width: 12,
            height: 12,
            borderRadius: 6,
            borderWidth: 1,
            borderColor: active ? '#fafafa' : '#52525b',
            backgroundColor: active ? '#fafafa' : 'transparent',
          }}
        />
        <Text
          style={{
            fontFamily: 'JetBrainsMono_700Bold',
            color: '#fafafa',
            fontSize: 14,
          }}
        >
          {label}
        </Text>
      </View>
      <Text
        style={{
          marginTop: 4,
          marginLeft: 20,
          fontFamily: 'JetBrainsMono_400Regular',
          color: '#71717a',
          fontSize: 11,
          lineHeight: 16,
        }}
      >
        {description}
      </Text>
    </Pressable>
  )
}

function Field({
  label,
  trailing,
  children,
}: {
  label: string
  trailing?: string
  children: ReactNode
}) {
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 10,
            letterSpacing: 2.5,
            textTransform: 'uppercase',
            color: '#71717a',
          }}
        >
          {label}
        </Text>
        {trailing && (
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 10,
              color: '#52525b',
            }}
          >
            {trailing}
          </Text>
        )}
      </View>
      {children}
    </View>
  )
}

function SettingRow({
  value,
  sub,
  onPress,
}: {
  value: string
  sub?: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        borderWidth: 1,
        borderColor: '#27272a',
        backgroundColor: pressed
          ? 'rgba(24,24,27,0.9)'
          : 'rgba(24,24,27,0.6)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      })}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            color: '#fafafa',
            fontSize: 14,
          }}
        >
          {value}
        </Text>
        {sub && (
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              color: '#71717a',
              fontSize: 11,
              marginTop: 2,
            }}
          >
            {sub}
          </Text>
        )}
      </View>
      <Text style={{ color: '#52525b', fontSize: 14 }}>▸</Text>
    </Pressable>
  )
}

function FieldError({ msg }: { msg: string }) {
  return (
    <Text
      style={{
        marginTop: 6,
        fontFamily: 'JetBrainsMono_400Regular',
        color: OVERDUE,
        fontSize: 11,
      }}
    >
      {msg}
    </Text>
  )
}

function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: '#18181b',
          }}
        >
          <Text
            style={{
              fontFamily: 'JetBrainsMono_700Bold',
              fontSize: 14,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: '#fafafa',
            }}
          >
            {title}
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={{ color: '#a1a1aa', fontSize: 18 }}>✕</Text>
          </Pressable>
        </View>
        <ScrollView>{children}</ScrollView>
      </SafeAreaView>
    </Modal>
  )
}
