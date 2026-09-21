import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, PixelRatio, Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  elevation,
  layout,
  radius,
  spacing,
  typography,
} from '../constants/theme';

/** Above this text scale two buttons no longer fit side by side (docs/04 §8). */
const STACK_ABOVE_FONT_SCALE = 1.3;

/**
 * iOS keeps the keyboard over the content, so the bar has to move itself.
 * Android resizes the window instead, and moving would double the offset.
 */
function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillChangeFrame', (event) => {
      setOffset(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => setOffset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return offset;
}

/** Fixed bottom bar so the main action always sits in the same place (docs/04 §1). */
export function ActionBar({ children, hint }: { children: ReactNode; hint?: string }) {
  const insets = useSafeAreaInsets();
  const keyboardOffset = useKeyboardOffset();
  const stacked = PixelRatio.getFontScale() >= STACK_ABOVE_FONT_SCALE;

  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(insets.bottom, spacing.md), marginBottom: keyboardOffset },
      ]}
    >
      {hint ? (
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.hint}>
          {hint}
        </Text>
      ) : null}
      <View style={stacked ? styles.actionsStacked : styles.actions}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    gap: spacing.smPlus,
    ...elevation.floating,
  },
  hint: { ...typography.caption, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.smPlus },
  actionsStacked: { flexDirection: 'column-reverse', gap: spacing.sm },
});
