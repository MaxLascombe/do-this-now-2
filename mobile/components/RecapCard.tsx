import AsyncStorage from '@react-native-async-storage/async-storage'
import { dateString, newSafeDate } from '@dtn/shared/helpers'
import { describeRecapDay } from '@dtn/shared/progress-display'
import { useProgressRecap } from '@dtn/shared/queries'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

const SEEN_KEY = 'dtn-recap-seen'
const MAX_LINES = 5

const WON = '#34d399'
const LOST = '#fb7185'

// The Day Recap, mobile — mirrors web/src/components/RecapCard.tsx: what
// settlement decided while away, equal weight for wins and honest-red
// losses, dismissed per day, first-ever run baselines silently.
export function RecapCard() {
  const q = useProgressRecap()
  // null = still reading storage; '' = nothing stored yet.
  const [seen, setSeen] = useState<string | null>(null)

  useEffect(() => {
    void AsyncStorage.getItem(SEEN_KEY).then((v) => setSeen(v ?? ''))
  }, [])

  const days = q.data ?? []
  const newest = days[0]?.date ?? null

  useEffect(() => {
    if (newest && seen === '') {
      void AsyncStorage.setItem(SEEN_KEY, newest)
      setSeen(newest)
    }
  }, [newest, seen])

  if (!newest || seen === null || seen === '') return null
  const seenMs = newSafeDate(seen).getTime()
  const unseen = days.filter((d) => newSafeDate(d.date).getTime() > seenMs)
  if (unseen.length === 0) return null

  const dismiss = () => {
    void AsyncStorage.setItem(SEEN_KEY, newest)
    setSeen(newest)
  }

  const now = new Date()
  const yesterdayKey = dateString(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
  )
  const title = (date: string) =>
    date === yesterdayKey
      ? 'Yesterday'
      : newSafeDate(date).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        })

  return (
    <View
      style={{
        marginBottom: 20,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#27272a',
        backgroundColor: 'rgba(24,24,27,0.6)',
        paddingHorizontal: 18,
        paddingVertical: 14,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
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
          While you were away
        </Text>
        <Pressable
          onPress={dismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss recap"
        >
          <Text style={{ color: '#71717a', fontSize: 15 }}>✕</Text>
        </Pressable>
      </View>
      <View style={{ marginTop: 12, gap: 8 }}>
        {unseen.slice(0, MAX_LINES).map((d) => {
          const { headline, detail } = describeRecapDay(d)
          return (
            <View
              key={d.date}
              style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10 }}
            >
              <Text
                style={{
                  fontFamily: 'JetBrainsMono_400Regular',
                  fontSize: 12,
                  color: '#71717a',
                  width: 84,
                }}
              >
                {title(d.date)}
              </Text>
              <Text
                style={{
                  fontFamily: 'JetBrainsMono_700Bold',
                  fontSize: 13,
                  color: d.won ? WON : LOST,
                }}
              >
                {headline}
              </Text>
              <Text
                style={{
                  flex: 1,
                  fontFamily: 'JetBrainsMono_400Regular',
                  fontSize: 12,
                  color: d.won ? '#d4d4d8' : 'rgba(254,205,211,0.8)',
                }}
              >
                {detail}
              </Text>
            </View>
          )
        })}
        {unseen.length > MAX_LINES && (
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 11,
              color: '#71717a',
            }}
          >
            +{unseen.length - MAX_LINES} more day
            {unseen.length - MAX_LINES === 1 ? '' : 's'}
          </Text>
        )}
      </View>
    </View>
  )
}
