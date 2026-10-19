import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  elevation,
  fontFamily,
  layout,
  motion,
  radius,
  spacing,
  toneColors,
  typography,
} from '../constants/theme';
import { useReduceMotion } from '../hooks/use-reduce-motion';
import { Icon } from './Icon';

/** One way back from what the toast confirms, such as Undo. */
export type ToastAction = { label: string; onPress: () => void };

type Toast = { message: string; tone: 'success' | 'error'; action?: ToastAction };

type ToastContextValue = {
  showToast: (message: string, tone?: Toast['tone'], action?: ToastAction) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 3000;
/** Long enough to read the message and still reach the action. */
const VISIBLE_WITH_ACTION_MS = 6000;

/** Short confirmations; anything needing a decision uses a dialog instead. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const enter = useRef(new Animated.Value(0)).current;
  // Each toast owns the timer that hides it, so a newer toast is never cut
  // short by the one it replaced.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, tone: Toast['tone'] = 'success', action?: ToastAction) => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setToast(action ? { message, tone, action } : { message, tone });
      AccessibilityInfo.announceForAccessibility(
        action ? `${message}. ${action.label} is available.` : message,
      );
      hideTimer.current = setTimeout(
        () => setToast(null),
        action ? VISIBLE_WITH_ACTION_MS : VISIBLE_MS,
      );
    },
    [],
  );

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  useEffect(() => {
    enter.setValue(toast ? 0 : 0);
    if (!toast) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: motion.base,
      useNativeDriver: true,
    }).start();
  }, [toast, enter]);

  const value = useMemo(() => ({ showToast }), [showToast]);
  const palette = toast?.tone === 'error' ? toneColors.error.dot : toneColors.success.dot;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View
          style={[
            styles.toast,
            // Docks above whatever owns the bottom of the screen — the floating
            // tab bar or the action bar — instead of a fixed offset that used
            // to sit on top of them.
            { bottom: insets.bottom + layout.tabBarHeight + spacing.smPlus },
            {
              opacity: enter,
              transform: reduceMotion
                ? []
                : [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            },
          ]}
          accessibilityLiveRegion="polite"
          testID="toast"
          pointerEvents={toast.action ? 'box-none' : 'none'}
        >
          <View style={[styles.emblem, { backgroundColor: palette }]}>
            <Icon
              name={toast.tone === 'error' ? 'alert' : 'checkmark'}
              size={16}
              color={colors.onPrimary}
            />
          </View>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.message}>
            {toast.message}
          </Text>
          {toast.action ? (
            <Pressable
              onPress={() => {
                if (hideTimer.current) clearTimeout(hideTimer.current);
                setToast(null);
                toast.action?.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={toast.action.label}
              hitSlop={4}
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
              testID="toast-action"
            >
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.actionLabel}>
                {toast.action.label}
              </Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider.');
  return context;
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: layout.screenPadding,
    right: layout.screenPadding,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smPlus,
    minHeight: 56,
    paddingVertical: spacing.smPlus,
    paddingHorizontal: spacing.md,
    borderRadius: radius.toast,
    backgroundColor: colors.surfaceInverse,
    ...elevation.overlay,
  },
  emblem: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    ...typography.bodyStrong,
    fontSize: 15,
    lineHeight: 20,
    color: colors.textOnInverse,
    flex: 1,
  },
  action: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.badge,
    justifyContent: 'center',
  },
  actionPressed: { backgroundColor: colors.surfaceInverseRaised },
  /** Yellow is allowed as text here: it sits on ink, never on paper. */
  actionLabel: {
    ...typography.bodyStrong,
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fontFamily.bold,
    color: colors.accent,
  },
});
