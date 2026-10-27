import { useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../../src/components/Button';
import { ConfirmationDialog } from '../../../../src/components/ConfirmationDialog';
import { Icon } from '../../../../src/components/Icon';
import { useToast } from '../../../../src/components/Toast';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  tabularNumbers,
  toneColors,
  typography,
  type IconName,
} from '../../../../src/constants/theme';
import { uploadEvidence } from '../../../../src/features/evidence/api';
import { uuid } from '../../../../src/features/offline/id';
import {
  isQueueSupported as queueSupported,
  queuedPhotoUri,
} from '../../../../src/features/offline/store';
import { useQueuedWrite } from '../../../../src/features/offline/use-queued-write';
import {
  deniedHelp,
  openPermissionSettings,
  unavailableReason,
} from '../../../../src/features/evidence/camera-access';
import { preparePhoto, type PreparedPhoto } from '../../../../src/features/evidence/compress';
import { taskKeys, useTask } from '../../../../src/features/tasks/hooks';
import { useIsOnline } from '../../../../src/hooks/use-network-status';
import { ApiError } from '../../../../src/services/http';
import { formatTime } from '../../../../src/utils/format';

/**
 * Being offline no longer stops a photo being kept — it is copied out of the
 * cache and sent when the signal returns (docs/02 §10). The worker is told
 * that rather than being blocked.
 */
const OFFLINE_MESSAGE = "You're offline. This photo will send when you're back.";

/**
 * S-009 Add photo: permission → camera → preview → upload. Drawn on ink
 * throughout, so the photo is the brightest thing on the screen.
 */
