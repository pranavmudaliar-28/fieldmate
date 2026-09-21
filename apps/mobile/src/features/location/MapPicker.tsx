import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import {
  MAX_FONT_SIZE_MULTIPLIER,
  colors,
  radius,
  spacing,
  typography,
} from '../../constants/theme';

export type MapPickerProps = {
  latitude: number;
  longitude: number;
  /** Fired after the pin is dropped or dragged. */
  onMove: (coordinates: { latitude: number; longitude: number }) => void;
  height?: number;
  testID?: string;
};

/**
 * Leaflet with OpenStreetMap tiles inside a web view: free, no API key, and it
 * runs in Expo Go. The OSM tile policy requires the attribution shown by
 * Leaflet, and forbids bulk or offline tile fetching, which this never does.
 */
export function MapPicker({ latitude, longitude, onMove, height = 220, testID }: MapPickerProps) {
  const webView = useRef<WebView>(null);
  // Built once: changing the source would reload the map and lose the zoom and pan.
  const html = useRef(mapHtml(latitude, longitude)).current;
  // What the map itself last showed, so a move it reported is not sent back to it.
  const shown = useRef({ latitude, longitude });

  useEffect(() => {
    if (shown.current.latitude === latitude && shown.current.longitude === longitude) return;
    shown.current = { latitude, longitude };
    webView.current?.injectJavaScript(`moveTo(${latitude}, ${longitude}); true;`);
  }, [latitude, longitude]);

  return (
    <View style={[styles.container, { height }]} testID={testID}>
      <WebView
        ref={webView}
        originWhitelist={['*']}
        source={{ html }}
        style={styles.web}
        javaScriptEnabled
        // The map only needs to talk back to us; nothing else is loaded.
        onMessage={(event) => {
          try {
            const point = JSON.parse(event.nativeEvent.data) as {
              latitude: number;
              longitude: number;
            };
            if (typeof point.latitude === 'number' && typeof point.longitude === 'number') {
              const moved = {
                latitude: Number(point.latitude.toFixed(6)),
                longitude: Number(point.longitude.toFixed(6)),
              };
              shown.current = moved;
              onMove(moved);
            }
          } catch {
            // Ignore anything that is not a point.
          }
        }}
      />
      <Text maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER} style={styles.hint}>
        Drag the pin, or tap the map, to correct the exact spot.
      </Text>
    </View>
  );
}

function mapHtml(latitude: number, longitude: number): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { margin: 0; padding: 0; height: 100%; }
      .leaflet-control-attribution { font-size: 10px; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      var map = L.map('map').setView([${latitude}, ${longitude}], 16);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      var marker = L.marker([${latitude}, ${longitude}], { draggable: true }).addTo(map);

      function report(point) {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ latitude: point.lat, longitude: point.lng })
        );
      }

      function moveTo(lat, lng) {
        marker.setLatLng([lat, lng]);
        map.setView([lat, lng], map.getZoom());
      }

      marker.on('dragend', function () { report(marker.getLatLng()); });
      map.on('click', function (event) {
        marker.setLatLng(event.latlng);
        report(event.latlng);
      });
    </script>
  </body>
</html>`;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  web: { flex: 1, backgroundColor: colors.surfaceMuted },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    padding: spacing.xs,
    backgroundColor: colors.surface,
  },
});
