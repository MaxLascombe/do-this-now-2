import { newSafeDate } from '@dtn/shared/helpers'
import {
  heatmapCellPosition,
  heatmapColor,
  percentile,
  robustChartMax,
} from '@dtn/shared/heatmap'
import { useStats } from '@dtn/shared/queries'
import { minutesToHours } from '@dtn/shared/time'
import type { StatsResult } from '@dtn/shared/types'
import { Stack } from 'expo-router'
import { useState } from 'react'
import { RefreshControl, ScrollView, Text, View } from 'react-native'

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
            gap: 24,
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
          <View style={{ flexDirection: 'row', gap: 24 }}>
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
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#27272a',
        backgroundColor: 'rgba(24,24,27,0.3)',
        padding: 20,
      }}
    >
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 10,
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: '#71717a',
          marginBottom: 16,
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  )
}

function MutedNote({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        fontFamily: 'JetBrainsMono_400Regular',
        fontSize: 14,
        color: '#71717a',
      }}
    >
      {children}
    </Text>
  )
}

function Counter({
  label,
  value,
  size = 36,
  color,
}: {
  label: string
  value: string | number
  size?: number
  color?: string
}) {
  return (
    <View>
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 10,
          letterSpacing: 3,
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
          lineHeight: size,
          color: color ?? '#fafafa',
          marginTop: 4,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  )
}

function VanityCounters({ data }: { data: StatsResult }) {
  return (
    <Section title="Completions">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 24 }}>
        <View style={{ width: '50%' }}>
          <Counter label="Today" value={data.totalToday} />
        </View>
        <View style={{ width: '50%' }}>
          <Counter label="This week" value={data.totalThisWeek} />
        </View>
        <View style={{ width: '50%' }}>
          <Counter label="This month" value={data.totalThisMonth} />
        </View>
        <View style={{ width: '50%' }}>
          <Counter label="All time" value={data.totalAllTime} />
        </View>
      </View>
    </Section>
  )
}

function StreakSummary({ data }: { data: StatsResult }) {
  return (
    <Section title="Streak">
      <View style={{ flexDirection: 'row' }}>
        <View style={{ flex: 1 }}>
          <Counter
            label="Current"
            value={`${data.currentStreak}d`}
            color={STREAK}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Counter label="Longest" value={`${data.longestStreak}d`} />
        </View>
        <View style={{ flex: 1 }}>
          <Counter
            label="Days hit target"
            value={data.totalDaysHit}
            size={48}
          />
        </View>
      </View>
    </Section>
  )
}

const CELL = 14
const CELL_GAP = 3
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function Heatmap({ data }: { data: StatsResult }) {
  const [gridWidth, setGridWidth] = useState(0)
  const last = data.heatmap.at(-1)
  if (!last) return null
  const today = newSafeDate(last.date)
  const todayDow = today.getDay()

  // As many week-columns as fit the measured width — the shared rule with
  // web's responsive heatmap.
  const cols = gridWidth
    ? Math.max(4, Math.floor((gridWidth + CELL_GAP) / (CELL + CELL_GAP)))
    : 0

  const byPos = new Map<string, { minutes: number; hit: boolean }>()
  if (cols > 0) {
    for (let i = 0; i < data.heatmap.length; i++) {
      const { col, row } = heatmapCellPosition(
        i,
        data.heatmap.length,
        todayDow,
        cols,
      )
      if (col >= 0) byPos.set(`${col}:${row}`, data.heatmap[i])
    }
  }

  const nonZeroSorted = data.heatmap
    .map((d) => d.minutes)
    .filter((m) => m > 0)
    .sort((a, b) => a - b)
  const p33 = percentile(nonZeroSorted, 33)
  const p66 = percentile(nonZeroSorted, 66)

  return (
    <Section title="Last 6 months">
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ gap: CELL_GAP }}>
          {DAY_LABELS.map((d, i) => (
            <Text
              key={i}
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 10,
                lineHeight: CELL,
                height: CELL,
                color: '#52525b',
              }}
            >
              {d}
            </Text>
          ))}
        </View>
        <View
          style={{ flex: 1, minWidth: 0 }}
          onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
        >
          {cols > 0 && (
            <View style={{ flexDirection: 'row', gap: CELL_GAP }}>
              {Array.from({ length: cols }).map((_, col) => (
                <View key={col} style={{ gap: CELL_GAP }}>
                  {Array.from({ length: 7 }).map((_, row) => {
                    const cell = byPos.get(`${col}:${row}`)
                    return (
                      <View
                        key={row}
                        style={{
                          width: CELL,
                          height: CELL,
                          borderRadius: 2,
                          backgroundColor: cell
                            ? heatmapColor(cell.minutes, cell.hit, p33, p66)
                            : 'rgba(255,255,255,0.02)',
                        }}
                      />
                    )
                  })}
                </View>
              ))}
            </View>
          )}
        </View>
        <View
          style={{ alignItems: 'flex-end', justifyContent: 'space-between' }}
        >
          <Text style={legendText}>more</Text>
          <View style={{ gap: CELL_GAP }}>
            {[ACCENT, '#059669', '#065f46', 'rgba(255,255,255,0.04)'].map(
              (c) => (
                <View
                  key={c}
                  style={{
                    width: CELL,
                    height: CELL,
                    borderRadius: 2,
                    backgroundColor: c,
                  }}
                />
              ),
            )}
          </View>
          <Text style={legendText}>less</Text>
        </View>
      </View>
    </Section>
  )
}

