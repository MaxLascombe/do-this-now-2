import {
  useAllTasks,
  useProgressToday,
  useSettings,
} from '@dtn/shared/queries'
import { useEffect, useState } from 'react'
import { Alert, Switch, Text, View } from 'react-native'

import {
  DEFAULT_TOGGLES,
  ensurePermission,
  loadToggles,
  replanNotifications,
  saveToggles,
  type NotificationToggles,
} from '../lib/notifications'

const ROWS: Array<{ key: keyof NotificationToggles; label: string; hint: string }> = [
  { key: 'dueTime', label: 'Due-time alerts', hint: 'when a timed task is due' },
  { key: 'snoozeWake', label: 'Snooze wake', hint: 'when a snoozed task returns' },
  {
    key: 'streakRisk',
    label: 'Streak at risk',
    hint: 'when the win stops being coverable at pace',
  },
  {
    key: 'morningBrief',
    label: 'Morning brief',
    hint: 'the day’s terms at workday start',
  },
]

// Per-trigger notification opt-ins. First enable asks for iOS permission;
// every change re-plans the on-device schedule immediately.
export function NotificationSettings() {
  const [toggles, setToggles] = useState<NotificationToggles | null>(null)
  const tasks = useAllTasks()
  const progress = useProgressToday()
  const settings = useSettings()

  useEffect(() => {
    void loadToggles().then(setToggles)
  }, [])

  if (!toggles) return null

  const set = async (key: keyof NotificationToggles, value: boolean) => {
    if (value && !(await ensurePermission())) {
      Alert.alert(
        'Notifications are off',
        'Enable notifications for Do This Now in iOS Settings first.',
      )
      return
    }
    const next = { ...toggles, [key]: value }
    setToggles(next)
    await saveToggles(next)
    void replanNotifications({
      tasks: tasks.data ?? [],
      progress: progress.data,
      settings: settings.data,
      toggles: next,
    })
  }

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: '#27272a',
        borderRadius: 16,
        backgroundColor: 'rgba(24,24,27,0.6)',
        paddingHorizontal: 20,
        paddingVertical: 18,
        gap: 14,
      }}
    >
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 11,
          letterSpacing: 3,
          color: '#71717a',
          textTransform: 'uppercase',
        }}
      >
        Notifications
      </Text>
      {ROWS.map((row) => (
        <View
          key={row.key}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 14,
                color: '#e4e4e7',
              }}
            >
              {row.label}
            </Text>
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 11,
                color: '#71717a',
                marginTop: 2,
              }}
            >
              {row.hint}
            </Text>
          </View>
          <Switch
            value={toggles[row.key]}
            onValueChange={(v) => void set(row.key, v)}
            trackColor={{ true: '#34d399', false: '#3f3f46' }}
            accessibilityLabel={row.label}
          />
        </View>
      ))}
    </View>
  )
}

export const NOTIFICATION_DEFAULTS = DEFAULT_TOGGLES
