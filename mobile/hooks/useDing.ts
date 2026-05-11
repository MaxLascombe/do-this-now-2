import { createAudioPlayer, type AudioPlayer } from 'expo-audio'
import { useEffect, useRef } from 'react'

// One module-level player shared across the app — the ding is identical
// every time so we don't need per-component state. expo-av's Audio.Sound
// (deprecated in SDK 54) used the same pattern.
let player: AudioPlayer | null = null

function ensurePlayer(): AudioPlayer {
  if (player) return player
  player = createAudioPlayer(require('../assets/ding.mp3'))
  return player
}

export function useDing() {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    ensurePlayer()
  }, [])

  return async () => {
    try {
      const p = ensurePlayer()
      p.seekTo(0)
      p.play()
    } catch (e) {
      console.warn('ding failed', e)
    }
  }
}
