import { formatScheduleStatus } from '@dtn/shared/format'
import { computeSchedule } from '@dtn/shared/pacing'
import { useProgressToday } from '@dtn/shared/queries'
import { computePoints } from '@dtn/shared/scoring'
import { minutesToHours } from '@dtn/shared/time'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useDate } from '../hooks/useDate'
import { FocusReturnBar } from './FocusReturnBar'

const ACCENT = '#34d399'
const STREAK = '#f59e0b'
const MINI_CELLS = 14

export function TopProgress() {
  const router = useRouter()
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
  const { shouldBeDone, isBeforeWorkday } = computeSchedule(
    now,
    todo,
    minutesToReduceTomorrowDays,
  )
  const scheduleShort = formatScheduleStatus({
    done,
    shouldBeDone,
    isBeforeWorkday,
    short: true,
  })

  const points = computePoints(done, todo, lives)

  // todo is 0 on a no-tasks day; guard the divisions so the bar reads empty
  // instead of rendering a NaN width. Only read fully complete once the
  // target is actually met — rounding would fill the bar a hair early.
  const hitTodo = todo > 0 && done >= todo
  const pct =
    todo > 0 ? (hitTodo ? 100 : Math.min(99, Math.round((done / todo) * 100))) : 0
  const filledCount =
    todo > 0
      ? hitTodo
        ? MINI_CELLS
        : Math.min(MINI_CELLS - 1, Math.round((done / todo) * MINI_CELLS))
      : 0
  const tickAt = todo > 0 ? Math.round((shouldBeDone / todo) * MINI_CELLS) : 0

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
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Show today's progress detail"
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 20,
          paddingRight: 12,
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
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          hitSlop={10}
          style={({ pressed }) => ({
            paddingRight: 20,
            paddingLeft: 4,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text style={{ color: '#71717a', fontSize: 16 }}>⚙</Text>
        </Pressable>
      </View>
      <FocusReturnBar />
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
  const { shouldBeDone, isBeforeWorkday } = computeSchedule(
    now,
    todo,
    minutesToReduceTomorrowDays,
  )
  const scheduleShort = formatScheduleStatus({
    done,
    shouldBeDone,
    isBeforeWorkday,
    short: true,
  })
  const livesUsed = Math.min(lives, Math.max(0, todo - done))
  const livesLeft = lives - livesUsed
  const points = computePoints(done, todo, lives)
  const clearByDate = new Date(
    new Date().setDate(now.getDate() + daysUntilAllDone),
  )
  const clearByLabel = clearByDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  const cells = 28
  // todo is 0 on a no-tasks day — guard like the mini-bar does, or these
  // widths come out NaN.
  const filled = todo > 0 ? Math.round((done / todo) * cells) : 0
  const tick = todo > 0 ? Math.round((shouldBeDone / todo) * cells) : 0

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#0e0e10' }}
      edges={['bottom']}
    >
      <View
        style={{
          alignSelf: 'center',
          marginTop: 12,
          height: 4,
          width: 40,
          borderRadius: 999,
          backgroundColor: '#3f3f46',
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 20,
          paddingTop: 12,
        }}
      >
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            color: '#71717a',
            fontSize: 10,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          Today · progress
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              color: '#71717a',
              fontSize: 12,
              fontVariant: ['tabular-nums'],
            }}
          >
            {now.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}
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
            unit={streak === 1 ? 'day' : 'days'}
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
