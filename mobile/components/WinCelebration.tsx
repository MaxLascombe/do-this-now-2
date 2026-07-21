import AsyncStorage from '@react-native-async-storage/async-storage'
import { dateString } from '@dtn/shared/helpers'
import { isDayWon, streakMilestone } from '@dtn/shared/progress-display'
import { useProgressToday } from '@dtn/shared/queries'
import * as Haptics from 'expo-haptics'
import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Text, View } from 'react-native'

const CELEBRATED_KEY = 'dtn-win-celebrated'
const CONFETTI_MS = 2000
const BANNER_MS = 4000
const COLORS = ['#34d399', '#38bdf8', '#f59e0b', '#fafafa']
const PARTICLES = 26

// Synchronous latch so two mounted instances (one per tab screen) can't both
// fire before the AsyncStorage write lands.
let firedForDay: string | null = null

// The Win Moment, mobile: haptic pattern + particle burst over the progress
// strip + milestone banner, once per day. Reduced-motion devices keep the
// haptic and glow but skip the particles. Rendered inside TopProgress.
export function WinCelebration() {
  const { data } = useProgressToday()
  const [celebrating, setCelebrating] = useState(false)
  const [banner, setBanner] = useState<number | null>(null)
  const [reduceMotion, setReduceMotion] = useState(false)

  const won = !!data && isDayWon(data)
  const streak = data?.streak ?? 0

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
  }, [])

  useEffect(() => {
    if (!won) return
    const dayKey = dateString(new Date())
    if (firedForDay === dayKey) return
    firedForDay = dayKey
    void (async () => {
      if ((await AsyncStorage.getItem(CELEBRATED_KEY)) === dayKey) return
      await AsyncStorage.setItem(CELEBRATED_KEY, dayKey)
      setCelebrating(true)
      const ms = streakMilestone(streak)
      if (ms) setBanner(ms)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setTimeout(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
      }, 180)
      setTimeout(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      }, 360)
      setTimeout(() => setCelebrating(false), CONFETTI_MS)
      setTimeout(() => setBanner(null), BANNER_MS)
    })()
  }, [won, streak])

  if (!celebrating && banner === null) return null

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 260,
        zIndex: 40,
      }}
    >
      {celebrating && <Glow />}
      {celebrating && !reduceMotion && <Burst />}
      {banner !== null && (
        <View
          style={{
            alignSelf: 'center',
            marginTop: 64,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(245,158,11,0.4)',
            backgroundColor: 'rgba(9,9,11,0.95)',
            paddingHorizontal: 18,
            paddingVertical: 9,
          }}
        >
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 13,
              color: '#f59e0b',
            }}
          >
            ▲ {banner}-day streak
          </Text>
        </View>
      )}
    </View>
  )
}

function Glow() {
  const opacity = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: CONFETTI_MS - 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start()
  }, [opacity])
  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 6,
        opacity,
        backgroundColor: 'rgba(52,211,153,0.85)',
      }}
    />
  )
}

function Burst() {
  const particles = useRef(
    Array.from({ length: PARTICLES }, (_, i) => ({
      x: (i / PARTICLES) * 100 + Math.random() * 4,
      drift: (Math.random() - 0.5) * 60,
      fall: 160 + Math.random() * 90,
      size: 5 + Math.random() * 4,
      color: COLORS[i % COLORS.length],
      spin: (Math.random() - 0.5) * 4,
      anim: new Animated.Value(0),
    })),
  ).current

  useEffect(() => {
    Animated.stagger(
      12,
      particles.map((p) =>
        Animated.timing(p.anim, {
          toValue: 1,
          duration: CONFETTI_MS - 300,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    ).start()
  }, [particles])

  return (
    <>
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.x}%`,
            width: p.size,
            height: p.size * 0.6,
            backgroundColor: p.color,
            opacity: p.anim.interpolate({
              inputRange: [0, 0.7, 1],
              outputRange: [1, 1, 0],
            }),
            transform: [
              {
                translateY: p.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, p.fall],
                }),
              },
              {
                translateX: p.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, p.drift],
                }),
              },
              {
                rotate: p.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0rad', `${p.spin}rad`],
                }),
              },
            ],
          }}
        />
      ))}
    </>
  )
}
