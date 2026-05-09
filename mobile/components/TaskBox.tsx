import { Text, TouchableOpacity, View } from 'react-native'

import type { Task } from '@dtn/shared/types'
import { DateTag, Repeat, Strict, TimeFrame } from './Tags'

export function TaskBox({
  isSelected,
  onPress,
  task,
}: {
  isSelected: boolean
  onPress?: () => void
  task: Task
}) {
  const showSubtask = isSelected && task.subtasks.length > 0
  const subtasksDone = task.subtasks.reduce(
    (acc, s) => acc + (s.done ? 1 : 0),
    0,
  )

  const displayTitle = showSubtask
    ? (task.subtasks.find(
        (s) =>
          !s.done && (!s.snooze || new Date(s.snooze) < new Date()),
      )?.title ??
      task.subtasks.find((s) => !s.done)?.title ??
      task.title)
    : task.title

  return (
    <TouchableOpacity
      onPress={onPress}
      className={
        (isSelected
          ? 'border-gray-700 bg-gray-900 '
          : 'border-gray-800 bg-black ') +
        'mx-auto mb-2 w-full max-w-sm flex-col gap-2 rounded-lg border p-4'
      }
    >
      <Text className="text-white">{displayTitle}</Text>
      {showSubtask && (
        <Text className="text-xs text-gray-300">
          {task.title} ({subtasksDone}/{task.subtasks.length})
        </Text>
      )}
      <View className="flex-row flex-wrap">
        <DateTag due={task.due} />
        <TimeFrame timeFrame={task.timeFrame} />
        <Repeat
          repeat={task.repeat}
          repeatInterval={task.repeatInterval}
          repeatUnit={task.repeatUnit}
          repeatWeekdays={task.repeatWeekdays}
        />
        <Strict strictDeadline={task.strictDeadline} />
      </View>
    </TouchableOpacity>
  )
}
