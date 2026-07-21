import { useRef, useState, type ReactNode } from 'react'
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewProps,
} from 'react-native'

import { formatDueLabel, formatRepeat } from '@dtn/shared/format'
import { newSafeDate } from '@dtn/shared/helpers'
import { minutesToHours } from '@dtn/shared/time'
import { type Task } from '@dtn/shared/types'

import { PulseDot } from './PulseDot'

const ACCENT = '#34d399'
const OVERDUE = '#fb7185'

// Mirrors the web TaskRow: a bordered rectangle with the task on one line and
// its actions on the next — the layout web uses below its `md` breakpoint,
// which is every phone.

export type RowMenuItem = {
  label: string
  onPress: () => void
  danger?: boolean
  disabled?: boolean
}

export function RowAction({
  label,
  icon,
  onPress,
  disabled,
}: {
  // The label survives as the accessibility name when an icon renders.
  label: string
  icon?: ReactNode
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        paddingHorizontal: icon ? 13 : 16,
        paddingVertical: 9,
        minHeight: 38,
        borderRadius: 999,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
        borderColor: '#27272a',
        backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : 'transparent',
      })}
    >
      {icon ?? (
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 13,
            color: '#a1a1aa',
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  )
}

// The row's overflow menu (⋯). Web renders an absolutely-positioned dropdown;
// we anchor a transparent modal under the button so it reads the same.
export function RowMenu({ items }: { items: Array<RowMenuItem> }) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState({ top: 0, right: 0 })
  const btnRef = useRef<View>(null)

  const show = () => {
    btnRef.current?.measureInWindow((x, y, w, h) => {
      setAnchor({
        top: y + h + 4,
        right: Math.max(8, Dimensions.get('window').width - (x + w)),
      })
      setOpen(true)
    })
  }

  return (
    <>
      <Pressable
        ref={btnRef}
        onPress={show}
        accessibilityRole="button"
        accessibilityLabel="More actions"
        style={({ pressed }) => ({
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: open ? '#52525b' : '#27272a',
          backgroundColor: pressed ? 'rgba(255,255,255,0.06)' : 'transparent',
        })}
      >
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 13,
            color: '#a1a1aa',
          }}
        >
          ⋯
        </Text>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setOpen(false)}
        />
        <View
          style={{
            position: 'absolute',
            top: anchor.top,
            right: anchor.right,
            minWidth: 150,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: '#27272a',
            backgroundColor: '#09090b',
            paddingVertical: 4,
            overflow: 'hidden',
          }}
        >
          {items.map((item) => (
            <Pressable
              key={item.label}
              disabled={item.disabled}
              onPress={() => {
                setOpen(false)
                item.onPress()
              }}
              accessibilityRole="menuitem"
              accessibilityState={{ disabled: !!item.disabled }}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 10,
                opacity: item.disabled ? 0.4 : 1,
                backgroundColor: pressed ? '#18181b' : 'transparent',
              })}
            >
              <Text
                style={{
                  fontFamily: 'JetBrainsMono_400Regular',
                  fontSize: 13,
                  color: item.danger ? OVERDUE : '#d4d4d8',
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  )
}

export function TaskRow({
  task,
  rank,
  centerActions = false,
  selected = false,
  actions,
  onPress,
  containerStyle,
}: {
  task: Task
  rank?: number
  // Home's top-three (phones are all small screens): centered action pills.
  centerActions?: boolean
  selected?: boolean
  actions?: ReactNode
  onPress?: () => void
  containerStyle?: ViewProps['style']
}) {
  const subtaskCount = task.subtasks?.length ?? 0
  const doneCount = task.subtasks?.filter((s) => s.done).length ?? 0
  const dueLabel = formatDueLabel(task.due, task.dueTime)
  const repeatLabel = formatRepeat(
    task.repeat,
    task.repeatInterval,
    task.repeatUnit,
    task.repeatWeekdays,
  )
  const isOverdue = (() => {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return newSafeDate(task.due).getTime() < today.getTime()
    } catch {
      return false
    }
  })()

  const a11yLabel = [
    task.title,
    isOverdue ? 'overdue' : null,
    dueLabel,
    task.timeFrame ? minutesToHours(task.timeFrame) : null,
    repeatLabel ? `repeats ${repeatLabel}` : null,
    subtaskCount > 0
      ? `${doneCount} of ${subtaskCount} ${subtaskCount === 1 ? 'subtask' : 'subtasks'} done`
      : null,
    task.strictDeadline ? 'strict deadline' : null,
    task.timerStartedAt ? 'timer running' : null,
    task.tags.length ? `tags ${task.tags.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(', ')

  const Body = onPress ? Pressable : View

  return (
    <View
      style={[
        {
          borderRadius: 16,
          borderWidth: 1,
          borderColor: selected ? '#a1a1aa' : '#27272a',
          backgroundColor: 'rgba(24,24,27,0.6)',
        },
        containerStyle,
      ]}
    >
      <Body
        onPress={onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? a11yLabel : undefined}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: actions ? 8 : 12,
        }}
      >
        {rank != null && (
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 15,
              color: '#52525b',
              width: 14,
              textAlign: 'center',
            }}
          >
            {rank}
          </Text>
        )}
        <View>
          <Text
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ fontSize: 24, lineHeight: 28 }}
          >
            {task.emoji}
          </Text>
          {task.timerStartedAt && (
            <View style={{ position: 'absolute', top: -2, right: -4 }}>
              <PulseDot color={ACCENT} size={8} glow />
            </View>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 18,
              lineHeight: 22,
              color: '#f4f4f5',
            }}
          >
            {task.title}
          </Text>
          <View
            style={{
              marginTop: 4,
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {dueLabel ? (
              <Meta color={isOverdue ? OVERDUE : undefined}>{dueLabel}</Meta>
            ) : null}
            {task.timeFrame ? (
              <Meta>{minutesToHours(task.timeFrame)}</Meta>
            ) : null}
            {repeatLabel ? <Meta>↻ {repeatLabel}</Meta> : null}
            {subtaskCount > 0 ? (
              <Meta>
                ☐ {doneCount}/{subtaskCount}
              </Meta>
            ) : null}
            {task.tags.map((t) => (
              <Meta key={t}>#{t}</Meta>
            ))}
          </View>
        </View>
      </Body>

      {actions ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: centerActions ? 'center' : 'flex-start',
            gap: 8,
            paddingHorizontal: 16,
            paddingBottom: 12,
          }}
        >
          {actions}
        </View>
      ) : null}
    </View>
  )
}

function Meta({
  children,
  color = '#71717a',
}: {
  children: ReactNode
  color?: string
}) {
  return (
    <Text
      style={{
        fontFamily: 'JetBrainsMono_400Regular',
        fontSize: 13,
        marginRight: 16,
        color,
      }}
    >
      {children}
    </Text>
  )
}
