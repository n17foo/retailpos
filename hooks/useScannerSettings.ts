import { useState, useCallback, useEffect } from 'react';
import { keyValueRepository } from '../repositories/KeyValueRepository';
import { useLogger } from '../hooks/useLogger';

export interface ScannerSettings {
  enabled: boolean;
  type: string;
  deviceId: string;
}

const SCANNER_SETTINGS_KEY = 'scannerSettings';

const DEFAULT_SCANNER_SETTINGS: ScannerSettings = {
  enabled: false,
  type: 'bluetooth',
  deviceId: '',
};

export const useScannerSettings = () => {
  const [scannerSettings, setScannerSettings] = useState<ScannerSettings>(DEFAULT_SCANNER_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved');
  const logger = useLogger('useScannerSettings');

  // Load scanner settings from storage
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const savedSettings = await keyValueRepository.getObject<ScannerSettings>(SCANNER_SETTINGS_KEY);
      if (savedSettings) {
        setScannerSettings({ ...DEFAULT_SCANNER_SETTINGS, ...savedSettings });
      }
      return true;
    } catch (err) {
      const errorMessage = 'Failed to load scanner settings';
      setError(errorMessage);
      logger.error({ message: errorMessage }, err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save scanner settings to storage
  const saveSettings = useCallback(async (settings: ScannerSettings) => {
    try {
      setSaveStatus('saving');
      await keyValueRepository.setItem(SCANNER_SETTINGS_KEY, settings);
      setScannerSettings(settings);
      setSaveStatus('saved');
      logger.info('Scanner settings saved successfully');
      return true;
    } catch (err) {
      const errorMessage = 'Failed to save scanner settings';
      setError(errorMessage);
      setSaveStatus('error');
      logger.error({ message: errorMessage }, err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }, []);

  // Handle scanner settings change
  const handleScannerSettingsChange = useCallback((settings: Partial<ScannerSettings>) => {
    setScannerSettings(prev => ({
      ...prev,
      ...settings,
    }));
    setSaveStatus('unsaved');
  }, []);

  // Test scanner connection
  const testConnection = useCallback(async (settings: ScannerSettings) => {
    try {
      // TODO: Implement actual scanner connection test
      // This is a placeholder implementation
      await new Promise(resolve => setTimeout(resolve, 1000));
      logger.info('Scanner connection test completed successfully');
      return true;
    } catch (err) {
      logger.error({ message: 'Error testing scanner connection' }, err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    scannerSettings,
    handleScannerSettingsChange,
    saveSettings,
    testConnection,
    loadSettings,
    isLoading,
    error,
    saveStatus,
  };
};