export default function FieldEvidenceScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const write = useQueuedWrite(taskId);
  const isOnline = useIsOnline();
  const task = useTask(taskId);

  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [takenAt, setTakenAt] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const uploading = progress !== null;
  const chip = task.data
    ? `${task.data.title.split(' – ')[0]} · ${task.data.evidence.length} photo${
        task.data.evidence.length === 1 ? '' : 's'
      }`
    : null;

  const close = () => {
    if (photo && !uploading) {
      setConfirmDiscard(true);
      return;
    }
    router.back();
  };

  const keep = (prepared: PreparedPhoto) => {
    setPhoto(prepared);
    setTakenAt(new Date().toISOString());
  };

  const capture = async () => {
    setCapturing(true);
    setError(null);
    try {
      const shot = await camera.current?.takePictureAsync({ skipProcessing: true });
      if (!shot) throw new Error('No photo');
      keep(await preparePhoto(shot.uri, shot.width, 'CAMERA'));
    } catch {
      setError("Couldn't take the photo. Try again.");
    } finally {
      setCapturing(false);
    }
  };

  /**
   * A photo the worker already has. Recorded as GALLERY, because a picked
   * image could be from anywhere and at any time — the record has to say so
   * (docs/02 F-006).
   */
  const pickFromGallery = async () => {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        // The upload resizes and re-encodes anyway, so cropping here would
        // only throw away pixels the manager may want.
        allowsEditing: false,
        quality: 1,
      });
      if (result.canceled) return;

      const picked = result.assets[0];
      if (!picked) return;
      keep(await preparePhoto(picked.uri, picked.width, 'GALLERY'));
    } catch {
      setError("Couldn't open your photos. Try again.");
    }
  };

  const upload = async () => {
    if (!photo) return;
    setError(null);
    setProgress(0);
    try {
      const photoId = uuid();
      const queued = await write({
        action: {
          kind: 'photo',
          photoId,
          localUri: queuedPhotoUri(photoId),
          mimeType: photo.mimeType,
          size: photo.size,
          source: photo.source,
        },
        photoUri: photo.uri,
        online: () => uploadEvidence(taskId, { ...photo, id: photoId }, setProgress),
      });

      await queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      // Said plainly: the photo is kept and will go when there is signal. A
      // worker who is told "saved" and loses it has lost the evidence.
      showToast(
        queued === null
          ? 'Photo saved — it will send when you’re back online'
          : 'Photo saved to task',
      );
      router.back();
    } catch (uploadError) {
      setProgress(null);
      setError(
        uploadError instanceof ApiError
          ? uploadError.message
          : 'The photo didn’t finish uploading. Check your connection and try again.',
      );
    }
  };

  // Every state of this screen is ink, so the status bar goes light throughout.
  const header = (
    <>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      <StatusBar style="light" />
    </>
  );

  const galleryLink = (
    <Pressable
      onPress={() => void pickFromGallery()}
      accessibilityRole="button"
      accessibilityLabel="Pick from gallery instead"
      testID="pick-from-gallery"
      style={styles.link}
    >
      <Icon name="image-outline" size={20} color={colors.textOnInverse} />
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.linkText}>
        Pick from gallery instead
      </Text>
    </Pressable>
  );

  if (!permission) {
    return (
      <View style={[styles.ink, styles.centered]}>
        {header}
        <ActivityIndicator color={colors.accent} accessibilityLabel="Loading" />
      </View>
    );
  }

  // Somewhere the camera cannot be reached at all, whatever the permission says.
  const unavailable = unavailableReason();
  if (unavailable) {
    return (
      <Explainer
        testID="camera-unavailable"
        icon="camera-outline"
        danger
        title="Camera not available here"
        body={unavailable}
        onClose={() => router.back()}
        footer={
          <>
            <Button label="Back to task" variant="secondary" onPress={() => router.back()} />
            {galleryLink}
          </>
        }
      >
        {header}
      </Explainer>
    );
  }

  if (!permission.granted && !photo) {
    const denied = !permission.canAskAgain;
    return (
      <Explainer
        testID="camera-permission-prompt"
        icon="camera-outline"
        danger={denied}
        title={denied ? 'Camera is turned off' : 'Allow camera access'}
        body={
          denied
            ? deniedHelp.body
            : 'FieldMate uses your camera to attach site photos to a task. Photos are only seen by your managers.'
        }
        points={
          denied
            ? deniedHelp.action
              ? ['Open Settings › FieldMate', 'Turn on Camera']
              : []
            : ['Only used while you’re adding a photo', 'You can change this in Settings anytime']
        }
        numbered={denied}
        onClose={() => router.back()}
        footer={
          <>
            {/* Only offered where there is somewhere to send them; see camera-access. */}
            {denied ? (
              deniedHelp.action ? (
                <LightButton
                  label={deniedHelp.action}
                  testID="camera-permission-action"
                  onPress={openPermissionSettings}
                />
              ) : null
            ) : (
              <Button
                label="Allow camera"
                variant="signal"
                testID="camera-permission-action"
                onPress={() => void requestPermission()}
              />
            )}
            {galleryLink}
          </>
        }
      >
        {header}
      </Explainer>
    );
  }

  if (photo && uploading) {
    const percent = Math.round((progress ?? 0) * 100);
    return (
      <SafeAreaView style={styles.ink} testID="upload-progress">
        {header}
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.topTitle}>
          Adding photo
        </Text>
        <View style={styles.frame}>
          <Image source={{ uri: photo.uri }} style={styles.dimmed} contentFit="cover" />
          <View style={styles.progressOverlay}>
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.percent}
              accessibilityLabel={`Uploading, ${percent} percent`}
            >
              {percent}%
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${percent}%` }]} />
            </View>
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.uploadingText}>
              Uploading… keep this screen open
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (photo) {
    const failed = error !== null;
    return (
      <SafeAreaView style={styles.ink} testID="photo-preview">
        {header}
        <View style={styles.topBar}>
          <CircleButton icon="chevron-back" label="Back" onPress={close} testID="close-camera" />
          <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.topBarTitle}>
            {failed ? 'Adding photo' : 'Preview'}
          </Text>
          <View style={styles.circleSpacer} />
        </View>

        <View style={styles.frame}>
          <Image
            source={{ uri: photo.uri }}
            style={failed ? styles.dimmed : styles.fill}
            contentFit="cover"
          />
          {failed ? (
            <View style={styles.progressOverlay} accessibilityRole="alert" testID="evidence-error">
              <View style={styles.failMark}>
                <Icon name="cloud-offline-outline" size={30} color={toneColors.error.dot} />
              </View>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.failTitle}>
                Upload failed
              </Text>
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.failBody}>
                {error}
              </Text>
            </View>
          ) : (
            <View style={styles.sourceChip}>
              <Icon
                name={photo.source === 'GALLERY' ? 'image-outline' : 'camera-outline'}
                size={16}
                color={colors.textOnInverse}
              />
              <Text maxFontSizeMultiplier={1.2} style={styles.sourceChipText}>
                {photo.source === 'GALLERY' ? 'Gallery' : 'Camera'}
                {takenAt ? ` · ${formatTime(takenAt)}` : ''}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottom}>
          {!isOnline && queueSupported ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.offline}>
              {OFFLINE_MESSAGE}
            </Text>
          ) : null}
          <View style={styles.row}>
            <InkOutlineButton
              label="Retake"
              icon="refresh"
              testID="retake-photo"
              onPress={() => {
                setPhoto(null);
                setError(null);
              }}
            />
            <Button
              label={failed ? 'Retry' : 'Use photo'}
              icon={failed ? 'refresh' : 'checkmark'}
              variant="signal"
              testID="use-photo"
              onPress={() => void upload()}
              style={styles.rowMain}
            />
          </View>
        </View>

        <ConfirmationDialog
          visible={confirmDiscard}
          title="Discard this photo?"
          message="The photo has not been uploaded yet."
          confirmLabel="Discard"
          cancelLabel="Keep photo"
          destructive
          icon="trash-outline"
          onConfirm={() => {
            setConfirmDiscard(false);
            router.back();
          }}
          onCancel={() => setConfirmDiscard(false)}
        />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.ink} testID="camera-view">
      {header}
      <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" />
      <SafeAreaView edges={['top']} style={styles.cameraTop}>
        <CircleButton icon="close" label="Close" onPress={close} testID="close-camera" />
        {chip ? (
          <View style={styles.taskChip}>
            <Text maxFontSizeMultiplier={1.2} style={styles.taskChipText} numberOfLines={1}>
              {chip}
            </Text>
          </View>
        ) : null}
        <View style={styles.circleSpacer} />
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.cameraBottom}>
        {error ? (
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.cameraError}
            accessibilityRole="alert"
            testID="evidence-error"
          >
            {error}
          </Text>
        ) : (
          <Text maxFontSizeMultiplier={1.2} style={styles.mode}>
            Photo
          </Text>
        )}
        <View style={styles.shutterRow}>
          <Pressable
            onPress={() => void pickFromGallery()}
            disabled={capturing}
            accessibilityRole="button"
            accessibilityLabel="Choose from your photos"
            testID="pick-from-gallery"
            style={styles.galleryButton}
          >
            <Icon name="images-outline" size={26} color={colors.textOnInverse} />
          </Pressable>

          <Pressable
            onPress={() => void capture()}
            disabled={capturing}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            accessibilityState={{ busy: capturing }}
            testID="shutter"
            style={styles.shutter}
          >
            <View style={styles.shutterInner}>
              {capturing ? <ActivityIndicator color={colors.textPrimary} /> : null}
            </View>
          </Pressable>

          {/* Balances the row so the shutter stays centred. */}
          <View style={styles.galleryButtonSpacer} pointerEvents="none" />
        </View>
      </SafeAreaView>
    </View>
  );
}

/** A full ink page that explains why the camera cannot open, and what to do. */
function Explainer({
  testID,
  icon,
  danger = false,
  title,
  body,
  points = [],
  numbered = false,
  onClose,
  footer,
  children,
}: {
  testID: string;
  icon: IconName;
  danger?: boolean;
  title: string;
  body: string;
  points?: string[];
  numbered?: boolean;
  onClose: () => void;
  footer: ReactNode;
  children?: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.ink} testID={testID}>
      {children}
      <View style={styles.topBar}>
        <CircleButton icon="close" label="Close" onPress={onClose} />
      </View>
      <View style={styles.explainer}>
        <View style={[styles.explainerMark, danger && styles.explainerMarkDanger]}>
          <Icon name={icon} size={44} color={danger ? colors.textOnInverse : colors.onAccent} />
          {danger ? <View style={styles.strike} /> : null}
        </View>
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.explainerTitle}
          accessibilityRole="header"
        >
          {title}
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.explainerBody}>
          {body}
        </Text>
        {points.map((point, index) => (
          <View key={point} style={styles.point}>
            <View style={styles.pointMark}>
              {numbered ? (
                <Text maxFontSizeMultiplier={1.2} style={styles.pointNumber}>
                  {index + 1}
                </Text>
              ) : (
                <Icon name="checkmark" size={16} color={colors.accent} />
              )}
            </View>
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.pointText}>
              {point}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.bottom}>{footer}</View>
    </SafeAreaView>
  );
}

function CircleButton({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.circle, pressed && styles.circlePressed]}
    >
      <Icon name={icon} size={24} color={colors.textOnInverse} />
    </Pressable>
  );
}

/** Paper on ink: the one light button on a dark page. */
function LightButton({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.light, pressed && styles.lightPressed]}
    >
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.lightLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

function InkOutlineButton({
  label,
  icon,
  onPress,
  testID,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [styles.inkOutline, pressed && styles.circlePressed]}
    >
      <Icon name={icon} size={20} color={colors.textOnInverse} />
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.inkOutlineLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ink: { flex: 1, backgroundColor: colors.surfaceInverse },
  centered: { alignItems: 'center', justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding - spacing.xs,
    paddingTop: spacing.sm,
  },
  topBarTitle: { ...typography.bodyStrong, fontSize: 17, color: colors.textOnInverse },
  topTitle: {
    ...typography.bodyStrong,
    fontSize: 17,
    color: colors.textOnInverse,
    textAlign: 'center',
    paddingTop: spacing.lg,
  },
  circle: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePressed: { opacity: 0.7 },
  circleSpacer: { width: 52 },
  explainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding + spacing.sm,
    gap: spacing.md,
  },
  explainerMark: {
    width: 112,
    height: 112,
    borderRadius: radius.sheet,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  explainerMarkDanger: {
    backgroundColor: colors.surfaceInverseRaised,
    borderWidth: 2,
    borderColor: toneColors.error.dot,
  },
  strike: {
    position: 'absolute',
    width: 64,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: toneColors.error.dot,
    transform: [{ rotate: '45deg' }],
  },
  explainerTitle: { ...typography.hero, color: colors.textOnInverse },
  explainerBody: {
    ...typography.body,
    fontSize: 17,
    lineHeight: 26,
    color: colors.textOnInverseMuted,
  },
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.smPlus },
  pointMark: {
    width: 32,
    height: 32,
    borderRadius: radius.control,
    backgroundColor: colors.surfaceInverseRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointNumber: { ...typography.secondaryStrong, color: colors.accent },
  pointText: { ...typography.secondaryStrong, fontSize: 15, color: colors.textOnInverse, flex: 1 },
  bottom: { padding: layout.screenPadding, gap: spacing.sm },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: layout.minTouchTarget,
  },
  linkText: { ...typography.bodyStrong, color: colors.textOnInverse },
  light: {
    minHeight: layout.buttonHeightLarge,
    borderRadius: radius.action,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightPressed: { backgroundColor: colors.border },
  lightLabel: { ...typography.button, color: colors.textPrimary },
  frame: {
    flex: 1,
    marginHorizontal: layout.screenPadding,
    marginTop: spacing.lg,
    borderRadius: radius.sheet,
    overflow: 'hidden',
    backgroundColor: colors.surfaceInverseRaised,
  },
  fill: { flex: 1 },
  dimmed: { flex: 1, opacity: 0.35 },
  sourceChip: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.smPlus,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(15, 17, 21, 0.8)',
  },
  sourceChipText: { ...typography.secondaryStrong, color: colors.textOnInverse },
  progressOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  percent: { ...typography.hero, ...tabularNumbers, color: colors.textOnInverse },
  progressTrack: {
    alignSelf: 'stretch',
    marginHorizontal: spacing.xl,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: colors.accent },
  uploadingText: { ...typography.bodyStrong, color: colors.textOnInverse },
  failMark: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(200, 41, 28, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  failTitle: {
    ...typography.sectionTitle,
    fontFamily: typography.display.fontFamily,
    color: colors.textOnInverse,
  },
  failBody: { ...typography.body, color: colors.textOnInverseMuted, textAlign: 'center' },
  offline: { ...typography.secondaryStrong, color: colors.onOffline, textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.smPlus },
  rowMain: { flex: 1.3 },
  inkOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    minHeight: layout.buttonHeightLarge,
    borderRadius: radius.action,
    borderWidth: 1.5,
    borderColor: colors.textOnInverse,
  },
  inkOutlineLabel: { ...typography.button, color: colors.textOnInverse },
  cameraTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPadding - spacing.xs,
    paddingTop: spacing.sm,
  },
  taskChip: {
    flexShrink: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(15, 17, 21, 0.75)',
  },
  taskChipText: { ...typography.secondaryStrong, color: colors.textOnInverse },
  cameraBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingHorizontal: layout.screenPadding,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(15, 17, 21, 0.72)',
  },
  mode: { ...typography.secondaryStrong, color: colors.textOnInverse },
  cameraError: { ...typography.secondaryStrong, color: colors.onOffline, textAlign: 'center' },
  shutterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingHorizontal: spacing.sm,
  },
  galleryButton: {
    width: 64,
    height: 64,
    borderRadius: radius.action,
    borderWidth: 2,
    borderColor: colors.textOnInverse,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  galleryButtonSpacer: { width: 64, height: 64 },
  shutter: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    borderWidth: 5,
    borderColor: colors.textOnInverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
