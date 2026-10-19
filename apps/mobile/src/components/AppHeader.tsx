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
  /** A form that can be abandoned shows a cross instead of the back arrow. */
  backIcon?: 'back' | 'close';
  backTestID?: string;
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
  backIcon = 'back',
  backTestID = 'header-back',
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
            accessibilityLabel={backIcon === 'close' ? 'Close' : 'Go back'}
            testID={backTestID}
            hitSlop={8}
            style={styles.circle}
          >
            <Icon
              name={backIcon === 'close' ? 'close' : 'chevron-back'}
              size={26}
              color={colors.textPrimary}
            />
          </Pressable>
        ) : null}

        <View style={styles.titleBlock}>
          {eyebrow ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.eyebrow}>
              {eyebrow}
            </Text>
          ) : null}
          {/* Detail screens leave the bar empty and put the title in the page. */}
          {title ? (
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={large ? styles.titleLarge : styles.title}
              accessibilityRole="header"
              numberOfLines={large ? 2 : 1}
            >
              {title}
            </Text>
          ) : null}
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
            <Icon name="close" size={24} color={colors.textPrimary} />
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
  eyebrow: { ...typography.secondary, fontSize: 15, color: colors.textSecondary },
  title: { ...typography.sectionTitle, color: colors.textPrimary },
  titleLarge: { ...typography.hero, color: colors.textPrimary },
  /** Bare glyphs on paper; the 48 box is the hit area, pulled into the gutter. */
  circle: {
    width: layout.minTouchTarget,
    height: layout.minTouchTarget,
    marginHorizontal: -spacing.smPlus,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
