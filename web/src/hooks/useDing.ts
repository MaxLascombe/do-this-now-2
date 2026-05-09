import { useEffect, useRef } from 'react'

const DING_URL = '/sounds/ding.mp3'

// Singleton audio element so playback isn't disrupted by remounts.
// Created lazily on the client only.
let dingAudio: HTMLAudioElement | null = null
let unlocked = false

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!dingAudio) {
    dingAudio = new Audio(DING_URL)
    dingAudio.preload = 'auto'
  }
  return dingAudio
}

// Old version's ding never played in production because:
//   1. browsers block audio without a prior user gesture, and
//   2. each call constructed a new AudioContext that was suspended.
// Fix: a single Audio element + a one-time silent play() on the first user
// gesture to "unlock" autoplay for subsequent programmatic calls.
function unlockOnFirstGesture() {
  if (typeof window === 'undefined' || unlocked) return
  const handler = () => {
    const a = getAudio()
    if (!a) return
    const prevVolume = a.volume
    a.volume = 0
    void a.play().then(
      () => {
        a.pause()
        a.currentTime = 0
        a.volume = prevVolume
        unlocked = true
      },
      () => {
        // Even if play() rejects, we tried; remove listener so we don't loop.
      },
    )
    window.removeEventListener('pointerdown', handler)
    window.removeEventListener('keydown', handler)
  }
  window.addEventListener('pointerdown', handler, { once: false })
  window.addEventListener('keydown', handler, { once: false })
}

export default function useDing() {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true
    unlockOnFirstGesture()
  }, [])

  return () => {
    const a = getAudio()
    if (!a) return
    try {
      a.currentTime = 0
      void a.play()
    } catch {
      // ignored — likely a no-gesture autoplay rejection
    }
  }
}
