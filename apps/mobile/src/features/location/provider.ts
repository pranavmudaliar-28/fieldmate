/**
 * Address search, behind one small interface.
 *
 * The app talks only to this type, so moving from the free OpenStreetMap
 * services to Google (or anything else) is a swap of the implementation
 * below, not a change to the screens (docs/07 §1).
 */
export type PlaceSuggestion = {
  /** Stable within a result set; used as a list key. */
  id: string;
  /** One-line address, ready to store. */
  address: string;
  /** Short leading part, shown in bold in the list. */
  primary: string;
  /** The rest of the address, shown underneath. */
  secondary: string;
  latitude: number;
  longitude: number;
};

export type LocationProvider = {
  name: string;
  /** Suggestions for what the manager has typed so far. */
  search(query: string, signal?: AbortSignal): Promise<PlaceSuggestion[]>;
  /** The address at a point, after the pin is dragged. */
  reverse(latitude: number, longitude: number, signal?: AbortSignal): Promise<string | null>;
};

export type PhotonFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: Record<string, string | undefined> & { extent?: unknown };
};

/** Builds "Name, Street, District, City, Postcode, Country" from Photon's parts. */
export function formatPhotonFeature(feature: PhotonFeature): {
  address: string;
  primary: string;
  secondary: string;
} {
  const p = feature.properties ?? {};
  const houseAndStreet = [p.housenumber, p.street].filter(Boolean).join(' ');

  const parts = [
    p.name,
    houseAndStreet || undefined,
    p.district,
    p.city ?? p.town ?? p.village,
    p.state,
    p.postcode,
    p.country,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  // The same value can appear as both name and city; keep the first occurrence.
  const unique = parts.filter((part, index) => parts.indexOf(part) === index);

  return {
    address: unique.join(', '),
    primary: unique[0] ?? '',
    secondary: unique.slice(1).join(', '),
  };
}
