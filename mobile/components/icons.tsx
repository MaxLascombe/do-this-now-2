import { View } from 'react-native'

// Hand-drawn vector-ish icons (plain Views — no SVG dependency, which
// would need a native rebuild). Shapes match web's lucide icons closely
// enough to read as the same design language.

export function PlayIcon({ color = '#0a0a0a', size = 16 }) {
  return (
    <View
      style={{
        marginLeft: size * 0.15,
        width: 0,
        height: 0,
        borderTopWidth: size * 0.55,
        borderBottomWidth: size * 0.55,
        borderLeftWidth: size * 0.85,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: color,
      }}
    />
  )
}

export function PauseIcon({ color = '#0a0a0a', size = 16 }) {
  const bar = {
    width: size * 0.28,
    height: size,
    borderRadius: 1.5,
    backgroundColor: color,
  }
  return (
    <View style={{ flexDirection: 'row', gap: size * 0.22 }}>
      <View style={bar} />
      <View style={bar} />
    </View>
  )
}

// Web's SlidersHorizontal: three lines with staggered knobs.
export function SlidersIcon({ color = '#d4d4d8', size = 16 }) {
  const knob = (left: number) => ({
    position: 'absolute' as const,
    left,
    top: -2.5,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: color,
  })
  const line = {
    width: size,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: color,
  }
  return (
    <View style={{ gap: size * 0.28 }}>
      <View style={line}>
        <View style={knob(size * 0.55)} />
      </View>
      <View style={line}>
        <View style={knob(size * 0.1)} />
      </View>
      <View style={line}>
        <View style={knob(size * 0.4)} />
      </View>
    </View>
  )
}

// Web's CircleUserRound: outer circle, head dot, shoulder arc.
export function ProfileIcon({ color = '#71717a', size = 20 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: color,
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          marginTop: size * 0.18,
          width: size * 0.3,
          height: size * 0.3,
          borderRadius: size * 0.15,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          marginTop: size * 0.08,
          width: size * 0.62,
          height: size * 0.62,
          borderRadius: size * 0.31,
          backgroundColor: color,
        }}
      />
    </View>
  )
}

export function PlusIcon({ color = '#0a0a0b', size = 20 }) {
  const thickness = Math.max(2, size * 0.11)
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          position: 'absolute',
          width: size,
          height: thickness,
          borderRadius: thickness / 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: thickness,
          height: size,
          borderRadius: thickness / 2,
          backgroundColor: color,
        }}
      />
    </View>
  )
}
