import { newSafeDate } from '@dtn/shared/helpers'
import {
  heatmapCellPosition,
  heatmapColor,
  percentile,
} from '@dtn/shared/heatmap'
import { useStats } from '@dtn/shared/queries'
import { minutesToHours } from '@dtn/shared/time'
import type { StatsResult } from '@dtn/shared/types'
import { Stack } from 'expo-router'
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from 'react-native'

import { ErrorState } from '../../components/ErrorState'
import { Loading } from '../../components/Loading'
import { PageHeading } from '../../components/PageHeading'
import { usePullRefresh } from '../../hooks/usePullRefresh'

const ACCENT = '#34d399'
const STREAK = '#f59e0b'
const OVERDUE = '#fb7185'

export default function Stats() {
  const { data, isPending, isError, refetch } = useStats()
  const { refreshing, onRefresh } = usePullRefresh(refetch)

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageHeading eyebrow="all the numbers">Stats</PageHeading>
      {!data ? (
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isError && !isPending ? (
            <ErrorState
              message="Couldn't load your stats."
              onRetry={() => refetch()}
            />
          ) : (
            <Loading />
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: 32,
            gap: 12,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fafafa"
              colors={['#fafafa']}
            />
          }
        >
          <VanityCounters data={data} />
          <StreakSummary data={data} />
          <Heatmap data={data} />
          <DailyBars data={data} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <HourOfDay data={data} />
            </View>
            <View style={{ flex: 1 }}>
              <DayOfWeek data={data} />
            </View>
          </View>
          <TopTasks data={data} />
          <TagTime data={data} />
          <EmojiMix data={data} />
          <Discipline data={data} />
        </ScrollView>
      )}
    </View>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: '#27272a',
        backgroundColor: 'rgba(24,24,27,0.3)',
        borderRadius: 16,
        padding: 14,
      }}
    >
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 10,
          letterSpacing: 2.5,
          textTransform: 'uppercase',
          color: '#71717a',
          marginBottom: 10,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  )
}

function Counter({
  label,
  value,
  size = 24,
  color,
}: {
  label: string
  value: string | number
  size?: number
  color?: string
}) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#27272a',
        backgroundColor: 'rgba(24,24,27,0.4)',
        paddingHorizontal: 14,
        paddingVertical: 10,
      }}
    >
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 10,
          letterSpacing: 2.5,
          textTransform: 'uppercase',
          color: '#71717a',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: 'JetBrainsMono_700Bold',
          fontSize: size,
          color: color ?? '#fafafa',
          marginTop: 4,
          lineHeight: size,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

function VanityCounters({ data }: { data: StatsResult }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Counter label="Today" value={data.totalToday} />
        <Counter label="This week" value={data.totalThisWeek} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Counter label="This month" value={data.totalThisMonth} />
        <Counter label="All time" value={data.totalAllTime} />
      </View>
    </View>
  )
}

function StreakSummary({ data }: { data: StatsResult }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      <Counter
        label="Current"
        value={`${data.currentStreak}d`}
        color={STREAK}
      />
      <Counter label="Longest" value={`${data.longestStreak}d`} />
      <Counter label="Days hit" value={data.totalDaysHit} />
    </View>
  )
}

const HEATMAP_COLS = 22

