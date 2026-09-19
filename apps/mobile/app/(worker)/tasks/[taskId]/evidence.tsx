import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../../src/components/Button';
import { ConfirmationDialog } from '../../../../src/components/ConfirmationDialog';
import { useToast } from '../../../../src/components/Toast';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  typography,
} from '../../../../src/constants/theme';
import { uploadEvidence } from '../../../../src/features/evidence/api';
import { preparePhoto, type PreparedPhoto } from '../../../../src/features/evidence/compress';
import { taskKeys } from '../../../../src/features/tasks/hooks';
import { useIsOnline } from '../../../../src/hooks/use-network-status';
import { ApiError } from '../../../../src/services/http';
import { useQueryClient } from '@tanstack/react-query';

const OFFLINE_MESSAGE = "You're offline. Connect to upload this photo.";

/** S-009 Field Evidence: permission → camera → preview → upload (docs/04 §5). */
export default function FieldEvidenceScreen() {
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const isOnline = useIsOnline();

  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const uploading = progress !== null;

  const close = () => {
    if (photo && !uploading) {
      setConfirmDiscard(true);
      return;
    }
    router.back();
  };

  const capture = async () => {
    setCapturing(true);
    setError(null);
    try {
      const shot = await camera.current?.takePictureAsync({ skipProcessing: true });
      if (!shot) throw new Error('No photo');
      setPhoto(await preparePhoto(shot.uri, shot.width));
    } catch {
      setError("Couldn't take the photo. Try again.");
    } finally {
      setCapturing(false);
    }
  };

  const upload = async () => {
    if (!photo) return;
    setError(null);
    setProgress(0);
    try {
      await uploadEvidence(taskId, photo, setProgress);
      await queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
      showToast('Photo added');
      router.back();
    } catch (uploadError) {
      setProgress(null);
      setError(
        uploadError instanceof ApiError
          ? uploadError.message
          : 'Upload failed. Check your connection and try again.',
      );
    }
  };

  const header = (
    <Stack.Screen options={{ headerShown: true, title: 'Add photo', presentation: 'modal' }} />
  );

  if (!permission) {
    return (
      <View style={styles.centered}>
        {header}
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading" />
      </View>
    );
  }

  if (!permission.granted) {
    const denied = !permission.canAskAgain;
    return (
      <SafeAreaView style={styles.centered} testID="camera-permission-prompt">
        {header}
        <Text
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          style={styles.permissionTitle}
          accessibilityRole="header"
        >
          Camera access needed
        </Text>
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.permissionBody}>
          {denied
            ? 'Camera access is off. Turn it on in Settings to add photos.'
            : 'FieldMate uses the camera to capture photo evidence for this task.'}
        </Text>
        <Button
          label={denied ? 'Open Settings' : 'Allow'}
          testID="camera-permission-action"
          onPress={() => {
            if (denied) {
              void import('react-native').then(({ Linking }) => void Linking.openSettings());
              return;
            }
            void requestPermission();
          }}
        />
        <Button label="Back to task" variant="secondary" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (photo) {
    return (
      <View style={styles.previewScreen} testID="photo-preview">
        {header}
        <Image source={{ uri: photo.uri }} style={styles.preview} contentFit="contain" />

        <SafeAreaView edges={['bottom']} style={styles.previewActions}>
          {uploading ? (
            <View style={styles.progressBlock} testID="upload-progress">
              <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.progressText}>
                Uploading photo… {Math.round((progress ?? 0) * 100)}%
              </Text>
              <View style={styles.progressTrack}>
                <View
                  style={[styles.progressFill, { width: `${Math.round((progress ?? 0) * 100)}%` }]}
                />
              </View>
            </View>
          ) : null}

          {error ? (
            <Text
              maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
              style={styles.error}
              accessibilityRole="alert"
              testID="evidence-error"
            >
              {error}
            </Text>
          ) : null}

          {!isOnline ? (
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.offline}>
              {OFFLINE_MESSAGE}
            </Text>
          ) : null}

          <View style={styles.row}>
            <Button
              label="Retake"
              variant="secondary"
              testID="retake-photo"
              onPress={() => {
                setPhoto(null);
                setError(null);
              }}
              disabled={uploading}
              style={styles.rowButton}
            />
            <Button
              label={error ? 'Retry' : 'Use photo'}
              testID="use-photo"
              onPress={() => void upload()}
              loading={uploading}
              disabled={!isOnline}
              disabledReason={OFFLINE_MESSAGE}
              style={styles.rowButton}
            />
          </View>
        </SafeAreaView>

        <ConfirmationDialog
          visible={confirmDiscard}
          title="Discard this photo?"
          message="The photo has not been uploaded yet."
          confirmLabel="Discard"
          cancelLabel="Keep photo"
          destructive
          onConfirm={() => {
            setConfirmDiscard(false);
            router.back();
          }}
          onCancel={() => setConfirmDiscard(false)}
        />
      </View>
    );
  }

  return (
    <View style={styles.cameraScreen} testID="camera-view">
      {header}
      <CameraView ref={camera} style={styles.camera} facing="back" />
      <SafeAreaView edges={['bottom']} style={styles.cameraActions}>
        {error ? (
          <Text
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            style={styles.error}
            accessibilityRole="alert"
            testID="evidence-error"
          >
            {error}
          </Text>
        ) : null}
        <Pressable
          onPress={() => void capture()}
          disabled={capturing}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          accessibilityState={{ busy: capturing }}
          testID="shutter"
          style={styles.shutter}
        >
          {capturing ? <ActivityIndicator color={colors.textPrimary} /> : null}
        </Pressable>
        <Button label="Close" variant="ghost" onPress={close} testID="close-camera" />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: layout.screenPadding,
    backgroundColor: colors.background,
  },
  permissionTitle: { ...typography.sectionTitle, color: colors.textPrimary, textAlign: 'center' },
  permissionBody: { ...typography.body, color: colors.textSecondary, textAlign: 'center' },
  cameraScreen: { flex: 1, backgroundColor: '#000000' },
  camera: { flex: 1 },
  cameraActions: { alignItems: 'center', gap: spacing.md, padding: layout.screenPadding },
  shutter: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewScreen: { flex: 1, backgroundColor: '#000000' },
  preview: { flex: 1 },
  previewActions: {
    padding: layout.screenPadding,
    gap: spacing.sm,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowButton: { flex: 1 },
  progressBlock: { gap: spacing.xs },
  progressText: { ...typography.secondary, color: colors.textSecondary },
  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: colors.primary },
  error: { ...typography.secondary, color: colors.errorText },
  offline: { ...typography.secondary, color: colors.textSecondary },
});
