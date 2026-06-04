import { useEffect, useState } from 'react'

export const useDate = () => {
  const [date, setDate] = useState<Date>(new Date())
  useEffect(() => {
    const tick = () => setDate(new Date())
    // Consumers show minute-granularity time; tick on the minute, not every second.
    let interval: ReturnType<typeof setInterval>
    const timeout = setTimeout(
      () => {
        tick()
        interval = setInterval(tick, 60_000)
      },
      60_000 - (Date.now() % 60_000),
    )
    return () => {
      clearTimeout(timeout)
      clearInterval(interval)
    }
  }, [])
  return date
}
