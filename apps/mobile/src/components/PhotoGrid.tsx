import type { Evidence } from '@fieldmate/shared';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  layout,
  radius,
  spacing,
  typography,
} from '../constants/theme';
import { formatDateTime } from '../utils/format';
import { Button } from './Button';

export type PhotoGridProps = {
  photos: Evidence[];
  /** Set for photos this user may delete (their own, while in progress). */
  onDelete?: (photo: Evidence) => void;
  currentUserId?: string;
};

export function PhotoGrid({ photos, onDelete, currentUserId }: PhotoGridProps) {
  const [viewing, setViewing] = useState<Evidence | null>(null);

  if (photos.length === 0) {
    return (
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.empty}>
        No photos yet.
      </Text>
    );
  }

  return (
    <>
      <View style={styles.grid}>
        {photos.map((photo) => {
          const mine = currentUserId !== undefined && photo.uploadedBy.id === currentUserId;
          const caption = `Photo by ${mine ? 'you' : photo.uploadedBy.name}, ${formatDateTime(photo.createdAt)}`;
          return (
            <View key={photo.id} style={styles.cell}>
              <Pressable
                onPress={() => setViewing(photo)}
                accessibilityRole="imagebutton"
                accessibilityLabel={caption}
                testID={`photo-${photo.id}`}
                style={styles.thumbnailWrapper}
              >
                <Image
                  source={{ uri: photo.url }}
                  style={styles.thumbnail}
                  contentFit="cover"
                  transition={100}
                />
              </Pressable>
              {onDelete && mine ? (
                <Pressable
                  onPress={() => onDelete(photo)}
                  accessibilityRole="button"
                  accessibilityLabel="Delete photo by you"
                  testID={`delete-photo-${photo.id}`}
                  hitSlop={8}
                  style={styles.delete}
                >
                  <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.deleteLabel}>
                    Delete
                  </Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </View>

      <Modal visible={viewing !== null} transparent={false} onRequestClose={() => setViewing(null)}>
        <View style={styles.viewer}>
          {viewing ? (
            <Image source={{ uri: viewing.url }} style={styles.fullImage} contentFit="contain" />
          ) : null}
          <SafeAreaView edges={['bottom']} style={styles.viewerBar}>
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.viewerCaption}>
              {viewing
                ? `Photo by ${viewing.uploadedBy.name} · ${formatDateTime(viewing.createdAt)}`
                : ''}
            </Text>
            <Button label="Close" variant="secondary" onPress={() => setViewing(null)} />
          </SafeAreaView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { gap: spacing.xs },
  thumbnailWrapper: { borderRadius: radius.card, overflow: 'hidden' },
  thumbnail: { width: 96, height: 96, backgroundColor: colors.surfaceMuted },
  delete: { minHeight: layout.minTouchTarget, justifyContent: 'center', alignItems: 'center' },
  deleteLabel: { ...typography.caption, color: colors.errorText },
  empty: { ...typography.caption, color: colors.textSecondary },
  viewer: { flex: 1, backgroundColor: '#000000' },
  fullImage: { flex: 1 },
  viewerBar: { padding: layout.screenPadding, gap: spacing.sm, backgroundColor: colors.surface },
  viewerCaption: { ...typography.secondary, color: colors.textSecondary },
});
