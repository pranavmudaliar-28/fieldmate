/**
 * The MapLibre GL documents the map is built from, shared by the native web
 * view and the browser iframe so both show exactly the same map.
 *
 * The basemap is CARTO's Positron vector style, the same default mapcn uses:
 * no API key, and MapLibre renders the CARTO and OpenStreetMap attribution the
 * style asks for. shortcut: CARTO's free basemaps are licensed for limited
 * use; move to a keyed or self-hosted style before heavy commercial traffic.
 */

const MAPLIBRE = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl';
const STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';
const PIN_COLOUR = '#CE2E48';

const HEAD = `<link rel="stylesheet" href="${MAPLIBRE}.css" />
    <script src="${MAPLIBRE}.js"></script>`;

export function staticMapHtml(latitude: number, longitude: number): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    ${HEAD}
    <style>
      html, body, #map { margin: 0; padding: 0; height: 100%; background: #EFF1F5; }
      .maplibregl-ctrl-attrib { font-size: 9px; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      var map = new maplibregl.Map({
        container: 'map', style: '${STYLE}', interactive: false,
        center: [${longitude}, ${latitude}], zoom: 16
      });
      new maplibregl.Marker({ color: '${PIN_COLOUR}' })
        .setLngLat([${longitude}, ${latitude}]).addTo(map);
    </script>
  </body>
</html>`;
}

export function interactiveMapHtml(latitude: number, longitude: number): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    ${HEAD}
    <style>
      html, body, #map { margin: 0; padding: 0; height: 100%; background: #EFF1F5; }
      .maplibregl-ctrl-attrib { font-size: 10px; }
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
      <path d="M19 43C19 43 34 27.5 34 17A15 15 0 1 0 4 17C4 27.5 19 43 19 43Z" fill="${PIN_COLOUR}" stroke="#FFFFFF" stroke-width="3"/>
      <circle cx="19" cy="17" r="5.5" fill="#FFFFFF"/>
    </svg>
    <script>
      var map = new maplibregl.Map({
        container: 'map', style: '${STYLE}',
        center: [${longitude}, ${latitude}], zoom: 17,
        // A flat map: tilting would put the pin over a different spot than it seems.
        pitchWithRotate: false, dragRotate: false
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

      var pin = document.getElementById('pin');
      var shadow = document.getElementById('shadow');

      function lift(on) {
        pin.classList.toggle('lifted', on);
        shadow.classList.toggle('lifted', on);
      }

      // Native embeds this in a web view, the browser in an iframe.
      function report() {
        var centre = map.getCenter();
        var payload = JSON.stringify({ latitude: centre.lat, longitude: centre.lng });
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(payload);
        else if (window.parent !== window) window.parent.postMessage(payload, '*');
      }

      map.on('movestart', function () { lift(true); });
      map.on('moveend', function () { lift(false); report(); });
      // Tapping somewhere brings that spot under the pin.
      map.on('click', function (event) { map.panTo(event.lngLat); });

      report();
    </script>
  </body>
</html>`;
}
