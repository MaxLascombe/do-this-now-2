import { useSelection, useTask } from '@dtn/shared/queries'
import {
  currentTimerSeconds,
  formatTimerSeconds,
} from '@dtn/shared/timer-utils'
import { usePathname, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

import type { Task } from '@dtn/shared/types'

const ACCENT = '#34d399'

// Port of web's FocusReturnBar: selection-driven (not timer-driven), so it
// persists while paused; there's no pause control — return to the Focus
// View to pause. Hidden on Home, where the Focus View already lives.
export function FocusReturnBar() {
  const pathname = usePathname()
  const selection = useSelection()
  const selectedId = selection.data?.selectedTaskId ?? null

  if (!selectedId || pathname === '/') return null
  return <Bar id={selectedId} />
}

function Bar({ id }: { id: string }) {
  const router = useRouter()
  const task = useTask(id).data
  // A Child banks its time on its Keeper, so the running timer lives on the
  // Keeper row — resolve it the same way the Focus View's HeroTimer does.
  const keeper = useTask(task?.timekeeperId ?? '').data
  const timerTask: Task | undefined = task?.timekeeperId ? keeper : task
  const running = timerTask?.timerStartedAt != null

  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [running])

  if (!task) return null
  const elapsed = timerTask ? currentTimerSeconds(timerTask, now) : 0

  return (
    <View
      style={{
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 8,
      }}
    >
      <Pressable
        onPress={() => router.replace('/')}
        accessibilityRole="button"
        accessibilityLabel={`Return to ${task.title}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: pressed ? '#52525b' : '#27272a',
          backgroundColor: 'rgba(24,24,27,0.6)',
          paddingHorizontal: 10,
          paddingVertical: 6,
        })}
      >
        <Text style={{ fontSize: 14, lineHeight: 16 }}>{task.emoji}</Text>
        <Text
          numberOfLines={1}
          style={{
            maxWidth: 144,
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 12,
            color: '#e4e4e7',
          }}
        >
          {task.title}
        </Text>
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 12,
            color: running ? ACCENT : '#71717a',
            fontVariant: ['tabular-nums'],
          }}
        >
          {running ? '' : '⏸ '}
          {formatTimerSeconds(elapsed)}
        </Text>
      </Pressable>
    </View>
  )
}
