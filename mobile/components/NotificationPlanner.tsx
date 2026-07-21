import {
  useAllTasks,
  useProgressToday,
  useSettings,
} from '@dtn/shared/queries'
import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'

import { loadToggles, replanNotifications } from '../lib/notifications'

// Invisible worker: re-plans every scheduled local notification whenever the
// synced data changes or the app returns to the foreground, so the phone's
// pending notifications always reflect the freshest state it has. Renders
// nothing; mounted once inside the providers.
export function NotificationPlanner() {
  const tasks = useAllTasks()
  const progress = useProgressToday()
  const settings = useSettings()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const replan = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void loadToggles().then((toggles) =>
        replanNotifications({
          tasks: tasks.data ?? [],
          progress: progress.data,
          settings: settings.data,
          toggles,
        }).catch((err) => console.warn('notification replan failed', err)),
      )
    }, 1500)
  }

  // Data-driven replans, debounced — mutations invalidate these queries, so
  // every completion/snooze/edit reflows the schedule shortly after.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(replan, [tasks.data, progress.data, settings.data])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') replan()
    })
    return () => sub.remove()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
