import { newSafeDate } from '@dtn/shared/helpers'
import { useAllTasks } from '@dtn/shared/queries'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native'

const mono = 'JetBrainsMono_400Regular'

export default function Tags() {
  const router = useRouter()
  const { tag: initialTag } = useLocalSearchParams<{ tag?: string }>()
  const { data, isLoading, isFetching, refetch } = useAllTasks()
  const [selected, setSelected] = useState<string | null>(initialTag ?? null)

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of data ?? [])
      for (const tag of t.tags) m.set(tag, (m.get(tag) ?? 0) + 1)
    return [...m.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )
  }, [data])

  // Fall back to the most-used tag if the selected one no longer exists
  // (a stale deep-link, or its tasks were all deleted/retagged).
  const activeTag =
    selected !== null && tagCounts.some(([t]) => t === selected)
      ? selected
      : (tagCounts[0]?.[0] ?? null)

  const tagged = useMemo(
    () =>
      (data ?? [])
        .filter((t) => activeTag !== null && t.tags.includes(activeTag))
        .sort(
          (a, b) => newSafeDate(a.due).getTime() - newSafeDate(b.due).getTime(),
        ),
    [data, activeTag],
  )

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0b' }}>
      <Stack.Screen options={{ title: 'Tags' }} />
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => refetch()}
            tintColor="#fafafa"
            colors={['#fafafa']}
          />
        }
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 32 }} />
        ) : tagCounts.length === 0 ? (
          <Text
            style={{
              fontFamily: mono,
              fontSize: 13,
              color: '#52525b',
              textAlign: 'center',
              marginTop: 32,
            }}
          >
            No tags yet. Add tags to tasks to organize and browse them here.
          </Text>
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 20,
              }}
            >
              {tagCounts.map(([tag, count]) => {
                const isActive = tag === activeTag
                return (
                  <Pressable
                    key={tag}
                    onPress={() => setSelected(tag)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      borderRadius: 999,
                      borderWidth: 1,
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderColor: isActive ? '#fafafa' : '#27272a',
                      backgroundColor: isActive ? '#fafafa' : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: mono,
                        fontSize: 13,
                        color: isActive ? '#0a0a0b' : '#a1a1aa',
                      }}
                    >
                      #{tag}
                    </Text>
                    <Text
                      style={{
                        fontFamily: mono,
                        fontSize: 13,
                        color: '#52525b',
                      }}
                    >
                      {count}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            {activeTag !== null && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    fontFamily: mono,
                    fontSize: 11,
                    letterSpacing: 3,
                    textTransform: 'uppercase',
                    color: '#71717a',
                  }}
                >
                  #{activeTag}
                </Text>
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/new-task',
                      params: { tag: activeTag },
                    })
                  }
                  accessibilityRole="button"
                  style={{
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: '#27272a',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                  }}
                >
                  <Text
                    style={{ fontFamily: mono, fontSize: 12, color: '#a1a1aa' }}
                  >
                    + New task
                  </Text>
                </Pressable>
              </View>
            )}

            <View style={{ gap: 8 }}>
              {tagged.map((t) => (
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
                    style={{
                      flex: 1,
                      fontFamily: mono,
                      fontSize: 14,
                      color: '#fafafa',
                    }}
                  >
                    {t.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}
