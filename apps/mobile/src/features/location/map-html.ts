/**
 * The Leaflet documents the map is built from, shared by the native web view
 * and the browser iframe so both show exactly the same map.
 *
 * OpenStreetMap tiles are free to use with the attribution Leaflet renders, and
 * the policy forbids bulk or offline fetching, which this never does.
 */

const TILE_LAYER = `L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
})`;

export function staticMapHtml(latitude: number, longitude: number): string {
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

export function interactiveMapHtml(latitude: number, longitude: number): string {
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
      map.on('click', function (event) { map.panTo(event.latlng); });

      report();
    </script>
  </body>
</html>`;
}
