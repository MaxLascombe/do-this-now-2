import { useUndo } from '@dtn/shared/undo'
import { Feather } from '@expo/vector-icons'
import { Accelerometer } from 'expo-sensors'
import * as Haptics from 'expo-haptics'
import { useEffect, useRef } from 'react'
import { Alert, Pressable } from 'react-native'

import { useToast } from './ToastProvider'

// Touch affordances for the global undo stack (follow-up to the batch):
// 1. A floating undo button, bottom-right above the tab bar, that exists
//    only while there is something to undo.
// 2. iOS-style shake-to-undo: a shake pops a native confirm naming the
//    action ("Undo 'Done X'?"), mirroring the system convention.

// Accelerometer readings are in g and include gravity (~1g at rest). A
// shake is two 2.3g spikes within 600ms; a cooldown swallows the tail of
// the same gesture and the time the confirm is up.
const SPIKE_G = 2.3
const DOUBLE_SPIKE_MS = 600
const COOLDOWN_MS = 1500
const SAMPLE_MS = 80

export function UndoAffordances() {
  const undoStack = useUndo()
  const toast = useToast()
  const lastSpike = useRef(0)
  const coolUntil = useRef(0)
  const dialogOpen = useRef(false)

  const runUndo = () =>
    void undoStack
      .undoLast()
      .then((entry) => entry && toast({ message: `Undone: ${entry.label}` }))
      .catch(() => toast({ message: 'Undo failed' }))

  useEffect(() => {
    Accelerometer.setUpdateInterval(SAMPLE_MS)
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const now = Date.now()
      if (dialogOpen.current || now < coolUntil.current) return
      const magnitude = Math.sqrt(x * x + y * y + z * z)
      if (magnitude < SPIKE_G) return
      if (now - lastSpike.current > DOUBLE_SPIKE_MS) {
        lastSpike.current = now
        return
      }
      lastSpike.current = 0
      coolUntil.current = now + COOLDOWN_MS
      const top = undoStack.peek()
      if (!top) return
      dialogOpen.current = true
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      Alert.alert('Undo?', top.label, [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            dialogOpen.current = false
          },
        },
        {
          text: 'Undo',
          onPress: () => {
            dialogOpen.current = false
            runUndo()
          },
        },
      ])
    })
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoStack])

  if (undoStack.size === 0) return null

  return (
    <Pressable
      onPress={runUndo}
      accessibilityRole="button"
      accessibilityLabel="Undo last action"
      style={({ pressed }) => ({
        position: 'absolute',
        right: 16,
        bottom: 108,
        width: 44,
        height: 44,
        borderRadius: 22,
        borderWidth: 1,
        borderColor: '#3f3f46',
        backgroundColor: 'rgba(9,9,11,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 30,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Feather name="rotate-ccw" size={18} color="#d4d4d8" />
    </Pressable>
  )
}
