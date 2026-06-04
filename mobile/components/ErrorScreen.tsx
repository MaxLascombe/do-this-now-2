import type { ErrorBoundaryProps } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export function ErrorScreen({ retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          paddingHorizontal: 32,
        }}
      >
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 11,
            letterSpacing: 4,
            color: '#71717a',
            textTransform: 'uppercase',
          }}
        >
          Something broke
        </Text>
        <Text
          style={{
            fontFamily: 'InstrumentSerif_400Regular_Italic',
            fontSize: 40,
            color: '#fafafa',
            textAlign: 'center',
          }}
        >
          That didn’t go to plan.
        </Text>
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 13,
            color: '#71717a',
            textAlign: 'center',
          }}
        >
          An unexpected error interrupted the screen.
        </Text>
        <Pressable
          onPress={() => void retry()}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={({ pressed }) => ({
            marginTop: 8,
            paddingVertical: 12,
            paddingHorizontal: 24,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: '#27272a',
            backgroundColor: pressed ? 'rgba(255,255,255,0.05)' : 'transparent',
          })}
        >
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 14,
              color: '#d4d4d8',
            }}
          >
            Try again
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
