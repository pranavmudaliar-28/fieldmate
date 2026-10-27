import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/**
 * Network availability for the offline states (docs/02 §8, docs/04 §6).
 * Starts as online so the UI is never blocked before the first reading.
 */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      // On web NetInfo probes with `HEAD /` against the page's own server, which
      // fails or times out on a dev server mid-bundle; `navigator.onLine` is enough.
      const reachable = Platform.OS === 'web' ? true : state.isInternetReachable;
      setIsOnline(Boolean(state.isConnected) && reachable !== false);
    });
  }, []);

  return isOnline;
}
