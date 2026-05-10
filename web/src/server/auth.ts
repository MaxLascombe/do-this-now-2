import { auth } from '@clerk/tanstack-react-start/server'

export async function requireUserId(): Promise<string> {
  const { userId } = await auth()
  if (!userId) throw new Error('Not authenticated')
  return userId
}
