import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import {
  LOCATION_DENIED_MESSAGE,
  LOCATION_ERROR_MESSAGE,
  openInMaps,
  useCurrentLocation,
} from './use-current-location';

jest.mock('expo-location');

const location = Location as jest.Mocked<typeof Location>;

const permission = (granted: boolean) =>
  ({
    granted,
    status: granted ? 'granted' : 'denied',
  }) as unknown as Location.LocationPermissionResponse;

const position = (latitude: number, longitude: number) =>
  ({ coords: { latitude, longitude } }) as Location.LocationObject;

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  jest.spyOn(Linking, 'openSettings').mockResolvedValue();
});

describe('useCurrentLocation', () => {
  it('returns rounded coordinates when permission is granted', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue(permission(true));
    location.getCurrentPositionAsync.mockResolvedValue(position(-33.86881234, 151.20931234));

    const { result } = await renderHook(() => useCurrentLocation());
    let coords: unknown;
    await act(async () => {
      coords = await result.current.capture();
    });

    expect(coords).toEqual({ latitude: -33.868812, longitude: 151.209312 });
    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.message).toBeNull();
  });

  it('explains a denied permission without blocking the address field', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue(permission(false));

    const { result } = await renderHook(() => useCurrentLocation());
    let coords: unknown;
    await act(async () => {
      coords = await result.current.capture();
    });

    expect(coords).toBeNull();
    await waitFor(() => expect(result.current.status).toBe('denied'));
    expect(result.current.message).toBe(LOCATION_DENIED_MESSAGE);
    expect(location.getCurrentPositionAsync).not.toHaveBeenCalled();
  });

  it('reports a lookup failure', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValue(permission(true));
    location.getCurrentPositionAsync.mockRejectedValue(new Error('no signal'));

    const { result } = await renderHook(() => useCurrentLocation());
    await act(async () => {
      await result.current.capture();
    });

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.message).toBe(LOCATION_ERROR_MESSAGE);
  });

  it('opens system settings when asked', async () => {
    const { result } = await renderHook(() => useCurrentLocation());
    act(() => result.current.openSettings());
    expect(Linking.openSettings).toHaveBeenCalled();
  });
});

describe('openInMaps', () => {
  it('hands coordinates to the Android maps app', () => {
    Platform.OS = 'android';
    openInMaps('14 Harbour Rd', { latitude: -33.8688, longitude: 151.2093 });

    const url = (Linking.openURL as jest.Mock).mock.calls[0]?.[0] as string;
    expect(url.startsWith('geo:')).toBe(true);
    expect(decodeURIComponent(url)).toContain('-33.8688,151.2093');
    expect(decodeURIComponent(url)).toContain('14 Harbour Rd');
  });

  it('falls back to the address when there are no coordinates', () => {
    Platform.OS = 'android';
    openInMaps('14 Harbour Rd', null);

    const url = (Linking.openURL as jest.Mock).mock.calls[0]?.[0] as string;
    expect(decodeURIComponent(url)).toContain('14 Harbour Rd');
  });

  it('uses the Apple Maps scheme on iOS', () => {
    Platform.OS = 'ios';
    openInMaps('14 Harbour Rd', { latitude: 1, longitude: 2 });

    const url = (Linking.openURL as jest.Mock).mock.calls[0]?.[0] as string;
    expect(url.startsWith('maps://')).toBe(true);
  });
});
