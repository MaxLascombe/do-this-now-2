import { Stack } from 'expo-router'
import {
  RefreshControl,
  ScrollView,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Loading } from '../../components/Loading'
import { useStats } from '@dtn/shared/queries'
import type { StatsResult } from '@dtn/shared/types'

export default function Stats() {
  const statsQuery = useStats()
  const { data, isPending, isFetching, refetch } = statsQuery

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['bottom']}>
      <Stack.Screen options={{ title: 'Stats' }} />
      {isPending || !data ? (
        <View className="flex-1 items-center justify-center">
          <Loading />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isPending}
              onRefresh={() => refetch()}
              tintColor="#fff"
              colors={['#fff']}
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
          <EmojiBreakdown data={data} />
          <PillGrid data={data} />
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

// ---------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <View className="rounded-lg border border-gray-800 bg-[#0a0a0a] p-3">
      <Text className="mb-3 text-[10px] uppercase tracking-wider text-gray-500">
        {title}
      </Text>
      {children}
    </View>
  )
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 rounded-lg border border-gray-800 bg-[#0a0a0a] px-3 py-2">
      <Text className="text-[10px] uppercase tracking-wider text-gray-500">
        {label}
      </Text>
      <Text className="text-xl font-semibold text-white">{value}</Text>
    </View>
  )
}

function PillRow({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {items.map((it) => (
        <Pill key={it.label} label={it.label} value={it.value} />
      ))}
    </View>
  )
}

function VanityCounters({ data }: { data: StatsResult }) {
  return (
    <View style={{ gap: 8 }}>
      <PillRow
        items={[
          { label: 'Today', value: String(data.totalToday) },
          { label: 'Week', value: String(data.totalThisWeek) },
        ]}
      />
      <PillRow
        items={[
          { label: 'Month', value: String(data.totalThisMonth) },
          { label: 'All-time', value: String(data.totalAllTime) },
        ]}
      />
    </View>
  )
}

function StreakSummary({ data }: { data: StatsResult }) {
  return (
    <PillRow
      items={[
        { label: 'Streak', value: `${data.currentStreak}d` },
        { label: 'Longest', value: `${data.longestStreak}d` },
        { label: 'Days hit', value: String(data.totalDaysHit) },
      ]}
    />
  )
}

function Heatmap({ data }: { data: StatsResult }) {
  // 12 columns × 7 rows. Same logic as the web variant — anchor today in
  // the rightmost column, walk backward.
  const last = data.heatmap[data.heatmap.length - 1]
  if (!last) return null
  const today = new Date(last.date)
  const todayDow = today.getDay()
  const cellSize = 12
  const gap = 3
  type Cell = { date: string; hit: boolean }
  const grid: Cell[][] = Array.from({ length: 12 }, () =>
    Array.from({ length: 7 }, () => ({ date: '', hit: false })),
  )
  for (let i = 0; i < data.heatmap.length; i++) {
    const offsetFromToday = data.heatmap.length - 1 - i
    const dowOffset = todayDow - offsetFromToday
    const colsBack = Math.ceil(-dowOffset / 7)
    const col = 11 - colsBack
    const row = ((dowOffset % 7) + 7) % 7
    if (col >= 0 && col < 12) grid[col][row] = data.heatmap[i]
  }
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  return (
    <Section title="Last 12 weeks">
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <View style={{ gap }}>
          {labels.map((l, i) => (
            <Text
              key={i}
              style={{
                height: cellSize,
                lineHeight: cellSize,
                fontSize: 9,
                color: '#4b5563',
              }}
            >
              {l}
            </Text>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap }}>
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
                      ? cell.hit
                        ? '#22c55e'
                        : '#1f2937'
                      : '#0a0a0a',
                  }}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
    </Section>
  )
}

function DailyBars({ data }: { data: StatsResult }) {
  const max = Math.max(1, ...data.last30Days.map((d) => d.minutes))
  return (
    <Section title="Last 30 days · minutes done">
      <View
        style={{ flexDirection: 'row', height: 80, alignItems: 'flex-end' }}
      >
        {data.last30Days.map((d, i) => (
          <View
            key={d.date + i}
            style={{
              flex: 1,
              marginHorizontal: 0.5,
              backgroundColor: 'rgba(59,130,246,0.7)',
              borderRadius: 1,
              height: `${Math.max(2, (d.minutes / max) * 100)}%` as ViewStyle['height'],
            }}
          />
        ))}
      </View>
    </Section>
  )
}

