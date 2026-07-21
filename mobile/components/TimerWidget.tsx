import { useTaskTimer } from '@dtn/shared/queries'
import {
  currentTimerSeconds,
  formatTimerSeconds,
  timerAtPlan,
  timerRunaway,
} from '@dtn/shared/timer-utils'
import { type Task } from '@dtn/shared/types'
import * as Haptics from 'expo-haptics'
import { useEffect, useRef, useState } from 'react'
import { Alert, Animated, Easing, Pressable, Text, View } from 'react-native'

import { PauseIcon, PlayIcon, SlidersIcon } from './icons'
import { PulseDot } from './PulseDot'
import { TimerAdjustModal } from './TimerAdjustModal'

const ACCENT = '#34d399'
const STREAK = '#f59e0b'

// Focus Pulse: one haptic + scale beat on the rising edge of "elapsed
// reached the planned time". Never on mount, never twice for a task.
function usePlanPulse(taskId: string, atPlan: boolean): Animated.Value {
  const prev = useRef<boolean | null>(null)
  const lastTask = useRef(taskId)
  const scale = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (lastTask.current !== taskId) {
      lastTask.current = taskId
      prev.current = null
    }
    const rising = prev.current === false && atPlan
    prev.current = atPlan
    if (!rising) return
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.12,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 640,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start()
  }, [taskId, atPlan, scale])
  return scale
}

function GuardButton({
  label,
  dim,
  onPress,
}: {
  label: string
  dim?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: dim ? '#3f3f46' : 'rgba(245,158,11,0.4)',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 12,
          color: dim ? '#a1a1aa' : STREAK,
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

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
  const pulseScale = usePlanPulse(
    task.id,
    timerAtPlan(task, plannedMinutes ?? task.timeFrame, now),
  )

  const dispatch = (kind: 'start' | 'pause' | 'reset') =>
    timer.mutate({ id, action: { kind } })
  const add = (sec: number) =>
    timer.mutate({ id, action: { kind: 'add', seconds: sec } })

  // Runaway-timer Guard: flag (never auto-pause) once elapsed passes ~3× the
  // plan or the timer crossed midnight; reconcile keep / trim / custom before
  // the overrun poisons credit and fluid estimates.
  const [runawayKept, setRunawayKept] = useState(false)
  const isRunaway = timerRunaway(task, plannedMinutes ?? task.timeFrame, now)
  useEffect(() => {
    if (!isRunaway) setRunawayKept(false)
  }, [isRunaway])
  const runaway = isRunaway && !runawayKept
  const runawayBanner = runaway ? (
    <View
      style={{
        marginTop: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(245,158,11,0.4)',
        backgroundColor: 'rgba(245,158,11,0.08)',
        gap: 8,
      }}
    >
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          color: STREAK,
          fontSize: 12,
        }}
      >
        Runaway timer — {formatTimerSeconds(seconds)}
        {plannedSec > 0 ? ` on a ${Math.ceil(plannedSec / 60)} min plan` : ''}.
        Still working?
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {plannedSec > 0 && (
          <GuardButton label="Trim to plan" onPress={() => add(plannedSec - seconds)} />
        )}
        <GuardButton label="Custom…" onPress={() => setAdjustOpen(true)} />
        <GuardButton label="Keep it" dim onPress={() => setRunawayKept(true)} />
      </View>
    </View>
  ) : null

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
            borderColor: running ? ACCENT : '#3f3f46',
            backgroundColor: 'rgba(24,24,27,0.75)',
            paddingHorizontal: 20,
            paddingVertical: 12,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {running && <PulseDot color={ACCENT} />}
            <Animated.Text
              style={{
                fontFamily: 'JetBrainsMono_700Bold',
                color: running ? ACCENT : '#fafafa',
                fontSize: 30,
                lineHeight: 34,
                includeFontPadding: false,
                textAlignVertical: 'center',
                marginTop: 2,
                transform: [{ scale: pulseScale }],
              }}
            >
              {formatTimerSeconds(seconds)}
            </Animated.Text>
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
              <SlidersIcon />
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
                    : 'rgba(251,191,36,0.9)'
                  : pressed
                    ? '#e4e4e7'
                    : '#fafafa',
                opacity: timer.isPending ? 0.6 : 1,
              })}
            >
              {running ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
            </Pressable>
          </View>
        </View>
        {runawayBanner}
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
        borderColor: running ? ACCENT : '#3f3f46',
        backgroundColor: 'rgba(24,24,27,0.75)',
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
            fontSize: 11,
            letterSpacing: 3,
            textTransform: 'uppercase',
          }}
        >
          Timer
        </Text>
        {running && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
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
                fontSize: 11,
                letterSpacing: 3,
                textTransform: 'uppercase',
              }}
            >
              Running
            </Text>
          </View>
        )}
      </View>

      <Animated.Text
        style={{
          fontFamily: 'JetBrainsMono_700Bold',
          color: running ? ACCENT : '#fafafa',
          fontSize: 44,
          marginTop: 8,
          lineHeight: 48,
          alignSelf: 'flex-start',
          transform: [{ scale: pulseScale }],
        }}
      >
        {formatTimerSeconds(seconds)}
      </Animated.Text>

      {runawayBanner}

      <View style={{ marginTop: 16, flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={() => dispatch(running ? 'pause' : 'start')}
          disabled={timer.isPending}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: running
              ? pressed
                ? '#d97706'
                : 'rgba(251,191,36,0.9)'
              : pressed
                ? '#e4e4e7'
                : '#fafafa',
            opacity: timer.isPending ? 0.6 : 1,
          })}
        >
          {running ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
          <Text
            style={{
              fontFamily: 'JetBrainsMono_700Bold',
              color: '#0a0a0a',
              fontSize: 15,
            }}
          >
            {running ? 'Pause' : 'Start'}
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
              fontSize: 13,
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
                fontSize: 13,
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
