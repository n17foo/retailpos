import { useEffect, useState } from 'react';
import { storeApiHealthService, LanState } from '../services/StoreApiHealthService';

/**
 * React binding for LAN health — `degraded` means the in-store server is
 * unreachable; the register keeps selling on last-known caches and queues
 * orders for upload on recovery.
 */
export const useStoreApiHealth = () => {
  const [lanState, setLanState] = useState<LanState>(storeApiHealthService.lanState);

  useEffect(() => storeApiHealthService.onStateChange(setLanState), []);

  return { lanState, isDegraded: lanState === 'degraded' };
};
