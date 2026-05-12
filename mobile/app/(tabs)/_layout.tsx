import * as Haptics from 'expo-haptics'
import { Tabs, router } from 'expo-router'
import { Pressable, Text, View } from 'react-native'

const ACTIVE = '#fafafa'
const INACTIVE = '#52525b'

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
          marginTop: -10,
          shadowColor: '#fff',
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        }}
      >
        <Text
          style={{
            fontSize: 22,
            lineHeight: 24,
            color: '#0a0a0b',
            fontFamily: 'JetBrainsMono_700Bold',
          }}
        >
          +
        </Text>
      </View>
    </Pressable>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0a0a0b',
          borderTopColor: '#18181b',
          borderTopWidth: 1,
          height: 78,
          paddingTop: 6,
        },
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: {
          fontSize: 10,
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
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon glyph="⊙" color={color} />,
        }}
      />
    </Tabs>
  )
}
