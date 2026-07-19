import { formatDaysAgo } from '@dtn/shared/format'
import { dateString } from '@dtn/shared/helpers'
import { useHistory, useStats } from '@dtn/shared/queries'
import { DAY_MS, minutesToHours } from '@dtn/shared/time'
import { type HistoryEntry } from '@dtn/shared/types'
import DateTimePicker from '@react-native-community/datetimepicker'
import { Stack } from 'expo-router'
import { format } from 'date-fns'
import { useCallback, useMemo, useState } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'

import { ErrorState } from '../../components/ErrorState'
import { TaskListSkeleton } from '../../components/Skeleton'
import { PageHeading } from '../../components/PageHeading'
import { usePullRefresh } from '../../hooks/usePullRefresh'

const ACCENT = '#34d399'
const OVERDUE = '#fb7185'
const STREAK = '#f59e0b'

const SWIPE_THRESHOLD = 50

export default function History() {
  const [daysAgo, setDaysAgo] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const jumpToDate = (picked: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const p = new Date(picked)
    p.setHours(0, 0, 0, 0)
    const diff = Math.round((today.getTime() - p.getTime()) / DAY_MS)
    setDaysAgo(Math.max(0, diff))
  }

  const goOlder = useCallback(() => setDaysAgo((d) => d + 1), [])
  const goNewer = useCallback(() => setDaysAgo((d) => Math.max(0, d - 1)), [])

  const dayDate = new Date(Date.now() - daysAgo * DAY_MS)
  const dateKey = dateString(dayDate)
  const isCurrentDay = daysAgo === 0

  const historyQuery = useHistory(dateKey)
  const { refreshing, onRefresh } = usePullRefresh(historyQuery.refetch)
  const stats = useStats()
  const dayStat = stats.data?.heatmap.find((h) => h.date === dateKey)
  const targetHit = dayStat?.hit ?? null

  const swipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) goOlder()
      else if (e.translationX < -SWIPE_THRESHOLD) goNewer()
    })

  const entries = historyQuery.data ?? []
  const totalMinutes = entries.reduce(
    (acc, e) => acc + (e.taskSnapshot.timeFrame ?? 0),
    0,
  )
  const roundedMinutes = Math.round(totalMinutes)
  const hours = Math.floor(roundedMinutes / 60)
  const mins = roundedMinutes % 60

  // Minutes-per-tag for the viewed day, same timeFrame basis as "Time spent".
  const tagMinutes = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of entries) {
      const m = e.taskSnapshot.timeFrame ?? 0
      if (m <= 0) continue
      for (const tag of e.taskSnapshot.tags ?? []) {
        map.set(tag, (map.get(tag) ?? 0) + m)
      }
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [entries])
  const maxTagMin = tagMinutes[0]?.[1] ?? 0

  const relLabel = formatDaysAgo(daysAgo)

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <GestureDetector gesture={swipe}>
        <View style={{ flex: 1 }}>
          <PageHeading eyebrow="past completions">History</PageHeading>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingBottom: 16,
            }}
          >
            <DateStepperButton
              onPress={goOlder}
              accessibilityLabel="Show the previous day"
            >
              ←
            </DateStepperButton>
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Jump to a date"
              style={{ alignItems: 'center' }}
            >
              <Text
                style={{
                  fontFamily: 'JetBrainsMono_700Bold',
                  fontSize: 18,
                  color: '#f4f4f5',
                  letterSpacing: 2.5,
                  textTransform: 'uppercase',
                }}
              >
                {format(dayDate, 'EEE · LLL d')}
              </Text>
              <Text
                style={{
                  fontFamily: 'JetBrainsMono_400Regular',
                  fontSize: 11,
                  letterSpacing: 2.5,
                  color: '#71717a',
                  textTransform: 'uppercase',
                  marginTop: 4,
                }}
              >
                {relLabel} · tap to jump
              </Text>
            </Pressable>
            {pickerOpen && (
              <DateTimePicker
                value={dayDate}
                mode="date"
                maximumDate={new Date()}
                onChange={(_, picked) => {
                  setPickerOpen(false)
                  if (picked) jumpToDate(picked)
                }}
              />
            )}
            <DateStepperButton
              onPress={goNewer}
              disabled={daysAgo === 0}
              accessibilityLabel="Show the next day"
            >
              →
            </DateStepperButton>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#fafafa"
                colors={['#fafafa']}
              />
            }
          >
            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: '#27272a',
                  backgroundColor: 'rgba(24,24,27,0.4)',
                  borderRadius: 16,
                  paddingHorizontal: 20,
                  paddingVertical: 16,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                }}
              >
                <Stat
                  label="Completed"
                  value={String(entries.length)}
                  unit={entries.length === 1 ? 'task' : 'tasks'}
                />
                <Stat
                  label="Time spent"
                  value={mins === 0 ? `${hours}h` : `${hours}h ${mins}m`}
                  unit=""
                />
                <Stat
                  label="On this day"
                  value={format(dayDate, 'd')}
                  unit={format(dayDate, 'LLL')}
                />
                {isCurrentDay ? (
                  <Stat
                    label="Hit target"
                    value="not yet"
                    unit="⚡"
                    accent={STREAK}
                  />
                ) : targetHit === null ? (
                  <Stat label="Hit target" value="—" unit="" />
                ) : targetHit ? (
                  <Stat
                    label="Hit target"
                    value="yes"
                    unit="✓"
                    accent={ACCENT}
                  />
                ) : (
                  <Stat
                    label="Hit target"
                    value="no"
                    unit="✕"
                    accent={OVERDUE}
                  />
                )}
              </View>
            </View>

            {!historyQuery.isLoading && tagMinutes.length > 0 && (
              <View style={{ gap: 6, paddingHorizontal: 20, marginBottom: 20 }}>
                <Text
                  style={{
                    fontFamily: 'JetBrainsMono_400Regular',
                    fontSize: 11,
                    letterSpacing: 2.5,
                    textTransform: 'uppercase',
                    color: '#71717a',
                    marginBottom: 4,
                  }}
                >
                  Time by tag
                </Text>
                {tagMinutes.map(([tag, m]) => (
                  <View
                    key={tag}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        width: 96,
                        color: '#d4d4d8',
                        fontFamily: 'JetBrainsMono_400Regular',
                        fontSize: 13,
                      }}
                    >
                      #{tag}
                    </Text>
                    <View
                      style={{
                        flex: 1,
                        height: 8,
                        borderRadius: 999,
                        backgroundColor: '#18181b',
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          height: 8,
                          borderRadius: 999,
                          backgroundColor: ACCENT,
                          width:
                            `${maxTagMin > 0 ? (m / maxTagMin) * 100 : 0}%` as ViewStyle['width'],
                        }}
                      />
                    </View>
                    <Text
                      style={{
                        width: 56,
                        textAlign: 'right',
                        color: '#71717a',
                        fontFamily: 'JetBrainsMono_400Regular',
                        fontSize: 13,
                      }}
                    >
                      {minutesToHours(m)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {historyQuery.isLoading ? (
              <TaskListSkeleton rows={5} />
            ) : historyQuery.isError && entries.length === 0 ? (
              <View style={{ paddingVertical: 40 }}>
                <ErrorState
                  message="Couldn't load this day's history."
                  onRetry={() => historyQuery.refetch()}
                />
              </View>
            ) : entries.length === 0 ? (
              <Text
                style={{
                  textAlign: 'center',
                  marginTop: 40,
                  color: '#71717a',
                  fontFamily: 'JetBrainsMono_400Regular',
                }}
              >
                Nothing completed.
              </Text>
            ) : (
              <View style={{ gap: 8, paddingHorizontal: 20 }}>
                <Text
                  style={{
                    fontFamily: 'JetBrainsMono_400Regular',
                    fontSize: 11,
                    letterSpacing: 2.5,
                    textTransform: 'uppercase',
                    color: '#71717a',
                    marginBottom: 4,
                  }}
                >
                  {entries.length} completed · sorted by time
                </Text>
                {entries.map((e) => (
                  <CompletedRow key={e.id} entry={e} />
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </GestureDetector>
    </View>
  )
}

function DateStepperButton({
  children,
  onPress,
  disabled,
  accessibilityLabel,
}: {
  children: string
  onPress: () => void
  disabled?: boolean
  accessibilityLabel: string
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#27272a',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
      })}
    >
      <Text style={{ color: '#d4d4d8', fontSize: 16 }}>{children}</Text>
    </Pressable>
  )
}

function Stat({
  label,
  value,
  unit,
  accent,
}: {
  label: string
  value: string
  unit: string
  accent?: string
}) {
  return (
    <View style={{ width: '50%', paddingVertical: 6 }}>
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 11,
          letterSpacing: 2.5,
          color: '#71717a',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
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
            fontSize: 28,
            color: accent ?? '#fafafa',
          }}
        >
          {value}
        </Text>
        {unit ? (
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 13,
              color: '#71717a',
            }}
          >
            {unit}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

function CompletedRow({ entry }: { entry: HistoryEntry }) {
  const task = entry.taskSnapshot
  const completed = new Date(entry.completedAt)
  const completedLabel = completed.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#27272a',
        backgroundColor: 'rgba(24,24,27,0.6)',
      }}
    >
      <View
        accessibilityElementsHidden={true}
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 28,
          height: 28,
          borderRadius: 13,
          borderWidth: 1,
          borderColor: ACCENT,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: ACCENT, fontSize: 15, lineHeight: 16 }}>✓</Text>
      </View>
      <Text style={{ fontSize: 24, lineHeight: 26 }}>{task.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 18,
            color: '#d4d4d8',
            textDecorationLine: 'line-through',
            textDecorationColor: 'rgba(255,255,255,0.25)',
          }}
        >
          {task.title}
        </Text>
        <View
          style={{
            marginTop: 3,
            flexDirection: 'row',
            flexWrap: 'wrap',
          }}
        >
          <MetaItem>at {completedLabel}</MetaItem>
          {task.dueTime && <MetaItem>due {task.dueTime}</MetaItem>}
          {task.timeFrame ? (
            <MetaItem>{minutesToHours(task.timeFrame)}</MetaItem>
          ) : null}
          {(task.tags ?? []).map((t) => (
            <MetaItem key={t}>#{t}</MetaItem>
          ))}
        </View>
      </View>
    </View>
  )
}

function MetaItem({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: 'JetBrainsMono_400Regular',
        fontSize: 13,
        color: '#71717a',
        marginRight: 12,
      }}
    >
      {children}
    </Text>
  )
}
