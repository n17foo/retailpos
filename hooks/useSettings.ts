import { useState, useEffect, useCallback } from 'react';
import { KeyValueRepository } from '../repositories/KeyValueRepository';

const settingsRepository = new KeyValueRepository();

const useSettings = () => {
  const [settings, setSettings] = useState<{ [key: string]: any }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const allSettings = await settingsRepository.getAllKeys();
      setSettings(allSettings);
      setError(null);
    } catch (e) {
      setError(e as Error);
      console.error('Failed to fetch settings:', e);
    } finally {
      setLoading(false);
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
      console.error('Failed to update setting:', e);
      // Optionally refetch to revert optimistic update on error
      await fetchSettings();
      throw e;
    }
  };

  return {
    settings,
    loading,
    error,
    fetchSettings,
    getSetting,
    updateSetting,
  };
};

export default useSettings;
