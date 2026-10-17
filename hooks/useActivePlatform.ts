import { useEffect, useState } from 'react';
import { keyValueRepository } from '../repositories/KeyValueRepository';
import { ECommercePlatform } from '../utils/platforms';

/**
 * Resolves the platform whose catalogue the app should show.
 * An explicit platform wins; `undefined` falls back to the persisted e-commerce platform
 * (still undefined = offline/local catalogue); `null` means "not resolved yet, do not fetch".
 * `isResolved` is false until the lookup finishes, so callers never fetch the wrong catalogue first.
 */
export const useActivePlatform = (explicit?: ECommercePlatform | null, refreshKey?: unknown) => {
  const [stored, setStored] = useState<ECommercePlatform | undefined>(undefined);
  const [isLookupDone, setIsLookupDone] = useState(false);

  useEffect(() => {
    // `null` means the caller is still resolving the platform itself; an explicit platform needs no lookup
    if (explicit !== undefined) return;
    let isActive = true;
    keyValueRepository
      .getItem('ecommercePlatform')
      .then(value => {
        if (!isActive) return;
        // A stored platform that is no longer supported (e.g. removed integrations) is ignored
        setStored(value && (Object.values(ECommercePlatform) as string[]).includes(value) ? (value as ECommercePlatform) : undefined);
        setIsLookupDone(true);
      })
      .catch(() => {
        if (isActive) setIsLookupDone(true);
      });
    return () => {
      isActive = false;
    };
  }, [explicit, refreshKey]);

  if (explicit === null) return { platform: undefined, isResolved: false };
  return { platform: explicit ?? stored, isResolved: explicit !== undefined || isLookupDone };
};
