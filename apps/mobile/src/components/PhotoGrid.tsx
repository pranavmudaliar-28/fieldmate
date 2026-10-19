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

const COLUMNS = 3;
const GAP = spacing.sm;

export function PhotoGrid({ photos, onDelete, currentUserId }: PhotoGridProps) {
  const [viewing, setViewing] = useState<Evidence | null>(null);
  // Measured rather than a percentage: three percentage widths plus two gaps
  // came to a fraction of a point over the width on most phones, and the
  // third photo wrapped onto the next row.
  const [cellSize, setCellSize] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.empty}>
        No photos yet.
      </Text>
    );
  }

  return (
    <>
      <View
        style={styles.grid}
        onLayout={(event) => {
          const width = event.nativeEvent.layout.width;
          setCellSize(Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS));
        }}
      >
        {photos.map((photo) => {
          const mine = currentUserId !== undefined && photo.uploadedBy.id === currentUserId;
          const picked = photo.source === 'GALLERY';
          // Said in the label, not only shown as a corner mark: whether a
          // photo was taken at the job is the point of the record.
          const caption = `${picked ? 'Photo from the gallery' : 'Photo'} by ${
            mine ? 'you' : photo.uploadedBy.name
          }, ${formatDateTime(photo.createdAt)}`;
          return (
            <View
              key={photo.id}
              style={[styles.cell, cellSize === null ? styles.cellUnmeasured : { width: cellSize }]}
            >
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
              <View
                style={styles.sourceMark}
                pointerEvents="none"
                {...(picked ? { testID: `gallery-${photo.id}` } : {})}
              >
                <Icon
                  name={picked ? 'image-outline' : 'camera-outline'}
                  size={14}
                  color={colors.textOnInverse}
                />
                <Text maxFontSizeMultiplier={1.2} style={styles.sourceText}>
                  {picked ? 'Gallery' : 'Camera'}
                </Text>
              </View>
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

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  /** Three across, whatever the width of the card holding them. */
  cell: { aspectRatio: 1 },
  /** Before the first layout pass: safely under a third, so nothing wraps. */
  cellUnmeasured: { width: '30%' },
  thumbnailWrapper: { flex: 1, borderRadius: radius.action, overflow: 'hidden' },
  thumbnail: { width: '100%', height: '100%', backgroundColor: colors.surfaceMuted },
  /**
   * Says where every photo came from, on the photo: a caption row under each
   * tile made the grid unreadable (docs/02 F-006).
   */
  sourceMark: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(15, 17, 21, 0.78)',
  },
  sourceText: {
    ...typography.caption,
    fontFamily: typography.secondaryStrong.fontFamily,
    color: colors.textOnInverse,
  },
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
