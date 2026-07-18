import { Pressable, Text, View } from 'react-native'

export function EmptyTasks({
  title,
  subtitle,
  onNewTask,
  onViewAll,
}: {
  title: string
  subtitle: string
  onNewTask: () => void
  onViewAll?: () => void
}) {
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        gap: 24,
      }}
    >
      <Text style={{ fontSize: 48 }} accessibilityElementsHidden>
        ✺
      </Text>
      <View style={{ gap: 6, alignItems: 'center' }}>
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 18,
            color: '#e4e4e7',
            textAlign: 'center',
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 15,
            color: '#71717a',
            textAlign: 'center',
          }}
        >
          {subtitle}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
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
              fontFamily: 'JetBrainsMono_600SemiBold',
              fontSize: 15,
              color: '#18181b',
            }}
          >
            New task
          </Text>
        </Pressable>
        {onViewAll && (
          <Pressable
            onPress={onViewAll}
            accessibilityRole="button"
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: pressed ? '#52525b' : '#27272a',
              paddingHorizontal: 18,
              paddingVertical: 11,
              borderRadius: 999,
            })}
          >
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 15,
                color: '#a1a1aa',
              }}
            >
              View all tasks
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}