function HourOfDay({ data }: { data: StatsResult }) {
  const max = Math.max(1, ...data.hourOfDay)
  return (
    <Section title="Hour of day">
      <View
        style={{ flexDirection: 'row', height: 60, alignItems: 'flex-end' }}
      >
        {data.hourOfDay.map((c, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              marginHorizontal: 0.25,
              backgroundColor: 'rgba(168,85,247,0.7)',
              borderRadius: 1,
              height: `${Math.max(2, (c / max) * 100)}%` as ViewStyle['height'],
            }}
          />
        ))}
      </View>
    </Section>
  )
}

function DayOfWeek({ data }: { data: StatsResult }) {
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const max = Math.max(1, ...data.dayOfWeek)
  return (
    <Section title="Day of week">
      <View
        style={{ flexDirection: 'row', height: 60, alignItems: 'flex-end', gap: 4 }}
      >
        {data.dayOfWeek.map((c, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', height: '100%' }}>
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
                  backgroundColor: 'rgba(245,158,11,0.7)',
                  borderRadius: 1,
                  height: `${Math.max(2, (c / max) * 100)}%` as ViewStyle['height'],
                }}
              />
            </View>
            <Text style={{ fontSize: 9, color: '#4b5563', marginTop: 2 }}>
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
        <Text className="text-sm text-gray-500">No data yet.</Text>
      </Section>
    )
  }
  const max = data.topTasks[0].count
  return (
    <Section title="Most-completed tasks">
      <View style={{ gap: 8 }}>
        {data.topTasks.map((t) => (
          <View
            key={t.title}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
          >
            <Text style={{ fontSize: 16, width: 22 }}>{t.emoji}</Text>
            <Text
              numberOfLines={1}
              style={{ flex: 1, color: '#fff', fontSize: 13 }}
            >
              {t.title}
            </Text>
            <View
              style={{
                width: 80,
                height: 6,
                borderRadius: 3,
                backgroundColor: '#1f2937',
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${(t.count / max) * 100}%` as ViewStyle['width'],
                  backgroundColor: 'rgba(16,185,129,0.8)',
                }}
              />
            </View>
            <Text style={{ width: 24, textAlign: 'right', color: '#9ca3af', fontSize: 11 }}>
              {t.count}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  )
}

function EmojiBreakdown({ data }: { data: StatsResult }) {
  if (data.emojiFreq.length === 0) {
    return (
      <Section title="Emoji breakdown">
        <Text className="text-sm text-gray-500">No data yet.</Text>
      </Section>
    )
  }
  const total = data.emojiFreq.reduce((a, b) => a + b.count, 0)
  const top = data.emojiFreq.slice(0, 12)
  return (
    <Section title="Emoji breakdown">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {top.map((e) => (
          <View
            key={e.emoji}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderWidth: 1,
              borderColor: '#1f2937',
              borderRadius: 6,
              backgroundColor: '#0a0a0a',
            }}
          >
            <Text style={{ fontSize: 14 }}>{e.emoji}</Text>
            <Text style={{ color: '#9ca3af', fontSize: 11 }}>
              {e.count} · {Math.round((e.count / total) * 100)}%
            </Text>
          </View>
        ))}
      </View>
    </Section>
  )
}

function PillGrid({ data }: { data: StatsResult }) {
  return (
    <View style={{ gap: 8 }}>
      <PillRow
        items={[
          {
            label: 'On-time',
            value:
              data.onTimeRate === null
                ? '—'
                : `${Math.round(data.onTimeRate * 100)}%`,
          },
          {
            label: 'Avg latency',
            value:
              data.avgLatencyDays === null
                ? '—'
                : `${data.avgLatencyDays.toFixed(1)}d`,
          },
        ]}
      />
      <PillRow
        items={[
          { label: 'Snoozes all-time', value: String(data.snoozesAllTime) },
          { label: 'Snoozes wk', value: String(data.snoozesThisWeek) },
        ]}
      />
      <PillRow
        items={[
          { label: 'Abandoned', value: String(data.abandonedCount) },
          {
            label: 'Abandon rate',
            value:
              data.abandonmentRate === null
                ? '—'
                : `${Math.round(data.abandonmentRate * 100)}%`,
          },
        ]}
      />
    </View>
  )
}
