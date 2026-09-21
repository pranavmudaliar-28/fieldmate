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
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  elevation,
  layout,
  motion,
  radius,
  spacing,
  typography,
} from '../constants/theme';
import { useReduceMotion } from '../hooks/use-reduce-motion';
import { Icon } from './Icon';

type Toast = { message: string; tone: 'success' | 'error' };

type ToastContextValue = {
  showToast: (message: string, tone?: Toast['tone']) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 3000;

/** Short confirmations; anything needing a decision uses a dialog instead. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const enter = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    setToast({ message, tone });
    AccessibilityInfo.announceForAccessibility(message);
    setTimeout(() => setToast(null), VISIBLE_MS);
  }, []);

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
  const palette = toast?.tone === 'error' ? colors.errorText : colors.accent;

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
          pointerEvents="none"
        >
          <View style={[styles.emblem, { backgroundColor: palette }]}>
            <Icon
              name={toast.tone === 'error' ? 'close' : 'checkmark'}
              size={14}
              color={toast.tone === 'error' ? colors.onPrimary : colors.onAccent}
            />
          </View>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.message}>
            {toast.message}
          </Text>
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
    paddingVertical: spacing.smPlus,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceInverse,
    ...elevation.overlay,
  },
  emblem: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { ...typography.secondaryStrong, color: colors.textOnInverse, flex: 1 },
});
