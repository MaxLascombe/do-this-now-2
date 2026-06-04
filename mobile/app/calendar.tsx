import { dateString, newSafeDate } from '@dtn/shared/helpers'
import { useAllTasks } from '@dtn/shared/queries'
import type { Task } from '@dtn/shared/types'
import { Stack, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const mono = 'JetBrainsMono_400Regular'

export default function Calendar() {
  const router = useRouter()
  const { data, isLoading } = useAllTasks()
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  const todayKey = dateString(new Date())
  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  const byDay = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const t of data ?? []) {
      const key = dateString(newSafeDate(t.due))
      ;(map[key] ??= []).push(t)
    }
    return map
  }, [data])

  const leading = startOfMonth(cursor).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<number | null> = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const selectedTasks = selectedKey ? (byDay[selectedKey] ?? []) : []

  const shiftMonth = (delta: number) => {
    setCursor(new Date(year, month + delta, 1))
    setSelectedKey(null)
  }
  const goToday = () => {
    setCursor(startOfMonth(new Date()))
    setSelectedKey(todayKey)
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <Stack.Screen options={{ title: 'Calendar' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <NavButton label="‹" onPress={() => shiftMonth(-1)} />
          <Pressable onPress={goToday} accessibilityRole="button">
            <Text style={{ fontFamily: mono, fontSize: 16, color: '#fafafa' }}>
              {MONTHS[month]} {year}
            </Text>
          </Pressable>
          <NavButton label="›" onPress={() => shiftMonth(1)} />
        </View>

        {isLoading ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 32 }} />
        ) : (
          <>
            <View style={{ flexDirection: 'row' }}>
              {WEEKDAYS.map((w, i) => (
                <View key={i} style={{ width: `${100 / 7}%`, alignItems: 'center' }}>
                  <Text style={{ fontFamily: mono, fontSize: 11, color: '#52525b' }}>
                    {w}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {cells.map((day, i) => {
                if (day === null)
                  return <View key={`b${i}`} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />
                const key = dateString(new Date(year, month, day))
                const count = byDay[key]?.length ?? 0
                const isToday = key === todayKey
                const isSelected = key === selectedKey
                return (
                  <View
                    key={key}
                    style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}
                  >
                    <Pressable
                      onPress={() => setSelectedKey(isSelected ? null : key)}
                      accessibilityRole="button"
                      accessibilityLabel={`${MONTHS[month]} ${day}, ${count} task${count === 1 ? '' : 's'}`}
                      style={{
                        flex: 1,
                        borderRadius: 12,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: isSelected
                          ? '#f4f4f5'
                          : isToday
                            ? '#3f3f46'
                            : 'transparent',
                        backgroundColor: isSelected
                          ? '#fafafa'
                          : count > 0
                            ? 'rgba(24,24,27,0.8)'
                            : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: mono,
                          fontSize: 14,
                          color: isSelected
                            ? '#0a0a0a'
                            : isToday
                              ? '#fafafa'
                              : '#a1a1aa',
                        }}
                      >
                        {day}
                      </Text>
                      {count > 0 && (
                        <Text
                          style={{
                            fontFamily: mono,
                            fontSize: 9,
                            marginTop: 1,
                            color: isSelected ? '#52525b' : '#34d399',
                          }}
                        >
                          {count}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                )
              })}
            </View>

            <View style={{ marginTop: 20, gap: 8 }}>
              {selectedKey === null ? (
                <Text
                  style={{
                    fontFamily: mono,
                    fontSize: 13,
                    color: '#52525b',
                    textAlign: 'center',
                    marginTop: 8,
                  }}
                >
                  Tap a day to see its tasks
                </Text>
              ) : (
                <>
                  {selectedTasks.length === 0 ? (
                    <Text
                      style={{
                        fontFamily: mono,
                        fontSize: 13,
                        color: '#52525b',
                        textAlign: 'center',
                        marginTop: 8,
                      }}
                    >
                      Nothing due this day
                    </Text>
                  ) : (
                    selectedTasks.map((t) => (
                      <Pressable
                        key={t.id}
                        onPress={() => router.push(`/tasks/${t.id}/edit`)}
                        accessibilityRole="button"
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 12,
                          borderWidth: 1,
                          borderColor: '#27272a',
                          backgroundColor: 'rgba(24,24,27,0.6)',
                          borderRadius: 14,
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                        }}
                      >
                        <Text style={{ fontSize: 20 }}>{t.emoji}</Text>
                        <Text
                          numberOfLines={1}
                          style={{ flex: 1, fontFamily: mono, fontSize: 14, color: '#fafafa' }}
                        >
                          {t.title}
                        </Text>
                      </Pressable>
                    ))
                  )}
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: '/new-task',
                        params: { due: selectedKey },
                      })
                    }
                    accessibilityRole="button"
                    style={{
                      alignItems: 'center',
                      paddingVertical: 12,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: '#27272a',
                      borderStyle: 'dashed',
                      marginTop: 4,
                    }}
                  >
                    <Text style={{ fontFamily: mono, fontSize: 13, color: '#a1a1aa' }}>
                      + Add a task for this day
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}

function NavButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={8}
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#27272a',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontFamily: mono, fontSize: 20, color: '#a1a1aa' }}>
        {label}
      </Text>
    </Pressable>
  )
}
