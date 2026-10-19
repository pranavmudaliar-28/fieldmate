import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionBar } from '../../../../src/components/ActionBar';
import { AppHeader } from '../../../../src/components/AppHeader';
import { Badge } from '../../../../src/components/Badge';
import { Button } from '../../../../src/components/Button';
import { Icon } from '../../../../src/components/Icon';
import { ErrorState, LoadingState } from '../../../../src/components/States';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  elevation,
  layout,
  radius,
  spacing,
  statusAppearance,
  toneColors,
  typography,
} from '../../../../src/constants/theme';
import { useTask, useTaskAction, useTaskList } from '../../../../src/features/tasks/hooks';
import { ApiError } from '../../../../src/services/http';
import { formatTime } from '../../../../src/utils/format';

const EVIDENCE_HINT = 'Add at least 1 photo to submit for review.';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** S-010 Submit for review: the checklist is itself the confirmation. */
export default function CompleteTaskScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const task = useTask(taskId);
  const complete = useTaskAction(taskId, 'complete');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (task.isPending) {
    return (
      <View style={styles.screen}>
        <AppHeader title="" onBack={() => router.back()} />
        <View style={styles.padded}>
          <LoadingState variant="detail" />
        </View>
      </View>
    );
  }

  if (task.isError) {
    return (
      <View style={styles.screen}>
        <AppHeader title="" onBack={() => router.back()} />
        <View style={styles.padded}>
          <ErrorState message="Couldn't load this task." onRetry={() => void task.refetch()} />
        </View>
      </View>
    );
  }

  if (done) return <SentForReview />;

  const detail = task.data;
  const photoCount = detail.evidence.length;
  const fromGallery = detail.evidence.filter((photo) => photo.source === 'GALLERY').length;
  const lastNote = detail.notes[detail.notes.length - 1];
  const canComplete = photoCount > 0 && detail.status === 'IN_PROGRESS';

  return (
    <View style={styles.screen}>
      <AppHeader title="" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.title}
            accessibilityRole="header"
          >
            Ready to submit?
          </Text>
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.lead}>
            Your manager will review your work on{' '}
            <Text style={styles.leadStrong}>{detail.title}</Text>.
          </Text>
        </View>

        <View style={styles.checklist}>
          <CheckRow
            ok={photoCount > 0}
            title={photoCount > 0 ? plural(photoCount, 'photo') : 'No photos yet'}
            detail={
              photoCount > 0
                ? `${photoCount - fromGallery} from camera, ${fromGallery} from gallery`
                : 'At least one is needed'
            }
            status={photoCount > 0 ? 'Done' : 'Required'}
            testID="summary-photos"
          />
          <View style={styles.divider} />
          <CheckRow
            ok={detail.notes.length > 0}
            optional
            title={detail.notes.length > 0 ? plural(detail.notes.length, 'note') : 'No notes'}
            detail={lastNote ? `Last added ${formatTime(lastNote.createdAt)}` : 'Optional'}
            status={detail.notes.length > 0 ? 'Done' : 'Optional'}
            testID="summary-notes"
          />
        </View>

        <View style={styles.infoBox}>
          <Icon name="information-circle-outline" size={20} color={toneColors.info.text} />
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.infoText}>
            After you submit, photos and notes are locked. If your manager asks for changes, the
            task comes back to you with their note.
          </Text>
        </View>

        {error ? (
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.error}
            accessibilityRole="alert"
            testID="complete-error"
          >
            {error}
          </Text>
        ) : null}
      </ScrollView>

      <ActionBar {...(photoCount === 0 ? { hint: EVIDENCE_HINT } : {})}>
        <Button
          label="Back"
          variant="secondary"
          onPress={() => router.back()}
          disabled={complete.isPending}
          style={styles.back}
        />
        <Button
          label="Submit"
          icon="send-outline"
          variant="signal"
          testID="confirm-complete"
          loading={complete.isPending}
          disabled={!canComplete}
          disabledReason={EVIDENCE_HINT}
          onPress={() =>
            complete.mutate(undefined, {
              onSuccess: () => {
                setError(null);
                setDone(true);
              },
              onError: (completeError) => {
                setError(
                  completeError instanceof ApiError
                    ? completeError.message
                    : 'Something went wrong. Please try again.',
                );
                void task.refetch();
              },
            })
          }
          style={styles.submit}
        />
      </ActionBar>
    </View>
  );
}

function CheckRow({
  ok,
  optional = false,
  title,
  detail,
  status,
  testID,
}: {
  ok: boolean;
  optional?: boolean;
  title: string;
  detail: string;
  status: string;
  testID: string;
}) {
  const mark = ok
    ? { background: toneColors.success.text, icon: 'checkmark' as const, color: colors.onPrimary }
    : optional
      ? { background: colors.surfaceMuted, icon: 'remove' as const, color: colors.textSecondary }
      : { background: toneColors.error.tint, icon: 'close' as const, color: toneColors.error.text };
  const statusColor = ok
    ? toneColors.success.text
    : optional
      ? colors.textSecondary
      : toneColors.error.text;

  return (
    <View style={styles.checkRow} accessible accessibilityLabel={`${title}, ${detail}, ${status}`}>
      <View style={[styles.checkMark, { backgroundColor: mark.background }]}>
        <Icon name={mark.icon} size={20} color={mark.color} />
      </View>
      <View style={styles.checkText}>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.checkTitle}>
          {title}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.checkDetail}>
          {detail}
        </Text>
      </View>
      <Text
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        style={[styles.checkStatus, { color: statusColor }]}
        testID={testID}
      >
        {status}
      </Text>
    </View>
  );
}