function Heatmap({ data }: { data: StatsResult }) {
  const last = data.heatmap[data.heatmap.length - 1]
  if (!last) return null
  const today = newSafeDate(last.date)
  const todayDow = today.getDay()
  const cellSize = 11
  const gap = 3
  type Cell = { date: string; minutes: number; hit: boolean }
  const empty: Cell = { date: '', minutes: 0, hit: false }
  const grid: Cell[][] = Array.from({ length: HEATMAP_COLS }, () =>
    Array.from({ length: 7 }, () => empty),
  )
  for (let i = 0; i < data.heatmap.length; i++) {
    const { col, row } = heatmapCellPosition(
      i,
      data.heatmap.length,
      todayDow,
      HEATMAP_COLS,
    )
    if (col >= 0 && col < HEATMAP_COLS) grid[col][row] = data.heatmap[i]
  }
  const nonZeroSorted = data.heatmap
    .map((d) => d.minutes)
    .filter((m) => m > 0)
    .sort((a, b) => a - b)
  const p33 = percentile(nonZeroSorted, 33)
  const p66 = percentile(nonZeroSorted, 66)

  return (
    <Section title="Last 6 months">
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Activity over the last 6 months: ${nonZeroSorted.length} active ${
          nonZeroSorted.length === 1 ? 'day' : 'days'
        }, ${data.totalDaysHit} ${
          data.totalDaysHit === 1 ? 'day' : 'days'
        } hit the daily target.`}
        style={{ flexDirection: 'row', gap }}
      >
        {grid.map((col, ci) => (
          <View key={ci} style={{ gap }}>
            {col.map((cell, ri) => (
              <View
                key={ri}
                style={{
                  width: cellSize,
                  height: cellSize,
                  borderRadius: 2,
                  backgroundColor: cell.date
                    ? heatmapColor(cell.minutes, cell.hit, p33, p66)
                    : 'rgba(255,255,255,0.02)',
                }}
              />
            ))}
          </View>
        ))}
      </View>
    </Section>
  )
}

function DailyBars({ data }: { data: StatsResult }) {
  const days = data.last30Days
  const max = Math.max(1, ...days.map((d) => d.minutes))
  const totalMinutes = days.reduce((a, d) => a + d.minutes, 0)
  const peakMinutes = days.length ? Math.max(...days.map((d) => d.minutes)) : 0
  return (
    <Section title="Last 30 days · minutes done">
      <View
        accessibilityRole="image"
        accessibilityLabel={`Minutes completed per day over the last 30 days. ${totalMinutes} minutes total${
          peakMinutes > 0 ? `, peak ${peakMinutes} minutes in a day` : ''
        }.`}
        style={{ flexDirection: 'row', height: 60, alignItems: 'flex-end' }}
      >
        {days.map((d, i) => {
          const opacity = 0.4 + 0.6 * (i / Math.max(1, days.length - 1))
          return (
            <View
              key={d.date + i}
              style={{
                flex: 1,
                marginHorizontal: 0.5,
                backgroundColor: ACCENT,
                opacity,
                borderRadius: 1,
                height: `${Math.max(2, (d.minutes / max) * 100)}%` as ViewStyle['height'],
              }}
            />
          )
        })}
      </View>
    </Section>
  )
}

function HourOfDay({ data }: { data: StatsResult }) {
  const total = data.hourOfDay.reduce((a, b) => a + b, 0)
  if (total === 0) {
    return (
      <Section title="Hour of day">
        <Text style={{ color: '#71717a', fontSize: 12 }}>
          No completions yet.
        </Text>
      </Section>
    )
  }
  const max = Math.max(...data.hourOfDay)
  const peakHour = data.hourOfDay.indexOf(max)
  return (
    <Section title="Hour of day">
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 10,
          color: '#71717a',
          marginBottom: 6,
        }}
      >
        peak {max}/hr
      </Text>
      <View
        accessibilityRole="image"
        accessibilityLabel={`Completions by hour of day. Busiest hour ${peakHour
          .toString()
          .padStart(2, '0')}:00 with ${max} completion${max === 1 ? '' : 's'}.`}
        style={{ flexDirection: 'row', height: 50, alignItems: 'flex-end' }}
      >
        {data.hourOfDay.map((c, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              marginHorizontal: 0.4,
              backgroundColor: c === 0 ? 'rgba(255,255,255,0.06)' : '#e4e4e7',
              opacity: c === 0 ? 1 : 0.55 + (c / max) * 0.45,
              borderRadius: 1,
              height:
                c === 0
                  ? 4
                  : (`${Math.max(10, (c / max) * 100)}%` as ViewStyle['height']),
            }}
          />
        ))}
      </View>
    </Section>
  )
}

function DayOfWeek({ data }: { data: StatsResult }) {
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const total = data.dayOfWeek.reduce((a, b) => a + b, 0)
  if (total === 0) {
    return (
      <Section title="Day of week">
        <Text style={{ color: '#71717a', fontSize: 12 }}>
          No completions yet.
        </Text>
      </Section>
    )
  }
  const max = Math.max(...data.dayOfWeek)
  const peakDay = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ][data.dayOfWeek.indexOf(max)]
  return (
    <Section title="Day of week">
      <View
        accessibilityRole="image"
        accessibilityLabel={`Completions by day of week. Busiest day ${peakDay} with ${max} completion${max === 1 ? '' : 's'}.`}
        style={{
          flexDirection: 'row',
          height: 60,
          alignItems: 'flex-end',
          gap: 4,
        }}
      >
        {data.dayOfWeek.map((c, i) => (
          <View
            key={i}
            style={{ flex: 1, alignItems: 'center', height: '100%' }}
          >
            <View
              style={{
                flex: 1,
                width: '100%',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              <View
                style={{
                  width: '100%',
                  backgroundColor:
                    c === 0 ? 'rgba(255,255,255,0.06)' : STREAK,
                  opacity: c === 0 ? 1 : 0.55 + (c / max) * 0.45,
                  borderRadius: 1,
                  height:
                    c === 0
                      ? 4
                      : (`${Math.max(10, (c / max) * 100)}%` as ViewStyle['height']),
                }}
              />
            </View>
            <Text
              style={{
                fontSize: 9,
                fontFamily: 'JetBrainsMono_400Regular',
                color: '#52525b',
                marginTop: 4,
              }}
            >
              {labels[i]}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  )
}

function TopTasks({ data }: { data: StatsResult }) {
  if (data.topTasks.length === 0) {
    return (
      <Section title="Most-completed tasks">
        <Text style={{ color: '#71717a', fontSize: 12 }}>
          Nothing completed yet.
        </Text>
      </Section>
    )
  }
  const max = data.topTasks[0].count
  return (
    <Section title="Most-completed tasks">
      <View style={{ gap: 10 }}>
        {data.topTasks.map((t) => (
          <View
            key={t.title}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Text style={{ fontSize: 16, width: 22 }}>{t.emoji}</Text>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontFamily: 'JetBrainsMono_400Regular',
                color: '#e4e4e7',
                fontSize: 13,
              }}
            >
              {t.title}
            </Text>
            <View
              style={{
                width: 60,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#18181b',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${(t.count / max) * 100}%` as ViewStyle['width'],
                  backgroundColor: ACCENT,
                  opacity: 0.85,
                }}
              />
            </View>
            <Text
              style={{
                width: 24,
                textAlign: 'right',
                color: '#a1a1aa',
                fontSize: 11,
                fontFamily: 'JetBrainsMono_400Regular',
              }}
            >
              {t.count}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  )
}

