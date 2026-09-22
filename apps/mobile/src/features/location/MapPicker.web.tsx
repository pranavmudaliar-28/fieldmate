import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Icon } from '../../components/Icon';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  elevation,
  layout,
  radius,
  spacing,
  tabularNumbers,
  typography,
} from '../../constants/theme';
import { interactiveMapHtml, staticMapHtml } from './map-html';

export type Point = { latitude: number; longitude: number };

/**
 * The browser build of the map picker.
 *
 * `react-native-webview` has no web implementation — it renders "React Native
 * WebView does not support this platform" — so the same Leaflet document is
 * embedded in an iframe instead, and the map talks back with `postMessage`
 * rather than the web view bridge. The behaviour is identical: the pin is fixed
 * to the centre and the map moves underneath it.
 */

/** A still map for the form. `pointer-events: none` keeps scrolling with the page. */
export function MapPreview({
  latitude,
  longitude,
  onPress,
  height = 168,
  testID,
}: {
  latitude: number;
  longitude: number;
  onPress: () => void;
  height?: number;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Adjust the pin on a map"
      testID={testID}
      style={[styles.preview, { height }]}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <iframe
          key={`${latitude},${longitude}`}
          title="Map preview"
          srcDoc={staticMapHtml(latitude, longitude)}
          style={IFRAME_STYLE}
          scrolling="no"
        />
      </View>

      <View style={styles.previewBadge} pointerEvents="none">
        <Icon name="move-outline" size={15} color={colors.textOnInverse} />
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.previewBadgeText}>
          Click to adjust
        </Text>
      </View>
    </Pressable>
  );
}

/** Full-screen picker: drag the map, the pin stays in the middle. */
export function MapPickerModal({
  visible,
  latitude,
  longitude,
  onConfirm,
  onClose,
  testID,
}: {
  visible: boolean;
  latitude: number;
  longitude: number;
  onConfirm: (point: Point) => void;
  onClose: () => void;
  testID?: string;
}) {
  const [draft, setDraft] = useState<Point>({ latitude, longitude });

  useEffect(() => {
    if (visible) setDraft({ latitude, longitude });
  }, [visible, latitude, longitude]);

  // The iframe reports its centre as it moves.
  useEffect(() => {
    if (!visible) return;

    const onMessage = (event: MessageEvent) => {
      // Only same-origin frames: the map is inlined, so it has our origin.
      if (event.origin !== 'null' && event.origin !== globalThis.location?.origin) return;
      try {
        const point = JSON.parse(String(event.data)) as Partial<Point>;
        if (typeof point.latitude === 'number' && typeof point.longitude === 'number') {
          setDraft({
            latitude: Number(point.latitude.toFixed(6)),
            longitude: Number(point.longitude.toFixed(6)),
          });
        }
      } catch {
        // Ignore anything that is not a point.
      }
    };

    globalThis.addEventListener('message', onMessage);
    return () => globalThis.removeEventListener('message', onMessage);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={styles.modal} testID={testID}>
        <iframe
          key={visible ? `${latitude},${longitude}` : 'closed'}
          title="Choose a location"
          srcDoc={interactiveMapHtml(latitude, longitude)}
          style={IFRAME_STYLE}
        />

        <View style={styles.modalHeader} pointerEvents="box-none">
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close map"
            testID="map-close"
            style={styles.circleButton}
          >
            <Icon name="close" size={22} color={colors.textPrimary} />
          </Pressable>
          <View style={styles.hint} pointerEvents="none">
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.hintText}>
              Drag the map to place the pin
            </Text>
          </View>
        </View>

        <View style={styles.modalFooter}>
          <View style={styles.coordinates}>
            <Icon name="location" size={16} color={colors.textSecondary} />
            <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.coordinatesText}>
              {draft.latitude.toFixed(6)}, {draft.longitude.toFixed(6)}
            </Text>
          </View>
          <Button
            label="Use this location"
            icon="checkmark"
            testID="map-confirm"
            onPress={() => onConfirm(draft)}
          />
        </View>
      </View>
    </Modal>
  );
}

const IFRAME_STYLE = { width: '100%', height: '100%', border: 'none' } as const;

const styles = StyleSheet.create({
  preview: {
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: spacing.sm,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.smPlus,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceInverse,
  },
  previewBadgeText: { ...typography.caption, color: colors.textOnInverse },
  modal: { flex: 1, backgroundColor: colors.surfaceMuted },
  modalHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smPlus,
    padding: layout.screenPadding,
  },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.floating,
  },
  hint: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceInverse,
  },
  hintText: { ...typography.caption, color: colors.textOnInverse },
  modalFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    padding: layout.screenPadding,
    gap: spacing.smPlus,
    ...elevation.overlay,
  },
  coordinates: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  coordinatesText: { ...typography.caption, ...tabularNumbers, color: colors.textSecondary },
});
