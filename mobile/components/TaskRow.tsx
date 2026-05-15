import { type ReactNode } from 'react'
import { Pressable, Text, View, type ViewProps } from 'react-native'

import { formatDueLabel, formatRepeat } from '@dtn/shared/format'
import { minutesToHours } from '@dtn/shared/time'
import { type Task } from '@dtn/shared/types'

const ACCENT = '#34d399'
const OVERDUE = '#fb7185'

type Props = {
  task: Task
  selected?: boolean
  // Show a small completed-state ✓ instead of the chevron (used on /history).
  completed?: boolean
  // Strikethrough title (used for history rows).
  strikethrough?: boolean
  trailing?: ReactNode
  onPress?: () => void
  onLongPress?: () => void
  containerStyle?: ViewProps['style']
}

export function TaskRow({
  task,
  selected = false,
  completed = false,
  strikethrough = false,
  trailing,
  onPress,
  onLongPress,
  containerStyle,
}: Props) {
  const subtaskCount = task.subtasks?.length ?? 0
  const doneCount = task.subtasks?.filter((s) => s.done).length ?? 0
  const dueLabel = formatDueLabel(task.due, task.dueTime)
  const repeatLabel = formatRepeat(
    task.repeat,
    task.repeatInterval,
    task.repeatUnit,
    task.repeatWeekdays,
  )

  const titleFont = selected
    ? 'InstrumentSerif_400Regular_Italic'
    : 'JetBrainsMono_400Regular'
  const titleColor = selected ? '#0a0a0a' : '#fafafa'
  const metaColor = selected ? '#52525b' : '#71717a'

  const Wrapper = onPress || onLongPress ? Pressable : View
  const wrapperProps =
    onPress || onLongPress
      ? { onPress, onLongPress, delayLongPress: 350 }
      : {}

  return (
    <Wrapper
      {...wrapperProps}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: selected ? '#f4f4f5' : '#27272a',
          backgroundColor: selected ? '#fafafa' : 'rgba(24,24,27,0.6)',
        },
        containerStyle,
      ]}
    >
      {completed && (
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            borderWidth: 1,
            borderColor: ACCENT,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: ACCENT, fontSize: 14, lineHeight: 14 }}>✓</Text>
        </View>
      )}
      <View>
        <Text style={{ fontSize: 22, lineHeight: 24 }}>{task.emoji}</Text>
        {task.timerStartedAt && (
          <View
            style={{
              position: 'absolute',
              top: -2,
              right: -3,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: ACCENT,
            }}
          />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: titleFont,
            fontSize: selected ? 22 : 17,
            lineHeight: selected ? 24 : 21,
            color: titleColor,
            textDecorationLine: strikethrough ? 'line-through' : 'none',
            textDecorationColor: 'rgba(255,255,255,0.25)',
          }}
        >
          {task.title}
        </Text>
        <View
          style={{
            marginTop: 3,
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          {dueLabel && <Meta color={metaColor}>{dueLabel}</Meta>}
          {task.timeFrame ? (
            <Meta color={metaColor}>{minutesToHours(task.timeFrame)}</Meta>
          ) : null}
          {repeatLabel && <Meta color={metaColor}>↻ {repeatLabel}</Meta>}
          {subtaskCount > 0 && (
            <Meta color={metaColor}>
              ☐ {doneCount}/{subtaskCount}
            </Meta>
          )}
          {task.strictDeadline && (
            <Meta color={selected ? '#9f1239' : OVERDUE}>strict</Meta>
          )}
        </View>
      </View>
      {trailing}
    </Wrapper>
  )
}

function Meta({
  children,
  color,
}: {
  children: ReactNode
  color: string
}) {
  return (
    <Text
      style={{
        fontFamily: 'JetBrainsMono_400Regular',
        fontSize: 11,
        marginRight: 12,
        color,
      }}
    >
      {children}
    </Text>
  )
}
