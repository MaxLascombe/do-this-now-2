import { formatScheduleStatus } from '@dtn/shared/format'
import { computeSchedule } from '@dtn/shared/pacing'
import {
  computeWinEta,
  formatWinEta,
  progressCells,
  splitBarUnits,
  type ProgressCellFill,
} from '@dtn/shared/progress-display'
import { useProgressToday } from '@dtn/shared/queries'
import { minutesOfDayToHHMM } from '@dtn/shared/settings'
import { minutesToHours } from '@dtn/shared/time'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useDate } from '../hooks/useDate'
import { FocusReturnBar } from './FocusReturnBar'
import { ProfileIcon } from './icons'

const ACCENT = '#34d399'
const STREAK = '#f59e0b'
const LIVES = '#38bdf8'
const MINI_CELLS = 14

const cellColor = (fill: ProgressCellFill): string =>
  fill === 'done' ? ACCENT : fill === 'lives' ? LIVES : 'rgba(255,255,255,0.12)'

export function TopProgress() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const now = useDate()
  const { data } = useProgressToday()

  if (!data) {
    return <View style={{ height: 2, backgroundColor: '#18181b' }} />
  }

  const { done, todo, lives, streak, workdayStartMin, workdayEndMin } = data
  const { shouldBeDone, isBeforeWorkday } = computeSchedule(
    now,
    todo,
    workdayStartMin,
    workdayEndMin,
  )
  const scheduleShort = formatScheduleStatus({
    done,
    shouldBeDone,
    isBeforeWorkday,
    short: true,
  })

  const { doneUnits: donePct, livesUnits: livesPct } = splitBarUnits({
    done,
    lives,
    todo,
    count: 100,
  })

  return (
    <View>
      <View
        style={{
          height: 2,
          backgroundColor: '#18181b',
          flexDirection: 'row',
        }}
      >
        <View
          style={{ height: '100%', width: `${donePct}%`, backgroundColor: ACCENT }}
        />
        <View
          style={{ height: '100%', width: `${livesPct}%`, backgroundColor: LIVES }}
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
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={{ color: STREAK, fontSize: 14 }}>▲</Text>
              <Text
                style={{
                  color: STREAK,
                  fontSize: 14,
                  fontFamily: 'JetBrainsMono_400Regular',
                }}
              >
                {streak}
              </Text>
            </View>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Text style={{ color: LIVES, fontSize: 14 }}>♥</Text>
              <Text
                style={{
                  color: LIVES,
                  fontSize: 14,
                  fontFamily: 'JetBrainsMono_400Regular',
                }}
              >
                {minutesToHours(lives)}
              </Text>
            </View>
            <Text
              style={{
                color: ACCENT,
                fontSize: 14,
                fontFamily: 'JetBrainsMono_400Regular',
              }}
            >
              {scheduleShort}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            {progressCells({
              count: MINI_CELLS,
              done,
              lives,
              todo,
              shouldBeDone,
            }).map(({ key, fill, isTick }) => (
              <View
                key={key}
                style={{
                  width: 5,
                  height: 12,
                  backgroundColor: cellColor(fill),
                  borderWidth: isTick ? 1 : 0,
                  borderColor: isTick
                    ? 'rgba(255,255,255,0.9)'
                    : 'transparent',
                }}
              />
            ))}
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push('/settings')}
          accessibilityRole="button"
          accessibilityLabel="Profile & settings"
          hitSlop={10}
          style={({ pressed }) => ({
            paddingRight: 20,
            paddingLeft: 4,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <ProfileIcon size={20} />
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
    bestStreak,
    theoreticalMinimum,
    daysUntilAllDone,
    workdayStartMin,
    workdayEndMin,
  } = data
  const { shouldBeDone, isBeforeWorkday } = computeSchedule(
    now,
    todo,
    workdayStartMin,
    workdayEndMin,
  )
  const scheduleShort = formatScheduleStatus({
    done,
    shouldBeDone,
    isBeforeWorkday,
    short: true,
  })
  const remainingToWin = Math.max(0, todo - done - lives)
  const banking = Math.max(0, done + lives - todo)
  const won = remainingToWin === 0 && todo > 0
  const winEtaLabel = formatWinEta(
    computeWinEta({ now, done, lives, todo, workdayStartMin, workdayEndMin }),
  )
  const clearByDate = new Date(
    new Date().setDate(now.getDate() + daysUntilAllDone),
  )
  const clearByLabel = clearByDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })

  const cells = 28

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
            fontSize: 11,
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
              fontSize: 13,
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
          {progressCells({ count: cells, done, lives, todo, shouldBeDone }).map(
            ({ key, fill, isTick }) => (
              <View
                key={key}
                style={{
                  flex: 1,
                  height: 18,
                  backgroundColor: cellColor(fill),
                  borderWidth: isTick ? 1 : 0,
                  borderColor: isTick ? 'rgba(255,255,255,0.9)' : 'transparent',
                }}
              />
            ),
          )}
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
              fontSize: 14,
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
          <SheetStat
            icon="▲"
            iconColor={STREAK}
            label="Streak"
            value={streak}
            unit={`${streak === 1 ? 'day' : 'days'} · best ${bestStreak}`}
            active={streakIsActive}
          />
          <SheetStat
            icon="♥"
            iconColor={LIVES}
            label="Lives"
            value={minutesToHours(lives)}
            unit="banked"
          />
          <SheetStat
            icon="⏳"
            label="Remaining"
            value={minutesToHours(remainingToWin)}
            unit="to win"
            dim={won}
          />
          <SheetStat
            icon="◔"
            label="Win ETA"
            value={winEtaLabel}
            unit={won ? 'day won' : 'projected'}
          />
          <SheetStat
            icon="↥"
            iconColor={LIVES}
            label="Banking"
            value={`+${minutesToHours(banking)}`}
            unit="tomorrow's lives"
            dim={banking === 0}
          />
          <SheetStat
            icon="∞"
            label="Clear all"
            value={`~${daysUntilAllDone}d`}
            unit={clearByLabel}
          />
          <SheetStat
            icon="↻"
            label="Baseline"
            value={minutesToHours(theoreticalMinimum)}
            unit="recurring / day"
          />
          <SheetStat
            icon="◷"
            label="Workday"
            value={minutesOfDayToHHMM(workdayStartMin)}
            unit={`– ${minutesOfDayToHHMM(workdayEndMin)}`}
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
  dim,
  active,
}: {
  icon: string
  iconColor?: string
  label: string
  value: string | number
  unit: string
  dim?: boolean
  active?: boolean
}) {
  return (
    <View style={{ width: '50%', paddingVertical: 10, opacity: dim ? 0.6 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text style={{ color: iconColor ?? '#fafafa', fontSize: 14 }}>
          {icon}
        </Text>
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            color: '#71717a',
            fontSize: 11,
            letterSpacing: 2.5,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </Text>
        {active && (
          <View
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: STREAK,
            }}
          />
        )}
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
            fontSize: 12,
          }}
        >
          {unit}
        </Text>
      </View>
    </View>
  )
}
