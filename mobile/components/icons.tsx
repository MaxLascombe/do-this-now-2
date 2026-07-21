import { Feather } from '@expo/vector-icons'
import { Text } from 'react-native'

// Feather via @expo/vector-icons (decision 2026-07-21): same design lineage
// as web's lucide (lucide forked Feather), font-based so it ships OTA, no
// native dependency. Wrappers keep the old hand-drawn components' names and
// prop shapes so call sites never changed.

export function PlayIcon({ color = '#0a0a0a', size = 16 }) {
  return <Feather name="play" size={size} color={color} />
}

export function PauseIcon({ color = '#0a0a0a', size = 16 }) {
  return <Feather name="pause" size={size} color={color} />
}

export function SlidersIcon({ color = '#d4d4d8', size = 16 }) {
  return <Feather name="sliders" size={size} color={color} />
}

export function ProfileIcon({ color = '#71717a', size = 20 }) {
  return <Feather name="user" size={size} color={color} />
}

export function PlusIcon({ color = '#0a0a0b', size = 20 }) {
  return <Feather name="plus" size={size} color={color} />
}

export function SearchIcon({ color = '#a1a1aa', size = 16 }) {
  return <Feather name="search" size={size} color={color} />
}

export function ReturnIcon({ color = '#a1a1aa', size = 16 }) {
  return <Feather name="corner-up-left" size={size} color={color} />
}

export function SunIcon({ color = '#a1a1aa', size = 16 }) {
  return <Feather name="sun" size={size} color={color} />
}

export function PencilIcon({ color = '#a1a1aa', size = 16 }) {
  return <Feather name="edit-2" size={size} color={color} />
}

export function TrashIcon({ color = '#fb7185', size = 16 }) {
  return <Feather name="trash-2" size={size} color={color} />
}

// Snooze stays type, not a drawing — shared look with web.
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
