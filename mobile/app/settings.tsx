import { useClerk, useUser } from '@clerk/clerk-expo'
import { useSettings, useUpdateSettings } from '@dtn/shared/queries'
import { minutesOfDayToHHMM, type UserSettings } from '@dtn/shared/settings'
import { MINUTES_IN_DAY } from '@dtn/shared/time'
import * as Haptics from 'expo-haptics'
import { Stack } from 'expo-router'
import * as Updates from 'expo-updates'
import { Alert, Pressable, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { PageHeading } from '../components/PageHeading'

const OVERDUE = '#fb7185'

const StepButton = ({
  glyph,
  disabled,
  onPress,
}: {
  glyph: string
  disabled: boolean
  onPress: () => void
}) => (
  <Pressable
    onPress={() => {
      void Haptics.selectionAsync()
      onPress()
    }}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={glyph === '−' ? 'Decrease' : 'Increase'}
    hitSlop={8}
    style={({ pressed }) => ({
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: '#27272a',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
    })}
  >
    <Text style={{ color: '#fafafa', fontSize: 16 }}>{glyph}</Text>
  </Pressable>
)

const StepperRow = ({
  label,
  display,
  canDec,
  canInc,
  onDec,
  onInc,
}: {
  label: string
  display: string
  canDec: boolean
  canInc: boolean
  onDec: () => void
  onInc: () => void
}) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}
  >
    <Text
      style={{
        fontFamily: 'JetBrainsMono_400Regular',
        fontSize: 14,
        color: '#a1a1aa',
      }}
    >
      {label}
    </Text>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <StepButton glyph="−" disabled={!canDec} onPress={onDec} />
      <Text
        style={{
          fontFamily: 'JetBrainsMono_700Bold',
          fontSize: 15,
          color: '#fafafa',
          minWidth: 64,
          textAlign: 'center',
          fontVariant: ['tabular-nums'],
        }}
      >
        {display}
      </Text>
      <StepButton glyph="＋" disabled={!canInc} onPress={onInc} />
    </View>
  </View>
)

// Workday window + target horizon. Saves on every change — no ceremony.
function ProgressSettings() {
  const q = useSettings()
  const update = useUpdateSettings()
  if (!q.data) return null
  const s = q.data
  const save = (patch: Partial<UserSettings>) =>
    update.mutate({ ...s, ...patch })

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: '#27272a',
        borderRadius: 16,
        backgroundColor: 'rgba(24,24,27,0.6)',
        paddingHorizontal: 20,
        paddingVertical: 18,
        gap: 16,
      }}
    >
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 11,
          letterSpacing: 3,
          color: '#71717a',
          textTransform: 'uppercase',
        }}
      >
        Progress
      </Text>
      <StepperRow
        label="Workday starts"
        display={minutesOfDayToHHMM(s.workdayStartMin)}
        canDec={s.workdayStartMin >= 30}
        canInc={s.workdayStartMin + 30 <= s.workdayEndMin - 30}
        onDec={() => save({ workdayStartMin: s.workdayStartMin - 30 })}
        onInc={() => save({ workdayStartMin: s.workdayStartMin + 30 })}
      />
      <StepperRow
        label="Workday ends"
        display={minutesOfDayToHHMM(s.workdayEndMin)}
        canDec={s.workdayEndMin - 30 >= s.workdayStartMin + 30}
        canInc={s.workdayEndMin + 30 <= MINUTES_IN_DAY}
        onDec={() => save({ workdayEndMin: s.workdayEndMin - 30 })}
        onInc={() => save({ workdayEndMin: s.workdayEndMin + 30 })}
      />
      <StepperRow
        label="Target horizon"
        display={`${s.horizonDays}d`}
        canDec={s.horizonDays > 1}
        canInc={s.horizonDays < 60}
        onDec={() => save({ horizonDays: s.horizonDays - 1 })}
        onInc={() => save({ horizonDays: s.horizonDays + 1 })}
      />
      <Text
        style={{
          fontFamily: 'JetBrainsMono_400Regular',
          fontSize: 12,
          lineHeight: 18,
          color: '#71717a',
        }}
      >
        The daily target averages the next {s.horizonDays} days of due work;
        pacing spreads it across the workday.
      </Text>
    </View>
  )
}

export default function Settings() {
  const { signOut } = useClerk()
  const { user } = useUser()
  const email = user?.primaryEmailAddress?.emailAddress
  const initial =
    user?.firstName?.[0]?.toUpperCase() ?? email?.[0]?.toUpperCase() ?? '?'

  const onSignOut = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    Alert.alert('Sign out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => signOut(),
      },
    ])
  }

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: '#0a0a0a' }}
      edges={['top']}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Settings' }} />
      <PageHeading eyebrow="account">Settings</PageHeading>
      <View
        style={{
          flex: 1,
          paddingHorizontal: 20,
          paddingTop: 8,
          gap: 24,
        }}
      >
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              borderWidth: 1,
              borderColor: '#27272a',
              backgroundColor: 'rgba(24,24,27,0.6)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Text
              style={{
                fontFamily: 'JetBrainsMono_700Bold',
                fontSize: 30,
                color: '#fafafa',
              }}
            >
              {initial}
            </Text>
          </View>
          {user?.fullName && (
            <Text
              style={{
                fontFamily: 'JetBrainsMono_700Bold',
                fontSize: 16,
                color: '#fafafa',
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              {user.fullName}
            </Text>
          )}
          {email && (
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 13,
                color: '#71717a',
              }}
            >
              {email}
            </Text>
          )}
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 12,
              color: '#52525b',
              marginTop: 12,
            }}
          >
            {Updates.updateId
              ? `update ${Updates.updateId.slice(0, 8)} · ${
                  Updates.createdAt
                    ? new Date(Updates.createdAt).toLocaleString()
                    : ''
                }`
              : 'embedded bundle (no OTA applied)'}
          </Text>
        </View>

        <ProgressSettings />

        <Pressable
          onPress={onSignOut}
          accessibilityRole="button"
          accessibilityLabel="Sign out"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 14,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: 'rgba(251,113,133,0.3)',
            backgroundColor: pressed ? 'rgba(251,113,133,0.12)' : 'transparent',
          })}
        >
          <Text style={{ color: OVERDUE, fontSize: 16 }}>⏻</Text>
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 15,
              color: OVERDUE,
            }}
          >
            Sign out
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}
