// Intentionally platform-specific: this is the mobile (react-native Switch)
// variant. Web's counterpart wraps Headless UI — different render targets,
// can't be shared.
import { Switch as RNSwitch } from 'react-native'

export function Switch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <RNSwitch
      value={checked}
      onValueChange={onChange}
      trackColor={{ false: '#1f2937', true: '#374151' }}
      thumbColor="#fff"
      ios_backgroundColor="#000"
    />
  )
}
