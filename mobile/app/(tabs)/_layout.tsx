import * as Haptics from 'expo-haptics'
import { Tabs, router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PlusIcon } from '../../components/icons'
import { TopProgress } from '../../components/TopProgress'

const ACTIVE = '#fafafa'
// zinc-500, matching web's inactive tab color.
const INACTIVE = '#71717a'

function TabIcon({
  glyph,
  color,
  size = 18,
}: {
  glyph: string
  color: string
  size?: number
}) {
  return (
    <Text
      style={{
        fontSize: size,
        lineHeight: size + 2,
        color,
      }}
    >
      {glyph}
    </Text>
  )
}

function PlusButton({
  accessibilityState,
}: {
  accessibilityState?: { selected?: boolean }
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="New task"
      accessibilityState={accessibilityState}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        router.push('/new-task')
      }}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: '#fafafa',
          alignItems: 'center',
          justifyContent: 'center',
          shadowColor: '#fff',
          shadowOpacity: 0.18,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 6 },
        }}
      >
        <PlusIcon size={22} />
      </View>
    </Pressable>
  )
}

export default function TabsLayout() {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#0a0a0a' }}
      edges={['top']}
    >
      {/* Global chrome, like web's MobileTopBar: progress bar + return bar
          rendered once for every tab, not per-screen. */}
      <TopProgress />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: 'rgba(10,10,11,0.95)',
            borderTopColor: '#18181b',
            borderTopWidth: 1,
            height: 78,
            paddingTop: 6,
          },
          tabBarActiveTintColor: ACTIVE,
          tabBarInactiveTintColor: INACTIVE,
          tabBarLabelStyle: {
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase',
            fontFamily: 'JetBrainsMono_400Regular',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Now',
            tabBarIcon: ({ color }) => <TabIcon glyph="◉" color={color} />,
          }}
        />
        <Tabs.Screen
          name="tasks"
          options={{
            title: 'Tasks',
            tabBarIcon: ({ color }) => <TabIcon glyph="☰" color={color} />,
          }}
        />
        <Tabs.Screen
          name="new"
          options={{
            title: '',
            tabBarButton: (props) => <PlusButton {...props} />,
          }}
        />
        <Tabs.Screen
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color }) => <TabIcon glyph="◷" color={color} />,
          }}
        />
        <Tabs.Screen
          name="stats"
          options={{
            title: 'Stats',
            tabBarIcon: ({ color }) => <TabIcon glyph="▤" color={color} />,
          }}
        />
      </Tabs>
    </SafeAreaView>
  )
}
