import { useEffect, useState } from 'react'

export function useDate() {
  const [date, setDate] = useState<Date>(new Date())
  useEffect(() => {
    const t = setInterval(() => setDate(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return date
}
