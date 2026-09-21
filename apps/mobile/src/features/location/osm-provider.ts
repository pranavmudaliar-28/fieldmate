import { formatPhotonFeature, type LocationProvider, type PhotonFeature } from './provider';

const PHOTON_URL = 'https://photon.komoot.io/api';
const PHOTON_REVERSE_URL = 'https://photon.komoot.io/reverse';
const RESULT_LIMIT = 6;

/** Identifies the app to the free services, as their policies require. */
const USER_AGENT = 'FieldMate/0.1 (field task management; contact: team@slasheasy.com)';

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(`Search failed with status ${response.status}`);
  return response.json();
}

/**
 * Photon (OpenStreetMap data) — free, no key, and built for type-ahead search.
 * It is a best-effort public service, so callers must handle failure by letting
 * the manager type an address instead (docs/07 §1).
 */
export function createOsmLocationProvider(): LocationProvider {
  return {
    name: 'OpenStreetMap (Photon)',

    async search(query, signal) {
      const trimmed = query.trim();
      if (trimmed.length < 3) return [];

      const url = `${PHOTON_URL}?q=${encodeURIComponent(trimmed)}&limit=${RESULT_LIMIT}`;
      const payload = (await getJson(url, signal)) as { features?: PhotonFeature[] };

      return (payload.features ?? [])
        .map((feature, index) => {
          const coordinates = feature.geometry?.coordinates;
          if (!coordinates || coordinates.length < 2) return null;

          const [longitude, latitude] = coordinates;
          const { address, primary, secondary } = formatPhotonFeature(feature);
          if (!address) return null;

          return {
            id: `${latitude},${longitude},${index}`,
            address,
            primary,
            secondary,
            latitude: Number(latitude.toFixed(6)),
            longitude: Number(longitude.toFixed(6)),
          };
        })
        .filter((suggestion): suggestion is NonNullable<typeof suggestion> => suggestion !== null);
    },

    async reverse(latitude, longitude, signal) {
      const url = `${PHOTON_REVERSE_URL}?lat=${latitude}&lon=${longitude}`;
      const payload = (await getJson(url, signal)) as { features?: PhotonFeature[] };
      const feature = payload.features?.[0];
      if (!feature) return null;
      return formatPhotonFeature(feature).address || null;
    },
  };
}
