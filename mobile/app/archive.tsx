import { useArchivedTasks, useUnarchiveTask } from '@dtn/shared/queries'
import { Stack } from 'expo-router'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'

export default function Archive() {
  const { data, isLoading } = useArchivedTasks()
  const unarchive = useUnarchiveTask()
  const tasks = data ?? []

  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <Stack.Screen options={{ title: 'Archive' }} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 8 }}>
        {isLoading ? (
          <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
        ) : tasks.length === 0 ? (
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 13,
              color: '#71717a',
              textAlign: 'center',
              marginTop: 24,
            }}
          >
            No archived tasks. Archive a task to hide it without deleting it.
          </Text>
        ) : (
          tasks.map((t) => (
            <View
              key={t.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderWidth: 1,
                borderColor: '#27272a',
                backgroundColor: 'rgba(24,24,27,0.6)',
                borderRadius: 16,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text style={{ fontSize: 22 }}>{t.emoji}</Text>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  fontFamily: 'JetBrainsMono_400Regular',
                  fontSize: 15,
                  color: '#d4d4d8',
                }}
              >
                {t.title}
              </Text>
              <Pressable
                onPress={() => unarchive.mutate(t.id)}
                accessibilityRole="button"
                accessibilityLabel={`Unarchive ${t.title}`}
                style={({ pressed }) => ({
                  borderWidth: 1,
                  borderColor: '#27272a',
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  backgroundColor: pressed
                    ? 'rgba(255,255,255,0.05)'
                    : 'transparent',
                })}
              >
                <Text
                  style={{
                    fontFamily: 'JetBrainsMono_400Regular',
                    fontSize: 12,
                    color: '#a1a1aa',
                  }}
                >
                  Unarchive
                </Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}
