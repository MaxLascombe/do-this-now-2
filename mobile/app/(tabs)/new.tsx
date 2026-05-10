// Placeholder for the center "+" tab. Pressing it is intercepted by the
// custom tabBarButton in (tabs)/_layout.tsx, which opens /new-task as a
// modal — so this screen never renders. We just need a route file to
// exist so expo-router has something to register.
import { Redirect } from 'expo-router'

export default function NewTabPlaceholder() {
  return <Redirect href="/new-task" />
}
