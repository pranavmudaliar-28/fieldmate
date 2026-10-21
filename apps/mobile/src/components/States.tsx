import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  elevation,
  layout,
  motion,
  radius,
  spacing,
  typography,
  type IconName,
} from '../constants/theme';
import { useReduceMotion } from '../hooks/use-reduce-motion';
import { Button } from './Button';
import { Icon } from './Icon';

/** Loading, empty and error states shared by every data screen (docs/04 §6). */

/** A skeleton bar that breathes. Holds still when Reduce Motion is on. */
function Shimmer({ style }: { style?: object }) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, {
          toValue: 1,
          duration: motion.shimmer / 2,
          useNativeDriver: true,
        }),
        Animated.timing(progress, {
          toValue: 0,
          duration: motion.shimmer / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion]);

  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] });

  return <Animated.View style={[styles.skeleton, style, { opacity }]} />;
}

export function LoadingState({
  variant = 'list',
  testID = 'loading-state',
}: {
  variant?: 'list' | 'detail' | 'inline';
  testID?: string;
}) {
  if (variant === 'inline') {
    return (
      <View style={styles.inline} testID={testID}>
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading" />
      </View>
    );
  }

  return (
    <View
      style={styles.skeletonGroup}
      testID={testID}
      accessible
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
    >
      {variant === 'list' ? (
        // Shaped like the cards that are coming, so nothing jumps on arrival.
        [0, 1, 2].map((index) => (
          <View key={index} style={styles.skeletonCard}>
            <Shimmer style={styles.skeletonBadge} />
            <Shimmer style={styles.skeletonTitle} />
            <Shimmer style={styles.skeletonLine} />
          </View>
        ))
      ) : (
        <View style={styles.skeletonDetail}>
          <Shimmer style={styles.skeletonPill} />
          <Shimmer style={styles.skeletonHeading} />
          <Shimmer style={styles.skeletonBlock} />
        </View>
      )}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  icon = 'checkmark-done-outline',
  action,
  testID = 'empty-state',
}: {
  title: string;
  message: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
  testID?: string;
}) {
  return (
    <View style={styles.centered} testID={testID}>
      <View style={styles.emblem}>
        <Icon name={icon} size={44} color={colors.textPrimary} />
      </View>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={styles.title}
        accessibilityRole="header"
      >
        {title}
      </Text>
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.message}>
        {message}
      </Text>
      {action ? (
        <Button
          label={action.label}
          variant="secondary"
          onPress={action.onPress}
          fullWidth={false}
          // A label-width button starts at the left; here it sits under centred text.
          style={styles.centeredAction}
        />
      ) : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  testID = 'error-state',
}: {
  message: string;
  onRetry?: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.errorBox} testID={testID}>
      <View style={styles.errorRow}>
        <Icon name="alert-circle" size={20} color={colors.errorText} />
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.errorMessage}
          accessibilityRole="alert"
        >
          {message}
        </Text>
      </View>
      {onRetry ? (
        <Button label="Try again" variant="secondary" size="md" onPress={onRetry} />
      ) : null}
    </View>
  );
}

export function SectionHeader({
  title,
  count,
  countStyle = 'signal',
  actionLabel,
  onAction,
}: {
  title: string;
  /** A count beside the title; hidden at zero. */
  count?: number;
  /** Signal for "this needs you", ink for a plain tally. */
  countStyle?: 'signal' | 'ink';
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.sectionTitle}
          accessibilityRole="header"
          accessibilityLabel={count ? `${title}, ${count}` : title}
        >
          {title}
        </Text>
        {count ? (
          <View style={[styles.count, countStyle === 'ink' && styles.countInk]}>
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={[styles.countText, countStyle === 'ink' && styles.countTextInk]}
            >
              {count}
            </Text>
          </View>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          variant="ghost"
          size="md"
          onPress={onAction}
          fullWidth={false}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centeredAction: { alignSelf: 'center' },
  inline: { paddingVertical: spacing.md, alignItems: 'center' },
  skeletonGroup: { gap: spacing.smPlus },
  skeleton: { backgroundColor: colors.surfaceMuted, borderRadius: radius.control },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.smPlus,
    ...elevation.card,
  },
  skeletonBadge: { height: 26, width: 112, borderRadius: radius.badge },
  skeletonTitle: { height: 16, width: '80%' },
  skeletonLine: { height: 12, width: '55%' },
  skeletonDetail: { gap: spacing.smPlus },
  skeletonPill: { height: 30, width: 136, borderRadius: radius.badge },
  skeletonHeading: { height: 26, width: '90%' },
  skeletonBlock: { height: 132 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.smPlus,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  emblem: {
    width: 112,
    height: 112,
    borderRadius: radius.sheet,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.sectionTitle,
    fontFamily: typography.display.fontFamily,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  errorBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.smPlus,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  errorMessage: { ...typography.secondaryStrong, color: colors.errorText, flex: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.smPlus,
    minHeight: layout.minTouchTarget,
  },
  sectionTitleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { ...typography.sectionHeading, color: colors.textPrimary, flexShrink: 1 },
  count: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countInk: { backgroundColor: colors.surfaceInverse },
  countText: { ...typography.secondaryStrong, color: colors.onAccent },
  countTextInk: { color: colors.textOnInverse },
});