const legendText = {
  fontFamily: 'JetBrainsMono_400Regular',
  fontSize: 10,
  color: '#52525b',
} as const

const axisText = legendText

function DailyBars({ data }: { data: StatsResult }) {
  const days = data.last30Days
  const max = Math.max(1, ...days.map((d) => d.minutes))
  return (
    <Section title="Last 30 days · minutes done">
      <View
        style={{
          height: 96,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 2,
        }}
      >
        {days.map((d, i) => {
          const opacity = 0.35 + 0.65 * (i / Math.max(1, days.length - 1))
          return (
            <View
              key={d.date}
              style={{
                flex: 1,
                borderRadius: 2,
                height: `${Math.max(2, (d.minutes / max) * 100)}%`,
                backgroundColor: ACCENT,
                opacity,
              }}
            />
          )
        })}
      </View>
      <View
        style={{
          marginTop: 8,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <Text style={axisText}>{days[0]?.date}</Text>
        <Text style={axisText}>{days[days.length - 1]?.date}</Text>
      </View>
    </Section>
  )
}

function ChartHeader({ total, peak }: { total: number; peak: string }) {
  return (
    <View
      style={{
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
      }}
    >
      <Text style={{ ...legendText, color: '#71717a' }}>
        {total} completion{total === 1 ? '' : 's'}
      </Text>
      <Text style={{ ...legendText, color: '#71717a' }}>{peak}</Text>
    </View>
  )
}

function HourOfDay({ data }: { data: StatsResult }) {
  const max = Math.max(...data.hourOfDay)
  const scaleMax = robustChartMax(data.hourOfDay)
  const total = data.hourOfDay.reduce((a, b) => a + b, 0)
  if (total === 0) {
    return (
      <Section title="Hour of day">
        <MutedNote>No completions yet.</MutedNote>
      </Section>
    )
  }
  return (
    <Section title="Hour of day">
      <ChartHeader total={total} peak={`peak ${max}/hr`} />
      <View
        style={{
          height: 80,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 2,
        }}
      >
        {data.hourOfDay.map((c, i) => {
          const pct = Math.min(100, (c / scaleMax) * 100)
          return (
            <View
              key={i}
              style={{
                flex: 1,
                borderRadius: 2,
                height: c === 0 ? 4 : `${Math.max(8, pct)}%`,
                backgroundColor: c === 0 ? 'rgba(255,255,255,0.06)' : '#e4e4e7',
                opacity: c === 0 ? 1 : 0.55 + Math.min(1, c / scaleMax) * 0.45,
              }}
            />
          )
        })}
      </View>
      <View
        style={{
          marginTop: 4,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        {['00', '06', '12', '18', '23'].map((h) => (
          <Text key={h} style={axisText}>
            {h}
          </Text>
        ))}
      </View>
    </Section>
  )
}

function DayOfWeek({ data }: { data: StatsResult }) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const max = Math.max(...data.dayOfWeek)
  const scaleMax = robustChartMax(data.dayOfWeek)
  const total = data.dayOfWeek.reduce((a, b) => a + b, 0)
  if (total === 0) {
    return (
      <Section title="Day of week">
        <MutedNote>No completions yet.</MutedNote>
      </Section>
    )
  }
  return (
    <Section title="Day of week">
      <ChartHeader total={total} peak={`peak ${max}`} />
      <View
        style={{
          height: 80,
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 6,
        }}
      >
        {data.dayOfWeek.map((c, i) => {
          const pct = Math.min(100, (c / scaleMax) * 100)
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              <View
                style={{
                  width: '100%',
                  borderRadius: 2,
                  height: c === 0 ? 4 : `${Math.max(8, pct)}%`,
                  backgroundColor: c === 0 ? 'rgba(255,255,255,0.06)' : STREAK,
                  opacity:
                    c === 0 ? 1 : 0.55 + Math.min(1, c / scaleMax) * 0.45,
                }}
              />
              <Text style={axisText}>{labels[i][0]}</Text>
            </View>
          )
        })}
      </View>
    </Section>
  )
}

function BarRow({
  lead,
  title,
  fraction,
  count,
  color,
  countWidth = 32,
}: {
  lead?: string
  title: string
  fraction: number
  count: string
  color: string
  countWidth?: number
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      {lead !== undefined && (
        <Text style={{ width: 28, fontSize: 18 }}>{lead}</Text>
      )}
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 14,
          color: '#e4e4e7',
        }}
      >
        {title}
      </Text>
      <View
        style={{
          width: 160,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            flex: 1,
            height: 8,
            borderRadius: 4,
            overflow: 'hidden',
            backgroundColor: '#18181b',
          }}
        >
          <View
            style={{
              height: '100%',
              width: `${fraction * 100}%`,
              backgroundColor: color,
              opacity: 0.85,
            }}
          />
        </View>
        <Text
          style={{
            width: countWidth,
            textAlign: 'right',
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 12,
            color: '#a1a1aa',
            fontVariant: ['tabular-nums'],
          }}
        >
          {count}
        </Text>
      </View>
    </View>
  )
}

