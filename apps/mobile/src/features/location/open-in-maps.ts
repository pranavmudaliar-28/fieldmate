import { Linking, Platform } from 'react-native';

export type Coordinates = { latitude: number; longitude: number };

/** Hands the address to the device's own maps app; no map SDK is bundled. */
export function openInMaps(address: string, coordinates: Coordinates | null): void {
  const query = coordinates ? `${coordinates.latitude},${coordinates.longitude}` : address;
  const url =
    Platform.OS === 'ios'
      ? `maps://?q=${encodeURIComponent(address)}&ll=${encodeURIComponent(query)}`
      : `geo:0,0?q=${encodeURIComponent(coordinates ? `${query}(${address})` : address)}`;

  void Linking.openURL(url).catch(() => {
    void Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(query)}`);
  });
}
