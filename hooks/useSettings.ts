import { useState, useEffect, useCallback } from 'react';
import { KeyValueRepository } from '../repositories/KeyValueRepository';
import { useLogger } from './useLogger';

const settingsRepository = new KeyValueRepository();

export const useSettings = () => {
  const [settings, setSettings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const logger = useLogger('useSettings');

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const allSettings = await settingsRepository.getAllKeys();
      setSettings(allSettings);
      setError(null);
    } catch (e) {
      setError(e as Error);
      logger.error({ message: 'Failed to fetch settings' }, e instanceof Error ? e : new Error(String(e)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const getSetting = useCallback(
    <T>(key: string, defaultValue: T): T => {
      return Object.prototype.hasOwnProperty.call(settings, key) ? (settings[key] as T) : defaultValue;
    },
    [settings]
  );

  const updateSetting = async <T>(key: string, value: T) => {
    try {
      await settingsRepository.setObject(key, value);
      // Optimistically update local state before refetching
      setSettings(prevSettings => ({ ...prevSettings, [key]: value }));
    } catch (e) {
      setError(e as Error);
      logger.error({ message: 'Failed to update setting' }, e instanceof Error ? e : new Error(String(e)));
      // Optionally refetch to revert optimistic update on error
      await fetchSettings();
      throw e;
    }
  };

  return {
    settings,
    isLoading,
    error,
    fetchSettings,
    getSetting,
    updateSetting,
  };
};
