import { type ReactNode } from 'react'
import { Text, View } from 'react-native'

import type { Task } from '@dtn/shared/types'
import { DateTag, Repeat, Strict, TimeFrame } from './Tags'

export function TaskBox({
  task,
  trailing,
}: {
  task: Task
  trailing?: ReactNode
}) {
  return (
    <View className="flex-col gap-1 border-b border-gray-800 bg-black p-4">
      <View className="flex-row items-center gap-2">
        <Text className="text-xl leading-none">{task.emoji}</Text>
        <Text className="flex-1 text-white">{task.title}</Text>
        {trailing}
      </View>
      <View className="flex-row flex-wrap">
        <DateTag due={task.due} dueTime={task.dueTime} />
        <TimeFrame timeFrame={task.timeFrame} />
        <Repeat
          repeat={task.repeat}
          repeatInterval={task.repeatInterval}
          repeatUnit={task.repeatUnit}
          repeatWeekdays={task.repeatWeekdays}
        />
        <Strict strictDeadline={task.strictDeadline} />
      </View>
    </View>
  )
}
