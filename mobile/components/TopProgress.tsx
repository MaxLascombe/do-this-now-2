import { formatScheduleStatus } from '@dtn/shared/format'
import { useProgressToday } from '@dtn/shared/queries'
import {
  MINUTES_IN_DAY,
  START_OF_DAY_MINUTES,
  minutesToHours,
} from '@dtn/shared/time'
import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useDate } from '../hooks/useDate'
import { RunningTimerChip } from './RunningTimerChip'

const ACCENT = '#34d399'
const STREAK = '#f59e0b'
const MINI_CELLS = 14

export function TopProgress() {
  const [open, setOpen] = useState(false)
  const now = useDate()
  const { data } = useProgressToday()

  if (!data) {
    return <View style={{ height: 2, backgroundColor: '#18181b' }} />
  }

  const {
    done,
    todo,
    lives,
    streak,
    minutesToReduceTomorrowDays,
  } = data
  const maxTodo = Math.max(todo, minutesToReduceTomorrowDays)
  const tod = now.getHours() * 60 + now.getMinutes()
  const pctOfDay = Math.max(
    0,
    Math.min(
      1,
      (tod - START_OF_DAY_MINUTES) /
        (MINUTES_IN_DAY - START_OF_DAY_MINUTES),
    ),
  )
  const shouldBeDone = maxTodo * pctOfDay
  const isBeforeWorkday = tod < START_OF_DAY_MINUTES
  const scheduleShort = formatScheduleStatus({
    done,
    shouldBeDone,
    isBeforeWorkday,
    short: true,
  })

  const doneUsingAllLives = Math.min(done, todo - lives)
  const doneUsingLives = Math.min(done, todo)
  const points =
    doneUsingAllLives +
    (doneUsingLives - doneUsingAllLives) * 2 +
    (done - doneUsingLives) * 3

  const pct = Math.min(100, Math.round((done / todo) * 100))
  const filledCount = Math.round((done / todo) * MINI_CELLS)
  const tickAt = Math.round((shouldBeDone / todo) * MINI_CELLS)

  return (
    <View>
      <View style={{ height: 2, backgroundColor: '#18181b' }}>
        <View
          style={{
            height: '100%',
            width: `${pct}%`,
            backgroundColor: ACCENT,
          }}
        />
      </View>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Show today's progress detail"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 12,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: '#fafafa', fontSize: 13 }}>★</Text>
            <Text
              style={{
                color: '#a1a1aa',
                fontSize: 13,
                fontFamily: 'JetBrainsMono_400Regular',
              }}
            >
              {points}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: STREAK, fontSize: 13 }}>▲</Text>
            <Text
              style={{
                color: STREAK,
                fontSize: 13,
                fontFamily: 'JetBrainsMono_400Regular',
              }}
            >
              {streak}
            </Text>
          </View>
          <Text
            style={{
              color: ACCENT,
              fontSize: 13,
              fontFamily: 'JetBrainsMono_400Regular',
            }}
          >
            {scheduleShort}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          {Array.from({ length: MINI_CELLS }).map((_, i) => {
            const filled = i < filledCount
            const isTick = i === tickAt - 1 && !filled
            return (
              <View
                key={i}
                style={{
                  width: 5,
                  height: 12,
                  backgroundColor: filled
                    ? ACCENT
                    : 'rgba(255,255,255,0.12)',
                  borderWidth: isTick ? 1 : 0,
                  borderColor: isTick
                    ? 'rgba(255,255,255,0.9)'
                    : 'transparent',
                }}
              />
            )
          })}
        </View>
      </Pressable>
      <View
        style={{
          alignItems: 'flex-end',
          paddingHorizontal: 20,
          paddingBottom: 6,
        }}
      >
        <RunningTimerChip />
      </View>
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <ProgressSheet onClose={() => setOpen(false)} />
      </Modal>
    </View>
  )
}

