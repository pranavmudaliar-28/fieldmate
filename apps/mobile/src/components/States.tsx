import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { MAX_FONT_SIZE_MULTIPLIER, colors, radius, spacing, typography } from '../constants/theme';
import { Button } from './Button';

/** Loading, empty and error states shared by every data screen (docs/04 §6). */

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

  const blocks = variant === 'list' ? [96, 96, 96] : [28, 20, 120];

  return (
    <View
      style={styles.skeletonGroup}
      testID={testID}
      accessible
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
    >
      {blocks.map((height, index) => (
        <View key={index} style={[styles.skeleton, { height }]} />
      ))}
    </View>
  );
}

export function EmptyState({
  title,
  message,
  action,
  testID = 'empty-state',
}: {
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
  testID?: string;
}) {
  return (
    <View style={styles.centered} testID={testID}>
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
    <View style={styles.centered} testID={testID}>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={styles.message}
        accessibilityRole="alert"
      >
        {message}
      </Text>
      {onRetry ? (
        <Button label="Try again" variant="secondary" onPress={onRetry} fullWidth={false} />
      ) : null}
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
  skeletonGroup: { gap: spacing.sm },
  skeleton: { backgroundColor: colors.surfaceMuted, borderRadius: radius.card },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  title: { ...typography.sectionTitle, color: colors.textPrimary, textAlign: 'center' },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sectionTitle: { ...typography.sectionTitle, color: colors.textPrimary },
});
