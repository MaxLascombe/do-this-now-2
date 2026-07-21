import { useUndo } from '@dtn/shared/undo'
import { Accelerometer } from 'expo-sensors'
import * as Haptics from 'expo-haptics'
import { useEffect, useRef } from 'react'
import { Alert } from 'react-native'

import { useToast } from './ToastProvider'

// iOS-style shake-to-undo (the app's only undo affordance beyond the
// per-action toasts — a floating button was tried and cut): a shake pops a
// native confirm naming the action ("Undo 'Done X'?"), mirroring the
// system convention.

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

  return null
}
