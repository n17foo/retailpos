import { useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  handler: () => void;
  description?: string;
}

/**
 * Hook that registers keyboard shortcuts for desktop/Electron/web environments.
 * No-op on native mobile platforms (iOS/Android).
 *
 * Intentionally active on both Electron and browser — the POS can be used
 * from a browser tab on a desktop machine. If you need Electron-only shortcuts,
 * gate the `enabled` parameter with `usePlatform().isElectron`.
 */
export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[], enabled: boolean = true) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      for (const shortcut of shortcuts) {
        const ctrlOrMeta = shortcut.ctrl || shortcut.meta;
        const hasModifier = ctrlOrMeta ? e.metaKey || e.ctrlKey : true;
        const hasShift = shortcut.shift ? e.shiftKey : true;
        const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();

        if (keyMatch && hasModifier && hasShift) {
          e.preventDefault();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    // Keyboard events only exist on web (Electron + browser). No-op on native.
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};
