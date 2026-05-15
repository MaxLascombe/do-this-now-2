import { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'

// 6×6 dot that breathes opacity 0.4 ↔ 1.0 every 1.4s. Mirrors the
// `pulse 1.4s ease-in-out infinite` keyframes used on the web side so
// the running-timer signal looks the same across platforms.
export function PulseDot({
  color,
  size = 6,
}: {
  color: string
  size?: number
}) {
  const opacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [opacity])

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
      }}
    />
  )
}
