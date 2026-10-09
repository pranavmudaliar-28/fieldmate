import { Linking, Platform } from 'react-native';

export type Coordinates = { latitude: number; longitude: number };

/** Hands the address to the device's own maps app; no map SDK is bundled. */
export function openInMaps(address: string, coordinates: Coordinates | null): void {
  const query = coordinates ? `${coordinates.latitude},${coordinates.longitude}` : address;
  const web = `https://maps.google.com/?q=${encodeURIComponent(query)}`;

  /*
   * A browser has no maps app to hand off to, and the fallback below cannot
   * rescue it: on web `Linking.openURL` wraps `window.open`, which does not
   * throw on a scheme it cannot handle, so the promise resolves and a `geo:`
   * URL opens a blank tab instead. The web URL has to be chosen up front.
   */
  if (Platform.OS === 'web') {
    void Linking.openURL(web);
    return;
  }

  const url =
    Platform.OS === 'ios'
      ? `maps://?q=${encodeURIComponent(address)}&ll=${encodeURIComponent(query)}`
      : `geo:0,0?q=${encodeURIComponent(coordinates ? `${query}(${address})` : address)}`;

  void Linking.openURL(url).catch(() => {
    void Linking.openURL(web);
  });
}
