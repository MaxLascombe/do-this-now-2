import { useEffect, useRef } from 'react'
import { Animated, Easing, View, type ViewStyle } from 'react-native'

// Port of web's shimmer skeletons: shaped placeholders that pulse, so the
// first paint mirrors the content's layout instead of a centered spinner.
export function Skeleton({ style }: { style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.5,
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
      style={[{ backgroundColor: '#18181b', borderRadius: 6, opacity }, style]}
    />
  )
}

// Mirrors the task rows (web's TaskListSkeleton / NowSkeleton row shape).
export function TaskRowSkeleton() {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#27272a',
        backgroundColor: 'rgba(24,24,27,0.6)',
        paddingHorizontal: 20,
        paddingVertical: 12,
      }}
    >
      <Skeleton style={{ height: 32, width: 32, borderRadius: 8 }} />
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <Skeleton style={{ height: 20, width: '40%' }} />
        <Skeleton style={{ height: 12, width: '25%' }} />
      </View>
      <Skeleton style={{ height: 28, width: 56, borderRadius: 999 }} />
      <Skeleton style={{ height: 28, width: 64, borderRadius: 999 }} />
    </View>
  )
}

export function TaskListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={{ gap: 8, paddingHorizontal: 20 }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <TaskRowSkeleton key={i} />
      ))}
    </View>
  )
}