function TopTasks({ data }: { data: StatsResult }) {
  if (data.topTasks.length === 0) {
    return (
      <Section title="Most-completed tasks">
        <MutedNote>
          Nothing completed yet. Come back after you crush a few.
        </MutedNote>
      </Section>
    )
  }
  const max = data.topTasks[0].count
  return (
    <Section title="Most-completed tasks">
      <View style={{ gap: 8 }}>
        {data.topTasks.map((t) => (
          <BarRow
            key={t.title}
            lead={t.emoji}
            title={t.title}
            fraction={t.count / max}
            count={String(t.count)}
            color={ACCENT}
          />
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
      <View style={{ gap: 8 }}>
        {data.tagTime.map((t) => (
          <BarRow
            key={t.tag}
            title={`#${t.tag}`}
            fraction={t.minutes / max}
            count={minutesToHours(t.minutes)}
            color={ACCENT}
            countWidth={48}
          />
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
      <View style={{ gap: 8 }}>
        {data.emojiFreq.map((e) => (
          <BarRow
            key={e.emoji}
            lead={e.emoji}
            title=""
            fraction={e.count / max}
            count={String(e.count)}
            color={STREAK}
          />
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
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#27272a',
        backgroundColor: 'rgba(24,24,27,0.4)',
        paddingHorizontal: 16,
        paddingVertical: 12,
      }}
    >
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 10,
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: '#71717a',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: 'JetBrainsMono_700Bold',
          fontSize: 24,
          lineHeight: 24,
          marginTop: 4,
          color: accent ?? '#fafafa',
          fontVariant: ['tabular-nums'],
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
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
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
        <View style={{ flexDirection: 'row', gap: 12 }}>
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
