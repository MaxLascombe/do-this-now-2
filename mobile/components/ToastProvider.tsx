import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Pressable, Text, View } from 'react-native'

type Toast = {
  message: string
  actionLabel?: string
  onAction?: () => void
}

const ToastContext = createContext<((toast: Toast) => void) | null>(null)

export function useToast() {
  const show = useContext(ToastContext)
  if (!show) throw new Error('useToast must be used within a ToastProvider')
  return show
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((next: Toast) => {
    if (timer.current) clearTimeout(timer.current)
    setToast(next)
    timer.current = setTimeout(() => setToast(null), 6000)
  }, [])

  const dismiss = () => {
    if (timer.current) clearTimeout(timer.current)
    setToast(null)
  }

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            bottom: 96,
            left: 0,
            right: 0,
            alignItems: 'center',
          }}
        >
          <View
            accessibilityRole="alert"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: '#27272a',
              backgroundColor: '#09090b',
              paddingHorizontal: 16,
              paddingVertical: 10,
              shadowColor: '#000',
              shadowOpacity: 0.4,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 13,
                color: '#e4e4e7',
              }}
            >
              {toast.message}
            </Text>
            {toast.actionLabel && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  toast.onAction?.()
                  dismiss()
                }}
                style={({ pressed }) => ({
                  borderRadius: 999,
                  backgroundColor: '#fafafa',
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text
                  style={{
                    fontFamily: 'JetBrainsMono_700Bold',
                    fontSize: 12,
                    color: '#0a0a0b',
                  }}
                >
                  {toast.actionLabel}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </ToastContext.Provider>
  )
}
