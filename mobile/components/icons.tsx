import { Text, View } from 'react-native'

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

export function SearchIcon({ color = '#a1a1aa', size = 16 }) {
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: size * 0.72,
          height: size * 0.72,
          borderRadius: size * 0.36,
          borderWidth: size * 0.11,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: size * 0.03,
          right: size * 0.03,
          width: size * 0.4,
          height: size * 0.11,
          borderRadius: size * 0.06,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  )
}

export function ReturnIcon({ color = '#a1a1aa', size = 16 }) {
  const t = Math.max(1.5, size * 0.1)
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: size * 0.08,
          top: size * 0.5 - t / 2,
          height: t,
          borderRadius: t,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: size * 0.31,
          width: size * 0.42,
          height: t,
          borderRadius: t,
          backgroundColor: color,
          transform: [{ rotate: '-45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: size * 0.69 - t,
          width: size * 0.42,
          height: t,
          borderRadius: t,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  )
}

export function SunIcon({ color = '#a1a1aa', size = 16 }) {
  const t = Math.max(1.5, size * 0.1)
  const ray = size * 0.22
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
          width: size * 0.42,
          height: size * 0.42,
          borderRadius: size,
          borderWidth: t,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: size / 2 - t / 2,
          width: t,
          height: ray,
          borderRadius: t,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: size / 2 - t / 2,
          width: t,
          height: ray,
          borderRadius: t,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: size / 2 - t / 2,
          width: ray,
          height: t,
          borderRadius: t,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: size / 2 - t / 2,
          width: ray,
          height: t,
          borderRadius: t,
          backgroundColor: color,
        }}
      />
    </View>
  )
}

export function PencilIcon({ color = '#a1a1aa', size = 16 }) {
  const w = size * 0.18
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={{
          position: 'absolute',
          left: size * 0.41,
          top: -size * 0.02,
          width: w,
          height: size * 0.82,
          borderRadius: w / 2,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.06,
          bottom: size * 0.04,
          width: w * 0.85,
          height: w * 0.85,
          borderRadius: 1,
          backgroundColor: color,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  )
}

export function TrashIcon({ color = '#fb7185', size = 16 }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center' }}>
      <View
        style={{
          width: size * 0.34,
          height: size * 0.12,
          borderTopLeftRadius: 2,
          borderTopRightRadius: 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          marginTop: size * 0.02,
          width: size * 0.8,
          height: size * 0.1,
          borderRadius: 2,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          marginTop: size * 0.06,
          width: size * 0.58,
          height: size * 0.56,
          borderBottomLeftRadius: 3,
          borderBottomRightRadius: 3,
          borderWidth: 1.5,
          borderColor: color,
        }}
      />
    </View>
  )
}

// Snooze reads best as type, not a drawing — matches web's Zz glyph.
export function ZzIcon({ color = '#a1a1aa', size = 16 }) {
  return (
    <Text
      style={{
        fontFamily: 'JetBrainsMono_700Bold',
        fontSize: size * 0.82,
        lineHeight: size,
        color,
      }}
    >
      Zz
    </Text>
  )
}