/** The hand-over moment: on ink, with what to do next if there is anything. */
function SentForReview() {
  const router = useRouter();
  // Same statuses and size as the home screen, so this reads its cache.
  const assigned = useTaskList(['ASSIGNED'], 10);
  const upNext = assigned.data?.pages[0]?.items[0];
  const review = statusAppearance.AWAITING_REVIEW;

  return (
    <SafeAreaView style={styles.success} testID="completion-success">
      <StatusBar style="light" />
      <View style={styles.successBody}>
        <View style={styles.halo}>
          <View style={styles.successMark}>
            <Icon name="send-outline" size={48} color={colors.onAccent} />
          </View>
        </View>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.successTitle}
          accessibilityRole="header"
        >
          Sent for review
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.successText}>
          Your manager has been notified. We’ll let you know when they approve it or ask for
          changes.
        </Text>
        <Badge
          label={review.label}
          icon={review.icon}
          palette={{ text: review.tint, tint: `${review.text}55` }}
          style={styles.successBadge}
        />
      </View>

      <View style={styles.successFooter}>
        {upNext ? (
          <Pressable
            onPress={() => router.replace(`/(worker)/tasks/${upNext.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Up next: ${upNext.title}, ${upNext.address}`}
            testID="up-next"
            style={({ pressed }) => [styles.upNext, pressed && styles.upNextPressed]}
          >
            <View style={styles.upNextText}>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.upNextLabel}>
                Up next
              </Text>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.upNextTitle}>
                {upNext.title}
              </Text>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.upNextAddress}>
                {upNext.address}
              </Text>
            </View>
            <Icon name="chevron-forward" size={22} color={colors.textOnInverse} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => router.replace('/(worker)/(tabs)')}
          accessibilityRole="button"
          accessibilityLabel="Back to home"
          testID="back-to-home"
          style={({ pressed }) => [styles.home, pressed && styles.homePressed]}
        >
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.homeLabel}>
            Back to home
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, paddingTop: 0, gap: spacing.mdPlus },
  padded: { flex: 1, padding: layout.screenPadding, backgroundColor: colors.background },
  intro: { gap: spacing.sm },
  title: { ...typography.display, color: colors.textPrimary },
  lead: { ...typography.body, fontSize: 17, lineHeight: 26, color: colors.textSecondary },
  leadStrong: { fontFamily: typography.bodyStrong.fontFamily, color: colors.textPrimary },
  checklist: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    ...elevation.card,
  },
  divider: { height: 1, backgroundColor: colors.border },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smPlus,
    minHeight: 76,
    paddingVertical: spacing.smPlus,
  },
  checkMark: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { flex: 1, gap: 2 },
  checkTitle: { ...typography.cardTitle, color: colors.textPrimary },
  checkDetail: { ...typography.secondary, color: colors.textSecondary },
  checkStatus: { ...typography.secondaryStrong },
  infoBox: {
    flexDirection: 'row',
    gap: spacing.smPlus,
    backgroundColor: toneColors.info.tint,
    padding: spacing.md,
    borderRadius: radius.card,
  },
  infoText: { ...typography.body, color: toneColors.info.text, flex: 1 },
  error: { ...typography.secondaryStrong, color: colors.errorText },
  back: { flex: 0.8 },
  submit: { flex: 1.4 },
  success: { flex: 1, backgroundColor: colors.surfaceInverse },
  successBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: layout.screenPadding + spacing.sm,
  },
  halo: {
    width: 176,
    height: 176,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 194, 26, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  successMark: {
    width: 136,
    height: 136,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: { ...typography.hero, color: colors.textOnInverse, textAlign: 'center' },
  successText: {
    ...typography.body,
    fontSize: 17,
    lineHeight: 26,
    color: colors.textOnInverseMuted,
    textAlign: 'center',
  },
  successBadge: { alignSelf: 'center' },
  successFooter: { padding: layout.screenPadding, gap: spacing.smPlus },
  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceInverseRaised,
  },
  upNextPressed: { opacity: 0.85 },
  upNextText: { flex: 1, gap: 2 },
  upNextLabel: { ...typography.label, color: colors.accent },
  upNextTitle: { ...typography.cardTitle, color: colors.textOnInverse },
  upNextAddress: { ...typography.secondary, color: colors.textOnInverseMuted },
  home: {
    minHeight: layout.buttonHeightLarge,
    borderRadius: radius.action,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  homePressed: { backgroundColor: colors.border },
  homeLabel: { ...typography.button, color: colors.textPrimary },
});
