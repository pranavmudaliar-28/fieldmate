import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  radius,
  spacing,
  toneColors,
  typography,
} from '../constants/theme';

type Toast = { message: string; tone: 'success' | 'error' };

type ToastContextValue = {
  showToast: (message: string, tone?: Toast['tone']) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 3000;

/** Short confirmations; anything needing a decision uses a dialog instead. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    setToast({ message, tone });
    AccessibilityInfo.announceForAccessibility(message);
    setTimeout(() => setToast(null), VISIBLE_MS);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View
          style={[styles.toast, { backgroundColor: toneColors[toast.tone].tint }]}
          accessibilityLiveRegion="polite"
          testID="toast"
          pointerEvents="none"
        >
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={[styles.message, { color: toneColors[toast.tone].text }]}
          >
            {toast.message}
          </Text>
        </View>
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
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  message: { ...typography.body, textAlign: 'center' },
});