function ProgressSheet({ onClose }: { onClose: () => void }) {
  const now = useDate()
  const { data } = useProgressToday()
  if (!data) return null

  const {
    done,
    todo,
    lives,
    streak,
    streakIsActive,
    daysUntilAllDone,
    minutesToReduceTomorrowDays,
  } = data
  const maxTodo = Math.max(todo, minutesToReduceTomorrowDays)
  const tod = now.getHours() * 60 + now.getMinutes()
  const pctOfDay = Math.max(
    0,
    Math.min(
      1,
      (tod - START_OF_DAY_MINUTES) /
        (MINUTES_IN_DAY - START_OF_DAY_MINUTES),
    ),
  )
  const shouldBeDone = maxTodo * pctOfDay
  const isBeforeWorkday = tod < START_OF_DAY_MINUTES
  const scheduleShort = formatScheduleStatus({
    done,
    shouldBeDone,
    isBeforeWorkday,
    short: true,
  })
  const livesUsed = Math.min(lives, Math.max(0, todo - done))
  const livesLeft = lives - livesUsed
  const doneUsingAllLives = Math.min(done, todo - lives)
  const doneUsingLives = Math.min(done, todo)
  const points =
    doneUsingAllLives +
    (doneUsingLives - doneUsingAllLives) * 2 +
    (done - doneUsingLives) * 3
  const clearByDate = new Date(
    new Date().setDate(now.getDate() + daysUntilAllDone),
  )
  const clearByLabel = clearByDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  const cells = 28
  const filled = Math.round((done / todo) * cells)
  const tick = Math.round((shouldBeDone / todo) * cells)

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#0e0e10' }}
      edges={['bottom']}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          padding: 20,
          paddingTop: 12,
        }}
      >
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            color: '#71717a',
            fontSize: 11,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          Today · progress
        </Text>
        <Pressable
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={{ color: '#a1a1aa', fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', gap: 2 }}>
          {Array.from({ length: cells }).map((_, i) => {
            const f = i < filled
            const isTick = i === tick - 1 && !f
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 18,
                  backgroundColor: f ? ACCENT : 'rgba(255,255,255,0.1)',
                  borderWidth: isTick ? 1 : 0,
                  borderColor: isTick
                    ? 'rgba(255,255,255,0.9)'
                    : 'transparent',
                }}
              />
            )
          })}
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginTop: 10,
          }}
        >
          <Text
            style={{
              fontFamily: 'JetBrainsMono_700Bold',
              fontSize: 24,
              color: '#fafafa',
            }}
          >
            {minutesToHours(done)}
            <Text style={{ color: '#52525b' }}>{' / '}</Text>
            <Text style={{ color: '#a1a1aa' }}>{minutesToHours(todo)}</Text>
          </Text>
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              color: ACCENT,
              fontSize: 13,
            }}
          >
            {scheduleShort}
          </Text>
        </View>
        <View
          style={{
            marginTop: 24,
            flexDirection: 'row',
            flexWrap: 'wrap',
          }}
        >
          <SheetStat icon="★" label="Points" value={points} unit="today" />
          <SheetStat
            icon="▲"
            iconColor={STREAK}
            label="Streak"
            value={streak}
            unit={streakIsActive ? 'days · live' : 'days'}
          />
          <SheetStat
            icon="♥"
            label="Lives"
            value={minutesToHours(livesLeft)}
            unit="left"
          />
          <SheetStat
            icon="⏳"
            label="Remaining"
            value={minutesToHours(Math.max(0, todo - done))}
            unit="to target"
          />
          <SheetStat
            icon="∞"
            label="Clear all"
            value={`~${daysUntilAllDone}d`}
            unit={clearByLabel}
          />
          <SheetStat
            icon="◷"
            label="Workday"
            value="08:30"
            unit="– 24:00"
          />
        </View>
      </View>
    </SafeAreaView>
  )
}

function SheetStat({
  icon,
  iconColor,
  label,
  value,
  unit,
}: {
  icon: string
  iconColor?: string
  label: string
  value: string | number
  unit: string
}) {
  return (
    <View style={{ width: '50%', paddingVertical: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ color: iconColor ?? '#fafafa', fontSize: 13 }}>
          {icon}
        </Text>
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            color: '#71717a',
            fontSize: 10,
            letterSpacing: 2.5,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
      </View>
      <View
        style={{
          marginTop: 4,
          flexDirection: 'row',
          alignItems: 'baseline',
          gap: 6,
        }}
      >
        <Text
          style={{
            fontFamily: 'JetBrainsMono_700Bold',
            color: '#fafafa',
            fontSize: 20,
          }}
        >
          {value}
        </Text>
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            color: '#71717a',
            fontSize: 11,
          }}
        >
          {unit}
        </Text>
      </View>
    </View>
  )
}
