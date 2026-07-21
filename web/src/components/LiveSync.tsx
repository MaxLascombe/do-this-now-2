import {
  progressTodayKey,
  selectionKey,
  taskKeys,
} from '@dtn/shared/queries'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

// Client half of live sync: subscribes to /api/events and invalidates the
// data caches whenever another device changes something, so a phone
// completion moves this bar within ~a second. EventSource reconnects on
// drop by itself; the regular polling cadence stays as the fallback.
export function LiveSync() {
  const qc = useQueryClient()

  useEffect(() => {
    const es = new EventSource('/api/events')
    es.onmessage = () => {
      void qc.invalidateQueries({ queryKey: taskKeys.all })
      void qc.invalidateQueries({ queryKey: progressTodayKey })
      void qc.invalidateQueries({ queryKey: selectionKey })
    }
    return () => es.close()
  }, [qc])

  return null
}
