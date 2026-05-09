import {
  faArrowRight,
  faMinus,
  faPlus,
  faPlusCircle,
  faTrash,
} from '@fortawesome/free-solid-svg-icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import { format } from 'date-fns'
import { useState } from 'react'
import {
  Alert,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'

import { dateString, newSafeDate } from '@dtn/shared/helpers'
import { Button } from './Button'
import { Switch } from './Switch'
import {
  type RepeatOption,
  type RepeatUnit,
  type RepeatWeekdays,
  type SubTask,
  type TaskInput,
  taskInputSchema,
} from '../lib/task-input'

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
  const [title, setTitle] = useState(initial.title ?? '')
  const [dueDate, setDueDate] = useState(
    initial.dueYear && initial.dueMonth && initial.dueDay
      ? new Date(initial.dueYear, initial.dueMonth - 1, initial.dueDay)
      : newSafeDate(dateString(new Date())),
  )
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios')
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
  const [subtasks, setSubtasks] = useState<SubTask[]>(initial.subtasks ?? [])
  const [hasSubtasks, setHasSubtasks] = useState(subtasks.length > 0)
  const [errors, setErrors] = useState<Record<string, string>>({})

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

  const submit = () => {
    const parsed = taskInputSchema.safeParse({
      title,
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
        const k = String(issue.path[0])
        if (!flat[k]) flat[k] = issue.message
      }
      setErrors(flat)
      return
    }
    setErrors({})
    onSubmit(parsed.data)
  }

  return (
    <View className="gap-4 p-5">
      {errorMessage && (
        <Text className="text-red-500">{errorMessage}</Text>
      )}

      <Field label="Title">
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Do this thing"
          placeholderTextColor="#666"
          className="rounded border border-gray-800 bg-black p-3 text-white"
        />
        {errors.title && (
          <Text className="text-sm text-red-500">{errors.title}</Text>
        )}
      </Field>

      <Field label="Due Date">
        <View className="flex-row items-center gap-2">
          <Button
            icon={faMinus}
            onPress={() => {
              const d = new Date(dueDate)
              d.setDate(d.getDate() - 1)
              setDueDate(d)
            }}
          />
          <Pressable
            onPress={() => setShowDatePicker((s) => !s)}
            className="flex-1 rounded border border-gray-800 bg-black p-3"
          >
            <Text className="text-center text-white">
              {format(dueDate, 'EEEE, LLLL do, u')} ({dayDiffPhrase})
            </Text>
          </Pressable>
          <Button
            icon={faPlus}
            onPress={() => {
              const d = new Date(dueDate)
              d.setDate(d.getDate() + 1)
              setDueDate(d)
            }}
          />
        </View>
        {showDatePicker && (
          <DateTimePicker
            value={dueDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            themeVariant="dark"
            onChange={(_, selected) => {
              if (Platform.OS !== 'ios') setShowDatePicker(false)
              if (selected) setDueDate(selected)
            }}
          />
        )}
      </Field>

      <Field label="Strict deadline">
        <Switch checked={strictDeadline} onChange={setStrictDeadline} />
      </Field>

      <Field label="Repeat">
        <View className="flex-row flex-wrap gap-2">
          {repeatOptions.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => setRepeat(opt)}
              className={
                'rounded-full border px-3 py-2 ' +
                (repeat === opt
                  ? 'border-gray-500 bg-gray-700'
                  : 'border-gray-800 bg-black')
              }
            >
              <Text className="text-sm text-white">{opt}</Text>
            </Pressable>
          ))}
        </View>
        {repeat === 'Custom' && (
          <View className="mt-3 gap-3">
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
                      'rounded-full border px-3 py-2 ' +
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
            {repeatUnit === 'week' && (
              <View className="flex-row justify-between">
                {days.map((d, i) => (
                  <Pressable
                    key={d}
                    onPress={() =>
                      setRepeatWeekdays(
                        (s) =>
                          s.map((v, idx) => (idx === i ? !v : v)) as RepeatWeekdays,
                      )
                    }
                    className={
                      'items-center rounded-lg border px-2 py-2 ' +
                      (repeatWeekdays[i]
                        ? 'border-gray-500 bg-gray-700'
                        : 'border-gray-800 bg-black')
                    }
                  >
                    <Text className="text-xs text-white">{d}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}
      </Field>

      <Field label="Expected time">
        <View className="flex-row items-center gap-2">
          <Button
            icon={faMinus}
            onPress={() => setTimeFrame(Math.max(0, timeFrame - 15))}
          />
          <Text className="flex-1 text-center text-white">
            {Math.floor(timeFrame / 60)}h {timeFrame % 60}m
          </Text>
          <Button
            icon={faPlus}
            onPress={() => setTimeFrame(timeFrame + 15)}
          />
        </View>
      </Field>

      <Field label="Subtasks">
        <Switch
          checked={hasSubtasks}
          onChange={(v) => {
            if (
              !v &&
              subtasks.length > 0
            ) {
              Alert.alert('Remove subtasks?', 'This will clear all subtasks.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => {
                    setSubtasks([])
                    setHasSubtasks(false)
                  },
                },
              ])
              return
            }
            if (!v) setSubtasks([])
            else setSubtasks([{ done: false, title: '' }])
            setHasSubtasks(v)
          }}
        />
        {hasSubtasks && (
          <View className="mt-3 gap-2">
            {subtasks.map((s, i) => (
              <View key={i} className="flex-row items-center gap-2">
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
                  placeholderTextColor="#666"
                  className="flex-1 rounded border border-gray-800 bg-black p-2 text-white"
                />
                <Switch
                  checked={s.done}
                  onChange={(v) =>
                    setSubtasks((arr) =>
                      arr.map((x, idx) =>
                        idx === i ? { ...x, done: v } : x,
                      ),
                    )
                  }
                />
                <Button
                  icon={faTrash}
                  onPress={() =>
                    setSubtasks((arr) => arr.filter((_, idx) => idx !== i))
                  }
                />
              </View>
            ))}
            <View className="items-center">
              <Button
                icon={faPlusCircle}
                text="New subtask"
                onPress={() =>
                  setSubtasks((s) => [...s, { done: false, title: '' }])
                }
              />
            </View>
          </View>
        )}
      </Field>

      <View className="items-center pt-4">
        <Button
          icon={faArrowRight}
          text="Submit"
          onPress={submit}
          loading={isSaving}
        />
      </View>
    </View>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <View className="border-t border-gray-800 pt-4">
      <Text className="mb-2 text-sm font-medium text-white">{label}</Text>
      {children}
    </View>
  )
}
