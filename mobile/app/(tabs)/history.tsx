import { dateString } from '@dtn/shared/helpers'
import { useHistory, useStats } from '@dtn/shared/queries'
import { DAY_MS, minutesToHours } from '@dtn/shared/time'
import { type HistoryEntry } from '@dtn/shared/types'
import { Stack } from 'expo-router'
import { format } from 'date-fns'
import { useCallback, useState } from 'react'
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Loading } from '../../components/Loading'
import { PageHeading } from '../../components/PageHeading'
import { TopProgress } from '../../components/TopProgress'

const ACCENT = '#34d399'
const OVERDUE = '#fb7185'
const STREAK = '#f59e0b'

const SWIPE_THRESHOLD = 50

export default function History() {
  const [daysAgo, setDaysAgo] = useState(0)

  const goOlder = useCallback(() => setDaysAgo((d) => d + 1), [])
  const goNewer = useCallback(
    () => setDaysAgo((d) => Math.max(0, d - 1)),
    [],
  )

  const dayDate = new Date(Date.now() - daysAgo * DAY_MS)
  const dateKey = dateString(dayDate)
  const isCurrentDay = daysAgo === 0

  const historyQuery = useHistory(dateKey)
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
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  const relLabel =
    daysAgo === 0
      ? 'today'
      : daysAgo === 1
        ? '1 day ago'
        : `${daysAgo} days ago`

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#0a0a0a' }}
      edges={['top']}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <TopProgress />
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
            <DateStepperButton onPress={goOlder}>←</DateStepperButton>
            <View style={{ alignItems: 'center' }}>
              <Text
                style={{
                  fontFamily: 'JetBrainsMono_700Bold',
                  fontSize: 16,
                  color: '#fafafa',
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                }}
              >
                {format(dayDate, 'EEE · LLL d')}
              </Text>
              <Text
                style={{
                  fontFamily: 'JetBrainsMono_400Regular',
                  fontSize: 10,
                  letterSpacing: 2.5,
                  color: '#71717a',
                  textTransform: 'uppercase',
                  marginTop: 4,
                }}
              >
                {relLabel}
              </Text>
            </View>
            <DateStepperButton onPress={goNewer} disabled={daysAgo === 0}>
              →
            </DateStepperButton>
          </View>

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
              <Stat label="Completed" value={String(entries.length)} unit="tasks" />
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
                <Stat label="Hit target" value="not yet" unit="⚡" accent={STREAK} />
              ) : targetHit === null ? (
                <Stat label="Hit target" value="—" unit="" />
              ) : targetHit ? (
                <Stat label="Hit target" value="yes" unit="✓" accent={ACCENT} />
              ) : (
                <Stat label="Hit target" value="no" unit="✕" accent={OVERDUE} />
              )}
            </View>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 24 }}
            refreshControl={
              <RefreshControl
                refreshing={
                  historyQuery.isFetching && !historyQuery.isPending
                }
                onRefresh={() => historyQuery.refetch()}
                tintColor="#fafafa"
                colors={['#fafafa']}
              />
            }
          >
            {historyQuery.isLoading ? (
              <View style={{ paddingVertical: 40 }}>
                <Loading />
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
                    fontSize: 10,
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
    </SafeAreaView>
  )
}

function DateStepperButton({
  children,
  onPress,
  disabled,
}: {
  children: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
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
          fontSize: 10,
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
            fontSize: 22,
            color: accent ?? '#fafafa',
          }}
        >
          {value}
        </Text>
        {unit ? (
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 11,
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
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#27272a',
        backgroundColor: 'rgba(24,24,27,0.6)',
      }}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          borderWidth: 1,
          borderColor: ACCENT,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: ACCENT, fontSize: 14, lineHeight: 14 }}>✓</Text>
      </View>
      <Text style={{ fontSize: 22, lineHeight: 24 }}>{task.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text
          numberOfLines={1}
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 17,
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
        fontSize: 11,
        color: '#71717a',
        marginRight: 12,
      }}
    >
      {children}
    </Text>
  )
}
