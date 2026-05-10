import {
  faClockRotateLeft,
  faHouse,
  faListCheck,
  faPlus,
  faUser,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import * as Haptics from 'expo-haptics'
import { Tabs, router } from 'expo-router'
import { Pressable, View } from 'react-native'

const ACTIVE = '#fff'
const INACTIVE = '#6b7280'

function TabIcon({
  icon,
  color,
}: {
  icon: typeof faHouse
  color: string
}) {
  return <FontAwesomeIcon icon={icon} size={20} color={color} />
}

// Center "+" tab — taller white pill, intercepts press to open the
// /new-task modal instead of switching tabs.
function PlusButton({ accessibilityState }: { accessibilityState?: { selected?: boolean } }) {
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
          backgroundColor: '#fff',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: -8,
          shadowColor: '#000',
          shadowOpacity: 0.4,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <FontAwesomeIcon icon={faPlus} size={20} color="#000" />
      </View>
    </Pressable>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#000' },
        headerTintColor: '#fff',
        headerTitleStyle: { color: '#fff' },
        tabBarStyle: {
          backgroundColor: '#000',
          borderTopColor: '#1f2937',
        },
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabIcon icon={faHouse} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color }) => (
            <TabIcon icon={faListCheck} color={color} />
          ),
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
          tabBarIcon: ({ color }) => (
            <TabIcon icon={faClockRotateLeft} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <TabIcon icon={faUser} color={color} />,
        }}
      />
    </Tabs>
  )
}
