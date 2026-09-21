import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  elevation,
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
            <View style={styles.skeletonStripe} />
            <View style={styles.skeletonBody}>
              <Shimmer style={styles.skeletonTitle} />
              <Shimmer style={styles.skeletonLine} />
            </View>
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
        <Icon name={icon} size={26} color={colors.accent} />
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
      {onRetry ? <Button label="Try again" variant="ink" size="md" onPress={onRetry} /> : null}
    </View>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={styles.sectionTitle}
        accessibilityRole="header"
      >
        {title}
      </Text>
      <View style={styles.rule} />
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
  inline: { paddingVertical: spacing.md, alignItems: 'center' },
  skeletonGroup: { gap: spacing.smPlus },
  skeleton: { backgroundColor: colors.surfaceMuted, borderRadius: radius.control },
  skeletonCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    overflow: 'hidden',
    ...elevation.card,
  },
  skeletonStripe: { width: 4, alignSelf: 'stretch', backgroundColor: colors.border },
  skeletonBody: { flex: 1, padding: spacing.md, gap: spacing.smPlus },
  skeletonTitle: { height: 14, width: '80%' },
  skeletonLine: { height: 10, width: '50%' },
  skeletonDetail: { gap: spacing.smPlus },
  skeletonPill: { height: 28, width: 128, borderRadius: radius.pill },
  skeletonHeading: { height: 26, width: '90%' },
  skeletonBlock: { height: 132 },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.smPlus,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  emblem: {
    width: 52,
    height: 52,
    borderRadius: radius.control + 2,
    backgroundColor: colors.surfaceInverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.sectionTitle, color: colors.textPrimary, textAlign: 'center' },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  errorBox: {
    backgroundColor: colors.errorTint,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.smPlus,
  },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  errorMessage: { ...typography.secondaryStrong, color: colors.errorText, flex: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.smPlus },
  sectionTitle: { ...typography.label, color: colors.textSecondary },
  rule: { flex: 1, height: 1, backgroundColor: colors.border },
});
