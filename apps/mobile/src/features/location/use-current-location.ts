import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';
import { useState } from 'react';

export type Coordinates = { latitude: number; longitude: number };

export type LocationStatus = 'idle' | 'loading' | 'denied' | 'error';

export const LOCATION_DENIED_MESSAGE = 'Location access is off. You can still type the address.';
export const LOCATION_ERROR_MESSAGE = "Couldn't get your location. Try again or type the address.";

/**
 * "Use current location" on Create Task (F-005). The coordinates are a
 * reference only; the app never verifies where anyone is.
 */
export function useCurrentLocation() {
  const [status, setStatus] = useState<LocationStatus>('idle');

  const capture = async (): Promise<Coordinates | null> => {
    setStatus('loading');
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) {
        setStatus('denied');
        return null;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setStatus('idle');
      return {
        latitude: Number(position.coords.latitude.toFixed(6)),
        longitude: Number(position.coords.longitude.toFixed(6)),
      };
    } catch {
      setStatus('error');
      return null;
    }
  };

  return {
    status,
    capture,
    message:
      status === 'denied'
        ? LOCATION_DENIED_MESSAGE
        : status === 'error'
          ? LOCATION_ERROR_MESSAGE
          : null,
    openSettings: () => void Linking.openSettings(),
  };
}

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
