import { isDayWon, streakMilestone } from '@dtn/shared/progress-display'
import { useProgressToday } from '@dtn/shared/queries'
import { dateString } from '@dtn/shared/helpers'
import { useEffect, useRef, useState } from 'react'

const CELEBRATED_KEY = 'dtn-win-celebrated'
const CONFETTI_MS = 2200
const BANNER_MS = 4000

const COLORS = ['#34d399', '#38bdf8', '#f59e0b', '#fafafa']

// The Win Moment: the instant done + Lives crosses the Daily Target, once per
// day — confetti burst + top glow (full celebration per the 2026-07-21 plan),
// with a banner stacked on streak milestone days. Reduced-motion users get the
// restrained surge (glow only). Mounted once in __root.
export function WinCelebration() {
  const q = useProgressToday()
  const [celebrating, setCelebrating] = useState(false)
  const [banner, setBanner] = useState<number | null>(null)

  const won = !!q.data && isDayWon(q.data)
  const streak = q.data?.streak ?? 0

  useEffect(() => {
    if (!won) return
    const dayKey = dateString(new Date())
    if (localStorage.getItem(CELEBRATED_KEY) === dayKey) return
    localStorage.setItem(CELEBRATED_KEY, dayKey)
    setCelebrating(true)
    const ms = streakMilestone(streak)
    if (ms) setBanner(ms)
    const t1 = setTimeout(() => setCelebrating(false), CONFETTI_MS)
    const t2 = setTimeout(() => setBanner(null), BANNER_MS)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [won, streak])

  if (!celebrating && banner === null) return null

  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches

  return (
    <>
      {celebrating && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 top-0 z-40 h-2"
            style={{
              background:
                'linear-gradient(to bottom, rgba(52,211,153,0.9), transparent)',
              animation: reducedMotion ? undefined : 'dtn-win-glow 2.2s ease-out',
            }}
          />
          {!reducedMotion && <ConfettiBurst />}
          <style>{`@keyframes dtn-win-glow {
            0% { opacity: 0; } 15% { opacity: 1; } 100% { opacity: 0; }
          }`}</style>
          <div role="status" className="sr-only">
            Day won — target reached
          </div>
        </>
      )}
      {banner !== null && (
        <div className="pointer-events-none fixed top-16 left-1/2 z-40 -translate-x-1/2 rounded-full border border-amber-500/40 bg-zinc-950/95 px-5 py-2.5 font-mono text-sm text-amber-400 shadow-2xl shadow-black/50 backdrop-blur">
          ▲ {banner}-day streak
        </div>
      )}
    </>
  )
}

// Hand-rolled canvas burst — ~90 particles falling from the top edge (where
// the progress bar lives). No dependency; unmounts with the celebration.
function ConfettiBurst() {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    ctx.scale(dpr, dpr)

    const parts = Array.from({ length: 90 }, () => ({
      x: Math.random() * window.innerWidth,
      y: -10 - Math.random() * 40,
      vx: (Math.random() - 0.5) * 2.4,
      vy: 1.5 + Math.random() * 3,
      size: 4 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
    }))

    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = now - start
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
      const fade = Math.max(0, 1 - t / CONFETTI_MS)
      for (const p of parts) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.05
        p.rot += p.vr
        ctx.save()
        ctx.globalAlpha = fade
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }
      if (t < CONFETTI_MS) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40"
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}