function TagTime({ data }: { data: StatsResult }) {
  if (data.tagTime.length === 0) return null
  const max = Math.max(1, data.tagTime[0].minutes)
  return (
    <Section title="Time by tag">
      <View style={{ gap: 10 }}>
        {data.tagTime.map((t) => (
          <View
            key={t.tag}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontFamily: 'JetBrainsMono_400Regular',
                color: '#e4e4e7',
                fontSize: 13,
              }}
            >
              #{t.tag}
            </Text>
            <View
              style={{
                width: 60,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#18181b',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${(t.minutes / max) * 100}%` as ViewStyle['width'],
                  backgroundColor: ACCENT,
                  opacity: 0.85,
                }}
              />
            </View>
            <Text
              style={{
                width: 36,
                textAlign: 'right',
                color: '#a1a1aa',
                fontSize: 11,
                fontFamily: 'JetBrainsMono_400Regular',
              }}
            >
              {minutesToHours(t.minutes)}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  )
}

function EmojiMix({ data }: { data: StatsResult }) {
  if (data.emojiFreq.length === 0) return null
  const max = Math.max(1, ...data.emojiFreq.map((e) => e.count))
  return (
    <Section title="Your task mix">
      <View style={{ gap: 10 }}>
        {data.emojiFreq.map((e) => (
          <View
            key={e.emoji}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            <Text style={{ fontSize: 16, width: 22 }}>{e.emoji}</Text>
            <View
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#18181b',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${(e.count / max) * 100}%` as ViewStyle['width'],
                  backgroundColor: STREAK,
                  opacity: 0.85,
                }}
              />
            </View>
            <Text
              style={{
                width: 24,
                textAlign: 'right',
                color: '#a1a1aa',
                fontSize: 11,
                fontFamily: 'JetBrainsMono_400Regular',
              }}
            >
              {e.count}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  )
}

function DisciplinePill({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#27272a',
        backgroundColor: 'rgba(24,24,27,0.4)',
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 10,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: '#71717a',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: 'JetBrainsMono_700Bold',
          fontSize: 18,
          color: accent ?? '#fafafa',
          marginTop: 4,
          lineHeight: 18,
        }}
      >
        {value}
      </Text>
    </View>
  )
}

function Discipline({ data }: { data: StatsResult }) {
  return (
    <Section title="Discipline">
      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <DisciplinePill
            label="On-time"
            value={
              data.onTimeRate === null
                ? '—'
                : `${Math.round(data.onTimeRate * 100)}%`
            }
            accent={ACCENT}
          />
          <DisciplinePill
            label="Avg latency"
            value={
              data.avgLatencyDays === null
                ? '—'
                : `${data.avgLatencyDays.toFixed(1)}d`
            }
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <DisciplinePill
            label="Snoozes / wk"
            value={String(data.snoozesThisWeek)}
          />
          <DisciplinePill
            label="Abandoned"
            value={String(data.abandonedCount)}
            accent={OVERDUE}
          />
        </View>
      </View>
    </Section>
  )
}
