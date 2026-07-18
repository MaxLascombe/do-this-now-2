import { formatTimerSeconds } from '@dtn/shared/timer-utils'
import { Alert, Modal, Pressable, Text, View } from 'react-native'

const ADJUST_AMOUNTS = [-15, -5, -1, 1, 5, 15] as const

export function TimerAdjustModal({
  open,
  seconds,
  disabled,
  onAdd,
  onClear,
  onClose,
}: {
  open: boolean
  seconds: number
  disabled: boolean
  onAdd: (minutes: number) => void
  onClear: () => void
  onClose: () => void
}) {
  const confirmClear = () => {
    if (seconds === 0) return
    Alert.alert('Clear timer', 'Clear timer to 0?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: onClear },
    ])
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.7)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            width: '100%',
            maxWidth: 380,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#27272a',
            backgroundColor: '#09090b',
            padding: 24,
          }}
        >
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={{ position: 'absolute', top: 10, right: 12, padding: 4 }}
          >
            <Text style={{ color: '#71717a', fontSize: 14 }}>✕</Text>
          </Pressable>
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              color: '#71717a',
              fontSize: 10,
              letterSpacing: 3,
              textTransform: 'uppercase',
            }}
          >
            Adjust timer
          </Text>
          <Text
            style={{
              fontFamily: 'JetBrainsMono_700Bold',
              color: '#fafafa',
              fontSize: 32,
              textAlign: 'center',
              marginTop: 14,
              lineHeight: 36,
            }}
          >
            {formatTimerSeconds(seconds)}
          </Text>
          <View
            style={{
              marginTop: 20,
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            {ADJUST_AMOUNTS.map((m) => (
              <Pressable
                key={m}
                onPress={() => onAdd(m)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel={`${m > 0 ? 'Add' : 'Subtract'} ${Math.abs(m)} ${Math.abs(m) === 1 ? 'minute' : 'minutes'}`}
                style={({ pressed }) => ({
                  flexGrow: 1,
                  flexBasis: 0,
                  paddingVertical: 10,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: '#27272a',
                  alignItems: 'center',
                  opacity: disabled ? 0.3 : pressed ? 0.7 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: 'JetBrainsMono_400Regular',
                    color: '#d4d4d8',
                    fontSize: 13,
                  }}
                >
                  {m > 0 ? `+${m}` : m}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={confirmClear}
            accessibilityRole="button"
            accessibilityLabel="Clear timer"
            disabled={disabled || seconds === 0}
            style={({ pressed }) => ({
              marginTop: 18,
              paddingVertical: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#27272a',
              alignItems: 'center',
              opacity:
                disabled || seconds === 0 ? 0.3 : pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                color: '#d4d4d8',
                fontSize: 14,
              }}
            >
              Clear timer
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
