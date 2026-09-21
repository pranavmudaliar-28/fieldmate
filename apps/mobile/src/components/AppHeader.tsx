import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  typography,
} from '../constants/theme';
import { Icon } from './Icon';

export type AppHeaderProps = {
  title: string;
  /** Small line above the title — a date, a role, a section. */
  eyebrow?: string;
  /** Shown as a back arrow on the left. */
  onBack?: () => void;
  /** Shown as a close cross on the right, for forms with a discard guard. */
  onClose?: () => void;
  /** Avatar, bell, overflow — whatever the screen owns. */
  right?: ReactNode;
  /** Tab roots use the large treatment; pushed screens do not. */
  size?: 'large' | 'compact';
  testID?: string;
};

/**
 * The one header in the app. Replaces the split between a hand-built dashboard
 * header and a per-screen native header that each screen re-declared, once per
 * render branch (docs/04 §4).
 */
export function AppHeader({
  title,
  eyebrow,
  onBack,
  onClose,
  right,
  size = 'compact',
  testID,
}: AppHeaderProps) {
  const large = size === 'large';

  return (
    <SafeAreaView edges={['top']} style={styles.container} testID={testID}>
      <View style={[styles.row, large && styles.rowLarge]}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            testID="header-back"
            hitSlop={8}
            style={styles.circle}
          >
            <Icon name="arrow-back" size={21} color={colors.textPrimary} />
          </Pressable>
        ) : null}

        <View style={styles.titleBlock}>
          {eyebrow ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.eyebrow}>
              {eyebrow}
            </Text>
          ) : null}
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={large ? styles.titleLarge : styles.title}
            accessibilityRole="header"
            numberOfLines={large ? 2 : 1}
          >
            {title}
          </Text>
        </View>

        {right ?? null}

        {onClose ? (
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            testID="header-close"
            hitSlop={8}
            style={styles.circle}
          >
            <Icon name="close" size={21} color={colors.textPrimary} />
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smPlus,
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.smPlus,
    paddingBottom: spacing.smPlus,
  },
  rowLarge: { paddingTop: spacing.md, paddingBottom: spacing.md },
  titleBlock: { flex: 1, gap: spacing.xs },
  eyebrow: { ...typography.label, color: colors.textDisabled },
  title: { ...typography.sectionTitle, color: colors.textPrimary },
  titleLarge: { ...typography.hero, color: colors.textPrimary },
  circle: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
