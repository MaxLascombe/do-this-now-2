import { Pressable, Text, View } from 'react-native'

export function EmptyTasks({
  title,
  subtitle,
  onNewTask,
}: {
  title: string
  subtitle: string
  onNewTask: () => void
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        gap: 20,
      }}
    >
      <Text style={{ fontSize: 44 }} accessibilityElementsHidden>
        ✺
      </Text>
      <View style={{ gap: 6, alignItems: 'center' }}>
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 17,
            color: '#e4e4e7',
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 13,
            color: '#71717a',
            textAlign: 'center',
          }}
        >
          {subtitle}
        </Text>
      </View>
      <Pressable
        onPress={onNewTask}
        accessibilityRole="button"
        style={{
          backgroundColor: '#fafafa',
          paddingHorizontal: 18,
          paddingVertical: 11,
          borderRadius: 999,
        }}
      >
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 14,
            color: '#0a0a0a',
          }}
        >
          New task
        </Text>
      </Pressable>
    </View>
  )
}
