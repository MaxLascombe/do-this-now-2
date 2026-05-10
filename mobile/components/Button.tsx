import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  type TouchableOpacityProps,
} from 'react-native'

type Props = {
  icon: typeof faSpinner
  text?: string
  loading?: boolean
} & Omit<TouchableOpacityProps, 'children'>

export function Button({
  icon,
  text,
  loading = false,
  className,
  ...props
}: Props) {
  return (
    <TouchableOpacity
      {...props}
      className={
        'm-1 flex-row items-center gap-2 rounded-full border border-gray-700 bg-black px-3 py-2 active:bg-gray-900 disabled:opacity-50 ' +
        (className ?? '')
      }
    >
      {!!text && <Text className="text-sm font-bold text-white">{text}</Text>}
      {(!text || !loading) && (
        <FontAwesomeIcon icon={icon} size={14} color="#fff" />
      )}
      {loading && <ActivityIndicator size="small" color="#fff" />}
    </TouchableOpacity>
  )
}
