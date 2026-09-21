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
import { Icon } from './Icon';

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
                  hitSlop={12}
                  style={styles.delete}
                >
                  <Icon name="trash-outline" size={16} color={colors.onPrimary} />
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

const THUMBNAIL = 98;

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.smPlus },
  cell: { width: THUMBNAIL, height: THUMBNAIL },
  thumbnailWrapper: { borderRadius: radius.card, overflow: 'hidden' },
  thumbnail: { width: THUMBNAIL, height: THUMBNAIL, backgroundColor: colors.surfaceMuted },
  /** Sits on the photo: a caption row under every tile made the grid unreadable. */
  delete: {
    position: 'absolute',
    top: spacing.xs + 2,
    right: spacing.xs + 2,
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.scrim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { ...typography.secondary, color: colors.textSecondary },
  viewer: { flex: 1, backgroundColor: colors.mediaBackdrop },
  fullImage: { flex: 1 },
  viewerBar: {
    padding: layout.screenPadding,
    gap: spacing.smPlus,
    backgroundColor: colors.surface,
  },
  viewerCaption: { ...typography.secondary, color: colors.textSecondary },
});
