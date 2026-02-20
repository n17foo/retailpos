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
 * No-op on native mobile platforms.
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
    // Only register on web/desktop
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};
