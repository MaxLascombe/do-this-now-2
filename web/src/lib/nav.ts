export type NavId = 'home' | 'tasks' | 'new' | 'history' | 'stats'

// Maps the current pathname to the active nav item — shared by the desktop
// top bar and the mobile bottom nav so the two stay in sync.
export const activeNavFromPath = (pathname: string): NavId => {
  if (pathname === '/') return 'home'
  if (pathname.startsWith('/tasks')) return 'tasks'
  if (pathname.startsWith('/new-task')) return 'new'
  if (pathname.startsWith('/history')) return 'history'
  if (pathname.startsWith('/stats')) return 'stats'
  return 'home'
}
