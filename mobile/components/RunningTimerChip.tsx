import { useAllTasks, useTaskTimer } from '@dtn/shared/queries'
import { currentTimerSeconds } from '@dtn/shared/timer-utils'
import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

const ACCENT = '#34d399'

function formatTimerSeconds(s: number): string {
  const total = Math.max(0, Math.floor(s))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`
  return `${pad(m)}:${pad(sec)}`
}

export function RunningTimerChip() {
  const tasks = useAllTasks()
  const timer = useTaskTimer()
  const router = useRouter()
  const [now, setNow] = useState(() => new Date())
  const running = (tasks.data ?? []).find((t) => t.timerStartedAt !== null)
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [running])
  if (!running) return null
  const elapsed = currentTimerSeconds(running, now)

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(52,211,153,0.35)',
        backgroundColor: 'rgba(52,211,153,0.08)',
      }}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: ACCENT,
        }}
      />
      <Pressable
        onPress={() => router.push(`/tasks/${running.id}/edit`)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}
      >
        <Text style={{ fontSize: 14, lineHeight: 16 }}>{running.emoji}</Text>
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            color: ACCENT,
            fontSize: 12,
          }}
        >
          {formatTimerSeconds(elapsed)}
        </Text>
      </Pressable>
      <Pressable
        onPress={() =>
          timer.mutate({ id: running.id, action: { kind: 'pause' } })
        }
        disabled={timer.isPending}
        hitSlop={4}
        style={{
          paddingHorizontal: 4,
          opacity: timer.isPending ? 0.4 : 1,
        }}
      >
        <Text style={{ color: ACCENT, fontSize: 12 }}>⏸</Text>
      </Pressable>
    </View>
  )
}
