import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
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

export type Point = { latitude: number; longitude: number };

/**
 * Leaflet with OpenStreetMap tiles inside a web view: free, no API key, and it
 * runs in Expo Go. The OSM tile policy requires the attribution Leaflet shows,
 * and forbids bulk or offline tile fetching, which this never does.
 *
 * The pin is fixed to the centre and the map moves underneath it. Dragging a
 * marker meant aiming at a 25x41px icon inside a web view nested in the form's
 * scroll view, so the form scrolled instead of the pin moving. Panning a
 * full-screen map is a whole-screen target and cannot be stolen by a parent.
 */

/** A still map for the form: every gesture belongs to the form, not the map. */
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
  const html = staticMapHtml(latitude, longitude);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Adjust the pin on a map"
      testID={testID}
      style={[styles.preview, { height }]}
    >
      {/* The map takes no touches at all, so a drag here scrolls the form. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <WebView
          key={`${latitude},${longitude}`}
          originWhitelist={['*']}
          source={{ html }}
          style={styles.web}
          javaScriptEnabled
          scrollEnabled={false}
        />
      </View>

      <View style={styles.previewBadge} pointerEvents="none">
        <Icon name="move-outline" size={15} color={colors.textOnInverse} />
        <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.previewBadgeText}>
          Tap to adjust
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

  // Reopening starts from wherever the pin actually is now.
  useEffect(() => {
    if (visible) setDraft({ latitude, longitude });
  }, [visible, latitude, longitude]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modal} testID={testID}>
        <WebView
          // A fresh map each time it opens, centred on the current pin.
          key={visible ? `${latitude},${longitude}` : 'closed'}
          originWhitelist={['*']}
          source={{ html: interactiveMapHtml(latitude, longitude) }}
          style={styles.web}
          javaScriptEnabled
          onMessage={(event) => {
            try {
              const point = JSON.parse(event.nativeEvent.data) as Partial<Point>;
              if (typeof point.latitude === 'number' && typeof point.longitude === 'number') {
                setDraft({
                  latitude: Number(point.latitude.toFixed(6)),
                  longitude: Number(point.longitude.toFixed(6)),
                });
              }
            } catch {
              // Ignore anything that is not a point.
            }
          }}
        />

        <SafeAreaView edges={['top']} style={styles.modalHeader} pointerEvents="box-none">
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
              Move the map to place the pin
            </Text>
          </View>
        </SafeAreaView>

        <SafeAreaView edges={['bottom']} style={styles.modalFooter}>
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
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const TILE_LAYER = `L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
})`;

function staticMapHtml(latitude: number, longitude: number): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { margin: 0; padding: 0; height: 100%; background: #EFF1F5; }
      .leaflet-control-attribution { font-size: 9px; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var map = L.map('map', {
        dragging: false, touchZoom: false, scrollWheelZoom: false,
        doubleClickZoom: false, boxZoom: false, keyboard: false, zoomControl: false
      }).setView([${latitude}, ${longitude}], 16);
      ${TILE_LAYER}.addTo(map);
      L.marker([${latitude}, ${longitude}]).addTo(map);
    </script>
  </body>
</html>`;
}

function interactiveMapHtml(latitude: number, longitude: number): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { margin: 0; padding: 0; height: 100%; background: #EFF1F5; }
      .leaflet-control-attribution { font-size: 10px; }
      .leaflet-control-zoom { margin-bottom: 128px !important; }
      #pin {
        position: absolute; left: 50%; top: 50%;
        margin-left: -19px; margin-top: -44px;
        width: 38px; height: 44px;
        pointer-events: none; z-index: 500;
        transition: transform 140ms ease-out;
      }
      #pin.lifted { transform: translateY(-10px); }
      #shadow {
        position: absolute; left: 50%; top: 50%;
        margin-left: -7px; margin-top: -3px;
        width: 14px; height: 6px; border-radius: 50%;
        background: rgba(14, 17, 22, 0.35);
        pointer-events: none; z-index: 499;
        transition: transform 140ms ease-out;
      }
      #shadow.lifted { transform: scale(0.6); }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <div id="shadow"></div>
    <svg id="pin" viewBox="0 0 38 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19 43C19 43 34 27.5 34 17A15 15 0 1 0 4 17C4 27.5 19 43 19 43Z" fill="#CE2E48" stroke="#FFFFFF" stroke-width="3"/>
      <circle cx="19" cy="17" r="5.5" fill="#FFFFFF"/>
    </svg>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var map = L.map('map', { zoomControl: true }).setView([${latitude}, ${longitude}], 17);
      ${TILE_LAYER}.addTo(map);

      var pin = document.getElementById('pin');
      var shadow = document.getElementById('shadow');

      function lift(on) {
        pin.classList.toggle('lifted', on);
        shadow.classList.toggle('lifted', on);
      }

      function report() {
        var centre = map.getCenter();
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ latitude: centre.lat, longitude: centre.lng })
        );
      }

      map.on('movestart', function () { lift(true); });
      map.on('moveend', function () { lift(false); report(); });
      // Tapping somewhere brings that spot under the pin.
      map.on('click', function (event) { map.panTo(event.latlng); });

      report();
    </script>
  </body>
</html>`;
}

const styles = StyleSheet.create({
  preview: {
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    padding: spacing.sm,
  },
  web: { flex: 1, backgroundColor: colors.surfaceMuted },
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
