import { Audio } from 'expo-av'
import { useEffect, useRef } from 'react'

let sound: Audio.Sound | null = null

async function ensureSound() {
  if (sound) return sound
  const created = new Audio.Sound()
  await created.loadAsync(require('../assets/ding.mp3'))
  sound = created
  return sound
}

export function useDing() {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    void ensureSound()
  }, [])

  return async () => {
    try {
      const s = await ensureSound()
      await s.replayAsync()
    } catch (e) {
      console.warn('ding failed', e)
    }
  }
}
