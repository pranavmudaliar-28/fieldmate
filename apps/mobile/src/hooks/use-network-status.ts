import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * Network availability for the offline states (docs/02 §8, docs/04 §6).
 * Starts as online so the UI is never blocked before the first reading.
 */
export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      const reachable = state.isInternetReachable;
      setIsOnline(Boolean(state.isConnected) && reachable !== false);
    });
  }, []);

  return isOnline;
}
