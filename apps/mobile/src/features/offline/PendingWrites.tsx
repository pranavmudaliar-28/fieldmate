import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  radius,
  spacing,
  toneColors,
  typography,
} from '../../constants/theme';
import { useOfflineQueue } from './offline-queue';

/**
 * What the worker is told about writes that have not reached the server.
 *
 * Two different things, and they must not be confused: work that is simply
 * waiting for signal, and work the server has refused because the task moved
 * on without them. The first needs no action; the second needs a decision,
 * and until it is made nothing is thrown away (docs/02 §10).
 *
 * Both are callouts — surface, 1.5 border in the tone's own colour — so they
 * sit in the same family as the rejection and review notes on the same screen
 * rather than introducing a third kind of banner. Icon and words carry the
 * state; the colour only reinforces it.
 */
export function PendingWrites({ taskId }: { taskId: string }) {
  const queue = useOfflineQueue();
  const blocked = queue.blockedFor(taskId);
  const pending = queue.pendingFor(taskId);

  if (blocked) {
    return (
      <View style={[styles.callout, styles.blocked]} testID="queue-blocked">
        <View style={styles.head}>
          <Icon name="alert-circle-outline" size={22} color={toneColors.error.text} />
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.title}
            accessibilityRole="header"
          >
            This task changed while you were offline
          </Text>
        </View>

        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.body}>
          {blocked.reason}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.body}>
          {pending === 1
            ? '1 change is still waiting. Nothing has been deleted.'
            : `${pending} changes are still waiting. Nothing has been deleted.`}
        </Text>

        <View style={styles.actions}>
          <Button
            label="Try again"
            icon="refresh"
            variant="secondary"
            testID="queue-retry"
            onPress={() => void queue.retry(taskId)}
            style={styles.action}
          />
          <Button
            label="Discard them"
            variant="destructive"
            testID="queue-discard"
            onPress={() => void queue.discard(taskId)}
            style={styles.action}
          />
        </View>
      </View>
    );
  }

  if (pending === 0) return null;

  return (
    <View style={[styles.callout, styles.waiting]} testID="queue-pending">
      <Icon
        name={queue.syncing ? 'sync-outline' : 'cloud-upload-outline'}
        size={22}
        color={toneColors.info.text}
      />
      <View style={styles.waitingText}>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.title}>
          {queue.syncing ? 'Sending your changes' : 'Saved on this phone'}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.body}>
          {queue.syncing
            ? 'Catching up now that you have signal.'
            : pending === 1
              ? '1 change will send when you have signal.'
              : `${pending} changes will send when you have signal.`}
        </Text>
      </View>
    </View>
  );
}

/** The app-wide count, for a header or a profile screen. */
export function PendingWritesSummary() {
  const queue = useOfflineQueue();
  if (queue.pending === 0) return null;

  return (
    <View style={[styles.callout, styles.waiting]} testID="queue-summary">
      <Icon name="cloud-upload-outline" size={22} color={toneColors.info.text} />
      <View style={styles.waitingText}>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.body}>
          {queue.pending === 1
            ? '1 change waiting to send'
            : `${queue.pending} changes waiting to send`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  /** The same callout shape the task screens use for a note or a warning. */
  callout: {
    padding: spacing.md,
    borderRadius: radius.card,
    borderWidth: 1.5,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  waiting: { flexDirection: 'row', gap: spacing.smPlus, borderColor: toneColors.info.text },
  waitingText: { flex: 1, gap: 2 },
  blocked: { borderColor: colors.error },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.smPlus },
  title: { ...typography.bodyStrong, fontSize: 17, color: colors.textPrimary, flexShrink: 1 },
  body: { ...typography.secondary, fontSize: 15, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  action: { flex: 1 },
});
