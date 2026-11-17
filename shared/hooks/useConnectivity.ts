import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * True while the device reports no network connectivity at all
 * (`isConnected === false`). Deliberately ignores `isInternetReachable` —
 * the reachability probe produces false negatives on segmented VLANs and
 * captive networks where payment processors are still reachable.
 */
export const useOffline = (): boolean => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(state.isConnected === false);
    });
    NetInfo.fetch()
      .then(state => setIsOffline(state.isConnected === false))
      .catch(() => undefined);
    return unsubscribe;
  }, []);

  return isOffline;
};
