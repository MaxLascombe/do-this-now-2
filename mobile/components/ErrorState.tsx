import { Pressable, Text, View } from 'react-native'

export function ErrorState({
  message = "Couldn't load.",
  onRetry,
}: {
  message?: string
  onRetry?: () => void
}) {
  return (
    <View
      accessibilityRole="alert"
      style={{ alignItems: 'center', gap: 12, padding: 24 }}
    >
      <Text
        style={{
          color: '#a1a1aa',
          fontSize: 14,
          fontFamily: 'JetBrainsMono_400Regular',
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          style={{
            borderWidth: 1,
            borderColor: '#27272a',
            borderRadius: 999,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <Text
            style={{
              color: '#d4d4d8',
              fontSize: 13,
              fontFamily: 'JetBrainsMono_400Regular',
            }}
          >
            Retry
          </Text>
        </Pressable>
      )}
    </View>
  )
}
