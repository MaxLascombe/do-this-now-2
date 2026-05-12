import { type ReactNode } from 'react'
import { Text, View } from 'react-native'

export function PageHeading({
  eyebrow,
  children,
  size = 32,
  trailing,
}: {
  eyebrow?: ReactNode
  children: ReactNode
  size?: number
  trailing?: ReactNode
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 16,
      }}
    >
      <View style={{ flex: 1 }}>
        {eyebrow && (
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 10,
              letterSpacing: 3,
              color: '#71717a',
              textTransform: 'uppercase',
            }}
          >
            {eyebrow}
          </Text>
        )}
        <Text
          style={{
            fontFamily: 'JetBrainsMono_700Bold',
            fontSize: size,
            color: '#fafafa',
            marginTop: 4,
            letterSpacing: -0.6,
            lineHeight: size,
          }}
        >
          {children}
        </Text>
      </View>
      {trailing}
    </View>
  )
}
