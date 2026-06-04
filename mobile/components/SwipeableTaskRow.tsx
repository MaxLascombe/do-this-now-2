import { useSetPinned } from '@dtn/shared/queries'
import * as Haptics from 'expo-haptics'
import { memo, useRef, useState } from 'react'
import {
  ActionSheetIOS,
  Alert,
  Platform,
  Text,
  View,
  type AccessibilityActionEvent,
} from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'

import type { Task } from '@dtn/shared/types'
import { TaskRow } from './TaskRow'

const ACTION_W = 96

function SwipeableTaskRowBase({
  task,
  selected = false,
  onComplete,
  onSnooze,
  onEdit,
  onDelete,
  onPress,
}: {
  task: Task
  selected?: boolean
  onComplete: () => void
  onSnooze: () => void
  onEdit: () => void
  onDelete: () => void
  onPress?: () => void
}) {
  const ref = useRef<Swipeable>(null)
  const close = () => ref.current?.close()
  const [expanded, setExpanded] = useState(false)
  const hasSubtasks = task.subtasks.length > 0
  const subtasksDone = task.subtasks.filter((s) => s.done).length

  const setPinned = useSetPinned()
  const pinLabel = task.pinned ? 'Unpin' : 'Pin'
  const onTogglePin = () =>
    setPinned.mutate({ id: task.id, pinned: !task.pinned })

  const renderLeftActions = () => (
    <View
      style={{
        width: ACTION_W,
        backgroundColor: '#059669',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingRight: 24,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 22 }}>✓</Text>
    </View>
  )

  const renderRightActions = () => (
    <View
      style={{
        width: ACTION_W,
        backgroundColor: '#b45309',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingLeft: 24,
      }}
    >
      <Text style={{ color: '#fff', fontSize: 22 }}>◑</Text>
    </View>
  )

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
    if (onPress) {
      onPress()
      return
    }
    if (!hasSubtasks) return
    void Haptics.selectionAsync()
    setExpanded((x) => !x)
  }

  const onLongPress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', pinLabel, 'Edit', 'Snooze', 'Delete'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 4,
          title: task.title,
        },
        (i) => {
          if (i === 1) onTogglePin()
          else if (i === 2) onEdit()
          else if (i === 3) onSnooze()
          else if (i === 4) onDelete()
        },
      )
    } else {
      Alert.alert(task.title, undefined, [
        { text: pinLabel, onPress: onTogglePin },
        { text: 'Edit', onPress: onEdit },
        { text: 'Snooze', onPress: onSnooze },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
        { text: 'Cancel', style: 'cancel' },
      ])
    }
  }

  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    switch (event.nativeEvent.actionName) {
      case 'complete':
        onComplete()
        break
      case 'snooze':
        onSnooze()
        break
      case 'edit':
        onEdit()
        break
      case 'delete':
        onDelete()
        break
    }
  }

  const subtasksList =
    expanded && hasSubtasks ? (
      <View
        style={{
          paddingHorizontal: 20,
          paddingBottom: 12,
          gap: 6,
        }}
      >
        {task.subtasks.map((s, i) => {
          const isSnoozed = !!s.snooze && new Date(s.snooze) > new Date()
          return (
            <View
              key={i}
              accessible
              accessibilityLabel={`${s.title}, ${
                s.done ? 'completed' : isSnoozed ? 'snoozed' : 'not done'
              }`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
            >
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 7,
                  borderWidth: 1,
                  borderColor: s.done ? '#059669' : '#3f3f46',
                  backgroundColor: s.done ? '#059669' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {s.done && (
                  <Text style={{ color: '#fff', fontSize: 8 }}>✓</Text>
                )}
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: 'JetBrainsMono_400Regular',
                  fontSize: 12,
                  color: s.done
                    ? '#52525b'
                    : isSnoozed
                      ? '#71717a'
                      : '#d4d4d8',
                  textDecorationLine: s.done ? 'line-through' : 'none',
                }}
              >
                {s.title}
              </Text>
              {isSnoozed && (
                <Text style={{ fontSize: 10, color: '#52525b' }}>snoozed</Text>
              )}
            </View>
          )
        })}
      </View>
    ) : null

  return (
    <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
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
        childrenContainerStyle={{ borderRadius: 16, overflow: 'hidden' }}
      >
        <View
          style={{
            borderRadius: 16,
            backgroundColor: selected
              ? '#fafafa'
              : 'rgba(24,24,27,0.6)',
            borderWidth: 1,
            borderColor: selected ? '#f4f4f5' : '#27272a',
            overflow: 'hidden',
          }}
        >
          <TaskRow
            task={task}
            selected={selected}
            onPress={onTap}
            onLongPress={onLongPress}
            accessibilityHint={
              !onPress && hasSubtasks
                ? 'Double tap to expand subtasks'
                : undefined
            }
            accessibilityActions={[
              { name: 'complete', label: 'Complete' },
              { name: 'snooze', label: 'Snooze' },
              { name: 'edit', label: 'Edit' },
              { name: 'delete', label: 'Delete' },
            ]}
            onAccessibilityAction={onAccessibilityAction}
            containerStyle={{
              backgroundColor: 'transparent',
              borderWidth: 0,
              borderRadius: 0,
            }}
            trailing={
              hasSubtasks ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: 'JetBrainsMono_400Regular',
                      fontSize: 11,
                      color: selected ? '#52525b' : '#71717a',
                    }}
                  >
                    {subtasksDone}/{task.subtasks.length}
                  </Text>
                  <Text
                    style={{
                      fontSize: 9,
                      color: selected ? '#52525b' : '#71717a',
                    }}
                  >
                    {expanded ? '▾' : '▸'}
                  </Text>
                </View>
              ) : null
            }
          />
          {subtasksList}
        </View>
      </Swipeable>
    </View>
  )
}

export const SwipeableTaskRow = memo(SwipeableTaskRowBase)
