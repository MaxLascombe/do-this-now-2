import {
  faChevronRight,
  faPlusCircle,
  faTrash,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
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

import { useApi } from '@dtn/shared/api-client'
import { dateString, newSafeDate } from '@dtn/shared/helpers'
import {
  type RepeatOption,
  type RepeatUnit,
  type RepeatWeekdays,
  type SubTask,
  type TaskInput,
  taskInputSchema,
} from '@dtn/shared/task-input'

const days = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
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

type Props = {
  initial?: Partial<{
    title: string
    emoji: string
    dueMonth: number
    dueDay: number
    dueYear: number
    strictDeadline: boolean
    repeat: RepeatOption
    repeatInterval: number
    repeatUnit: RepeatUnit
    repeatWeekdays: RepeatWeekdays
    timeFrame: number
    subtasks: SubTask[]
  }>
  isSaving?: boolean
  errorMessage?: string | null
  onSubmit: (input: TaskInput) => void
}

export function TaskForm({
  initial = {},
  isSaving = false,
  errorMessage,
  onSubmit,
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
  // Stable per-row key so reorder doesn't shuffle DOM nodes; stripped by
  // zod at submit since subTaskSchema doesn't declare _key.
  const nextSubtaskKey = useRef(0)
  const newKey = () => `s${++nextSubtaskKey.current}`
  const [subtasks, setSubtasks] = useState<Array<SubTask & { _key: string }>>(
    () => (initial.subtasks ?? []).map((s) => ({ ...s, _key: newKey() })),
  )
  const [hasSubtasks, setHasSubtasks] = useState(subtasks.length > 0)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [openSheet, setOpenSheet] = useState<
    null | 'date' | 'time' | 'repeat'
  >(null)

  // Debounced emoji suggestions — fires ~500ms after the user stops typing
  // the title. Auto-selects the first option if none chosen yet. The
  // `cancelled` flag drops stale responses.
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
  const dayDiffPhrase =
    dayDiff < 0
      ? `${Math.abs(dayDiff)} days ago`
      : dayDiff === 0
        ? 'today'
        : dayDiff === 1
          ? 'tomorrow'
          : `in ${dayDiff} days`

  const repeatSummary =
    repeat === 'No Repeat'
      ? 'Never'
      : repeat === 'Custom'
        ? `Every ${repeatInterval} ${repeatUnit}${
            repeatInterval === 1 ? '' : 's'
          }`
        : repeat

  const timeSummary =
    timeFrame === 0
      ? 'None'
      : `${Math.floor(timeFrame / 60)}h ${timeFrame % 60}m`

  const submit = () => {
    const parsed = taskInputSchema.safeParse({
      title,
      emoji,
      due: dateString(dueDate),
      strictDeadline,
      repeat,
      repeatInterval,
      repeatUnit,
      repeatWeekdays,
      timeFrame,
      subtasks,
    })
    if (!parsed.success) {
      const flat: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const k = issue.path.join('.') || '_'
        if (!flat[k]) flat[k] = issue.message
      }
      console.warn('TaskForm validation failed', flat, parsed.error.issues)
      setErrors(flat)
      return
    }
    setErrors({})
    onSubmit(parsed.data)
  }

  const errorList = Object.entries(errors)

  return (
    <View className="flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {errorMessage && (
          <Text className="px-4 pt-3 text-red-500">{errorMessage}</Text>
        )}

        <Section>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Task title"
            placeholderTextColor="#6b7280"
            className="min-h-[48px] px-4 py-2 text-lg text-white"
            autoFocus={!initial.title}
          />
          {errors.title && (
            <Text className="px-4 pb-2 text-xs text-red-500">
              {errors.title}
            </Text>
          )}
        </Section>

        <SectionHeader>Emoji</SectionHeader>
        <Section>
          {emojiOptions.length === 0 && !emojiLoading && (
            <Text className="px-4 py-3 text-sm text-gray-500">
              Type a title to see suggestions.
            </Text>
          )}
          {emojiLoading && emojiOptions.length === 0 && (
            <Text className="px-4 py-3 text-sm text-gray-500">Suggesting…</Text>
          )}
          {emojiOptions.length > 0 && (
            <View className="flex-row flex-wrap gap-2 px-4 py-3">
              {emojiOptions.map((e, i) => {
                const selected = e === emoji
                return (
                  <Pressable
                    key={`${e}-${i}`}
                    onPress={() => setEmoji(e)}
                    className={
                      'h-12 w-12 items-center justify-center rounded-lg border ' +
                      (selected
                        ? 'border-white bg-gray-800'
                        : 'border-gray-800 bg-black')
                    }
                  >
                    <Text className="text-2xl">{e}</Text>
                  </Pressable>
                )
              })}
              {emojiLoading && (
                <View className="items-center justify-center px-2">
                  <ActivityIndicator size="small" color="#6b7280" />
                </View>
              )}
            </View>
          )}
          {errors.emoji && (
            <Text className="px-4 pb-2 text-xs text-red-500">
              {errors.emoji}
            </Text>
          )}
        </Section>

        <SectionHeader>Schedule</SectionHeader>
        <Section>
          <Row
            label="Due"
            value={`${format(dueDate, 'EEE, LLL d')} · ${dayDiffPhrase}`}
            onPress={() => setOpenSheet('date')}
          />
          <Divider />
          <Row
            label="Time frame"
            value={timeSummary}
            onPress={() => setOpenSheet('time')}
          />
          <Divider />
          <ToggleRow
            label="Strict deadline"
            value={strictDeadline}
            onValueChange={setStrictDeadline}
          />
        </Section>

        <SectionHeader>Repeat</SectionHeader>
        <Section>
          <Row
            label="Repeat"
            value={repeatSummary}
            onPress={() => setOpenSheet('repeat')}
          />
          {repeat === 'Custom' && repeatUnit === 'week' && (
            <>
              <Divider />
              <View className="px-4 py-3">
                <View className="flex-row justify-between">
                  {days.map((d, i) => (
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
                      className={
                        'h-9 w-9 items-center justify-center rounded-full ' +
                        (repeatWeekdays[i] ? 'bg-white' : 'bg-gray-800')
                      }
                    >
                      <Text
                        className={
                          'text-xs ' +
                          (repeatWeekdays[i]
                            ? 'font-semibold text-black'
                            : 'text-white')
                        }
                      >
                        {d[0]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </>
          )}
        </Section>

        <SectionHeader>Subtasks</SectionHeader>
        <Section>
          <ToggleRow
            label="Use subtasks"
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
          />
          {hasSubtasks &&
            subtasks.map((s, i) => (
              <View key={s._key}>
                <Divider />
                <View className="flex-row items-center gap-2 px-4 py-2">
                  <Pressable
                    onPress={() =>
                      setSubtasks((arr) =>
                        arr.map((x, idx) =>
                          idx === i ? { ...x, done: !x.done } : x,
                        ),
                      )
                    }
                    className={
                      'h-5 w-5 rounded-full border ' +
                      (s.done
                        ? 'border-green-700 bg-green-700'
                        : 'border-gray-600 bg-black')
                    }
                  />
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
                    placeholderTextColor="#6b7280"
                    className="flex-1 text-white"
                  />
                  <Pressable
                    onPress={() =>
                      setSubtasks((arr) => arr.filter((_, idx) => idx !== i))
                    }
                    hitSlop={8}
                  >
                    <FontAwesomeIcon
                      icon={faTrash}
                      size={14}
                      color="#6b7280"
                    />
                  </Pressable>
                </View>
              </View>
            ))}
          {hasSubtasks && (
            <>
              <Divider />
              <Pressable
                onPress={() =>
                  setSubtasks((s) => [
                    ...s,
                    { done: false, title: '', _key: newKey() },
                  ])
                }
                className="flex-row items-center gap-2 px-4 py-3"
              >
                <FontAwesomeIcon
                  icon={faPlusCircle}
                  size={16}
                  color="#3b82f6"
                />
                <Text className="text-blue-400">Add subtask</Text>
              </Pressable>
            </>
          )}
        </Section>

        {errorList.length > 0 && (
          <View className="mx-4 mt-4 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2">
            {errorList.map(([k, msg]) => (
              <Text key={k} className="text-xs text-red-400">
                {k}: {msg}
              </Text>
            ))}
          </View>
        )}

        <View className="px-4 pt-6">
          <Pressable
            onPress={submit}
            disabled={isSaving}
            className="items-center justify-center rounded-xl bg-white py-4 active:opacity-80 disabled:opacity-50"
          >
            {isSaving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="text-base font-semibold text-black">Save</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <Sheet open={openSheet === 'date'} onClose={() => setOpenSheet(null)} title="Due date">
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

      <Sheet open={openSheet === 'time'} onClose={() => setOpenSheet(null)} title="Time frame">
        <View className="items-center gap-4 px-6 py-6">
          <Text className="text-3xl font-semibold text-white">
            {Math.floor(timeFrame / 60)}h {timeFrame % 60}m
          </Text>
          <View className="flex-row gap-3">
            {[15, 30, 60, -15].map((delta) => (
              <Pressable
                key={delta}
                onPress={() => setTimeFrame(Math.max(0, timeFrame + delta))}
                className="rounded-full border border-gray-700 bg-gray-900 px-4 py-2"
              >
                <Text className="text-white">
                  {delta > 0 ? `+${delta}m` : `${delta}m`}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => setTimeFrame(0)}
              className="rounded-full border border-gray-700 bg-gray-900 px-4 py-2"
            >
              <Text className="text-white">Clear</Text>
            </Pressable>
          </View>
        </View>
      </Sheet>

      <Sheet
        open={openSheet === 'repeat'}
        onClose={() => setOpenSheet(null)}
        title="Repeat"
      >
        <View className="px-4 pb-4">
          {repeatOptions.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => setRepeat(opt)}
              className="flex-row items-center justify-between border-b border-gray-800 py-3"
            >
              <Text className="text-base text-white">{opt}</Text>
              {repeat === opt && (
                <View className="h-2 w-2 rounded-full bg-white" />
              )}
            </Pressable>
          ))}
          {repeat === 'Custom' && (
            <View className="mt-4 gap-3">
              <View className="flex-row items-center gap-2">
                <Text className="text-white">Every</Text>
                <TextInput
                  keyboardType="numeric"
                  value={String(repeatInterval)}
                  onChangeText={(t) =>
                    setRepeatInterval(Math.max(1, parseInt(t) || 1))
                  }
                  className="w-16 rounded border border-gray-800 bg-black p-2 text-center text-white"
                />
                <View className="flex-row gap-1">
                  {repeatUnits.map((u) => (
                    <Pressable
                      key={u}
                      onPress={() => setRepeatUnit(u)}
                      className={
                        'rounded-full border px-3 py-1.5 ' +
                        (repeatUnit === u
                          ? 'border-gray-500 bg-gray-700'
                          : 'border-gray-800 bg-black')
                      }
                    >
                      <Text className="text-sm text-white">{u}s</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          )}
        </View>
      </Sheet>
    </View>
  )
}

function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <Text className="px-4 pb-1 pt-5 text-xs uppercase tracking-wide text-gray-500">
      {children}
    </Text>
  )
}

function Section({ children }: { children: ReactNode }) {
  return (
    <View className="border-y border-gray-800 bg-[#0a0a0a]">{children}</View>
  )
}

function Divider() {
  return <View className="ml-4 h-px bg-gray-900" />
}

function Row({
  label,
  value,
  onPress,
}: {
  label: string
  value: string
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      className="min-h-[44px] flex-row items-center justify-between px-4 py-2"
    >
      <Text className="text-base text-white">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Text className="text-sm text-gray-400">{value}</Text>
        <FontAwesomeIcon icon={faChevronRight} size={12} color="#4b5563" />
      </View>
    </Pressable>
  )
}

function ToggleRow({
  label,
  value,
  onValueChange,
}: {
  label: string
  value: boolean
  onValueChange: (v: boolean) => void
}) {
  return (
    <View className="min-h-[44px] flex-row items-center justify-between px-4 py-1">
      <Text className="text-base text-white">{label}</Text>
      <RNSwitch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#374151', true: '#22c55e' }}
        thumbColor="#fff"
      />
    </View>
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
      <SafeAreaView className="flex-1 bg-black">
        <View className="flex-row items-center justify-between border-b border-gray-800 px-4 py-3">
          <Text className="text-lg font-semibold text-white">{title}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <FontAwesomeIcon icon={faXmark} size={20} color="#9ca3af" />
          </Pressable>
        </View>
        <ScrollView>{children}</ScrollView>
      </SafeAreaView>
    </Modal>
  )
}
