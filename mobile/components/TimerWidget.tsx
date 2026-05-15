import { useTaskTimer } from '@dtn/shared/queries'
import {
  currentTimerSeconds,
  formatTimerSeconds,
} from '@dtn/shared/timer-utils'
import { type Task } from '@dtn/shared/types'
import { useEffect, useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'

import { PulseDot } from './PulseDot'
import { TimerAdjustModal } from './TimerAdjustModal'

const ACCENT = '#34d399'
const STREAK = '#f59e0b'

export function TimerWidget({
  task,
  actionId,
  plannedMinutes,
  compact = false,
}: {
  task: Task
  actionId?: string
  plannedMinutes?: number
  compact?: boolean
}) {
  const id = actionId ?? task.id
  const timer = useTaskTimer()
  const running = !!task.timerStartedAt

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [running])
  const seconds = currentTimerSeconds(task, now)

  const plannedSec = (plannedMinutes ?? task.timeFrame) * 60
  const overrun = plannedSec > 0 && seconds > plannedSec * 1.5

  const dispatch = (kind: 'start' | 'pause' | 'reset') =>
    timer.mutate({ id, action: { kind } })
  const add = (sec: number) =>
    timer.mutate({ id, action: { kind: 'add', seconds: sec } })

  const confirmReset = () => {
    if (seconds === 0) return
    Alert.alert('Reset timer?', 'This sets the timer back to 0.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => dispatch('reset'),
      },
    ])
  }

  const [adjustOpen, setAdjustOpen] = useState(false)

  if (compact) {
    return (
      <>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: running ? ACCENT : '#27272a',
            backgroundColor: 'rgba(24,24,27,0.4)',
            paddingHorizontal: 18,
            paddingVertical: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {running && <PulseDot color={ACCENT} />}
            <Text
              style={{
                fontFamily: 'JetBrainsMono_700Bold',
                color: running ? ACCENT : '#fafafa',
                fontSize: 30,
                lineHeight: 32,
              }}
            >
              {formatTimerSeconds(seconds)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => setAdjustOpen(true)}
              disabled={timer.isPending}
              accessibilityLabel="Adjust timer"
              style={({ pressed }) => ({
                width: 36,
                height: 36,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: '#27272a',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: timer.isPending ? 0.3 : pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: 'JetBrainsMono_400Regular',
                  color: '#d4d4d8',
                  fontSize: 16,
                }}
              >
                ±
              </Text>
            </Pressable>
            <Pressable
              onPress={() => dispatch(running ? 'pause' : 'start')}
              disabled={timer.isPending}
              accessibilityLabel={running ? 'Pause timer' : 'Start timer'}
              style={({ pressed }) => ({
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: running
                  ? pressed
                    ? '#d97706'
                    : '#f59e0b'
                  : pressed
                    ? '#e4e4e7'
                    : '#fafafa',
                opacity: timer.isPending ? 0.6 : 1,
              })}
            >
              <Text style={{ color: '#0a0a0a', fontSize: 16 }}>
                {running ? '⏸' : '▶'}
              </Text>
            </Pressable>
          </View>
        </View>
        <TimerAdjustModal
          open={adjustOpen}
          seconds={seconds}
          disabled={timer.isPending}
          onAdd={(m) => add(m * 60)}
          onClear={() => {
            dispatch('reset')
            setAdjustOpen(false)
          }}
          onClose={() => setAdjustOpen(false)}
        />
      </>
    )
  }

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: running ? ACCENT : '#27272a',
        backgroundColor: 'rgba(24,24,27,0.4)',
        padding: 16,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
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
          Timer
        </Text>
        {running && (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: ACCENT,
              }}
            />
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                color: ACCENT,
                fontSize: 10,
                letterSpacing: 3,
                textTransform: 'uppercase',
              }}
            >
              Running
            </Text>
          </View>
        )}
      </View>

      <Text
        style={{
          fontFamily: 'JetBrainsMono_700Bold',
          color: running ? ACCENT : '#fafafa',
          fontSize: 44,
          marginTop: 8,
          lineHeight: 48,
        }}
      >
        {formatTimerSeconds(seconds)}
      </Text>

      {overrun && (
        <View
          style={{
            marginTop: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: 'rgba(245,158,11,0.4)',
            backgroundColor: 'rgba(245,158,11,0.08)',
          }}
        >
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              color: STREAK,
              fontSize: 11,
            }}
          >
            Timer is &gt;1.5× the planned {Math.ceil(plannedSec / 60)} min —
            forgot to pause?
          </Text>
        </View>
      )}

      <View style={{ marginTop: 16, flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={() => dispatch(running ? 'pause' : 'start')}
          disabled={timer.isPending}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 18,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: running
              ? pressed
                ? '#d97706'
                : '#f59e0b'
              : pressed
                ? '#e4e4e7'
                : '#fafafa',
            opacity: timer.isPending ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: 'JetBrainsMono_700Bold',
              color: '#0a0a0a',
              fontSize: 14,
            }}
          >
            {running ? '⏸  Pause' : '▶  Start'}
          </Text>
        </Pressable>

        <Pressable
          onPress={confirmReset}
          disabled={timer.isPending || seconds === 0}
          style={({ pressed }) => ({
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: '#27272a',
            opacity: seconds === 0 || timer.isPending ? 0.3 : pressed ? 0.7 : 1,
          })}
        >
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              color: '#a1a1aa',
              fontSize: 12,
            }}
          >
            Reset
          </Text>
        </Pressable>
      </View>

      <View
        style={{
          marginTop: 12,
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        {[-15, -5, -1, 1, 5, 15].map((m) => (
          <Pressable
            key={m}
            onPress={() => add(m * 60)}
            disabled={timer.isPending}
            style={({ pressed }) => ({
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#27272a',
              opacity: timer.isPending ? 0.3 : pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                color: '#d4d4d8',
                fontSize: 12,
              }}
            >
              {m > 0 ? `+${m}m` : `${m}m`}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}
