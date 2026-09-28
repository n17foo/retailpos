import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { AUTO_LOCK_TIMEOUT_MS } from '../services/config/POSConfigService';

const CHECK_INTERVAL_MS = 10_000;

/**
 * Locks an authenticated session after a period without user interaction.
 *
 * Returns a callback that must be invoked on user activity (touch capture).
 * On web/Electron, keyboard input (including HID barcode scanners) also counts
 * as activity. Time spent in the background counts towards the idle period, so
 * returning to an unattended register after the timeout requires re-login.
 */
export const useInactivityLock = (isAuthenticated: boolean, onLock: () => void): (() => void) => {
  const lastActivityRef = useRef(Date.now());
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  const registerActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    lastActivityRef.current = Date.now();

    const checkIdle = () => {
      const timeoutMs = AUTO_LOCK_TIMEOUT_MS();
      if (timeoutMs > 0 && Date.now() - lastActivityRef.current >= timeoutMs) {
        onLockRef.current();
      }
    };

    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS);
    const appStateSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') checkIdle();
    });

    const keyTarget = Platform.OS === 'web' && typeof document !== 'undefined' ? document : null;
    keyTarget?.addEventListener('keydown', registerActivity);

    return () => {
      clearInterval(interval);
      appStateSubscription.remove();
      keyTarget?.removeEventListener('keydown', registerActivity);
    };
  }, [isAuthenticated, registerActivity]);

  return registerActivity;
};
