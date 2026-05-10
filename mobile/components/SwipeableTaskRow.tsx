import {
  faBell,
  faCheck,
  faChevronDown,
  faChevronRight,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import * as Haptics from 'expo-haptics'
import { useRef, useState } from 'react'
import { ActionSheetIOS, Alert, Platform, Pressable, Text, View } from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'

import type { Task } from '@dtn/shared/types'
import { TaskBox } from './TaskBox'

const ACTION_W = 96

export function SwipeableTaskRow({
  task,
  onComplete,
  onSnooze,
  onEdit,
  onDelete,
}: {
  task: Task
  onComplete: () => void
  onSnooze: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const ref = useRef<Swipeable>(null)
  const close = () => ref.current?.close()
  const [expanded, setExpanded] = useState(false)
  const hasSubtasks = task.subtasks.length > 0
  const subtasksDone = task.subtasks.filter((s) => s.done).length

  const renderLeftActions = () => (
    <View
      style={{
        width: ACTION_W,
        backgroundColor: '#16a34a',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingRight: 24,
      }}
    >
      <FontAwesomeIcon icon={faCheck} size={22} color="#fff" />
    </View>
  )

  const renderRightActions = () => (
    <View
      style={{
        width: ACTION_W,
        backgroundColor: '#a16207',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingLeft: 24,
      }}
    >
      <FontAwesomeIcon icon={faBell} size={22} color="#fff" />
    </View>
  )

  // Auto-fire the primary action whenever the swipe crosses threshold.
  const onSwipeableOpen = (direction: 'left' | 'right') => {
    if (direction === 'left') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onComplete()
    } else {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      onSnooze()
    }
    setTimeout(close, 100)
  }

  const onTap = () => {
    if (!hasSubtasks) return
    void Haptics.selectionAsync()
    setExpanded((x) => !x)
  }

  const onLongPress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Edit', 'Snooze', 'Delete'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 3,
          title: task.title,
        },
        (i) => {
          if (i === 1) onEdit()
          else if (i === 2) onSnooze()
          else if (i === 3) onDelete()
        },
      )
    } else {
      Alert.alert(task.title, undefined, [
        { text: 'Edit', onPress: onEdit },
        { text: 'Snooze', onPress: onSnooze },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
        { text: 'Cancel', style: 'cancel' },
      ])
    }
  }

  return (
    <Swipeable
      ref={ref}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      friction={1.6}
      leftThreshold={ACTION_W * 0.6}
      rightThreshold={ACTION_W * 0.6}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableOpen={onSwipeableOpen}
    >
      <Pressable
        onPress={onTap}
        onLongPress={onLongPress}
        delayLongPress={350}
        android_ripple={{ color: '#1f2937' }}
      >
        <TaskBox
          task={task}
          trailing={
            hasSubtasks ? (
              <View className="flex-row items-center gap-1">
                <Text className="text-xs text-gray-500">
                  {subtasksDone}/{task.subtasks.length}
                </Text>
                <FontAwesomeIcon
                  icon={expanded ? faChevronDown : faChevronRight}
                  size={10}
                  color="#6b7280"
                />
              </View>
            ) : null
          }
        />
        {expanded && hasSubtasks && (
          <View className="border-b border-gray-800 bg-gray-950 py-2">
            {task.subtasks.map((s, i) => {
              const isSnoozed =
                !!s.snooze && new Date(s.snooze) > new Date()
              return (
                <View
                  key={i}
                  className="flex-row items-center gap-3 px-6 py-1.5"
                >
                  <View
                    className={
                      'h-4 w-4 items-center justify-center rounded-full border ' +
                      (s.done
                        ? 'border-green-700 bg-green-700'
                        : 'border-gray-700 bg-black')
                    }
                  >
                    {s.done && (
                      <FontAwesomeIcon icon={faCheck} size={8} color="#fff" />
                    )}
                  </View>
                  <Text
                    className={
                      'flex-1 text-sm ' +
                      (s.done
                        ? 'text-gray-600 line-through'
                        : isSnoozed
                          ? 'text-gray-500'
                          : 'text-gray-200')
                    }
                  >
                    {s.title}
                  </Text>
                  {isSnoozed && (
                    <Text className="text-[10px] text-gray-600">snoozed</Text>
                  )}
                </View>
              )
            })}
          </View>
        )}
      </Pressable>
    </Swipeable>
  )
}
