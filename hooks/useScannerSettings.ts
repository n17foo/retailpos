import { useState, useCallback, useEffect } from 'react';
import { keyValueRepository } from '../repositories/KeyValueRepository';
import { ScannerServiceFactory, ScannerType as ScannerTypeEnum } from '../services/scanner/ScannerServiceFactory';
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
  }, [logger]);

  // Save scanner settings to storage
  const saveSettings = useCallback(
    async (settings: ScannerSettings) => {
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
    },
    [logger]
  );

  // Handle scanner settings change
  const handleScannerSettingsChange = useCallback((settings: Partial<ScannerSettings>) => {
    setScannerSettings(prev => ({
      ...prev,
      ...settings,
    }));
    setSaveStatus('unsaved');
  }, []);

  // Test scanner connection by attempting a real connect+disconnect via the factory
  const testConnection = useCallback(
    async (settings: ScannerSettings) => {
      try {
        let factoryType: ScannerTypeEnum | null = null;
        switch (settings.type) {
          case 'bluetooth':
            factoryType = ScannerTypeEnum.BLUETOOTH;
            break;
          case 'usb':
            factoryType = ScannerTypeEnum.USB;
            break;
          case 'qr_hardware':
            factoryType = ScannerTypeEnum.QR_HARDWARE;
            break;
          default:
            return true; // camera needs no explicit test
        }
        const factory = ScannerServiceFactory.getInstance();
        const service = factory.getService(factoryType);
        if (!service) return false;
        const connected = await service.connect(settings.deviceId);
        if (connected) await service.disconnect();
        logger.info(`Scanner connection test ${connected ? 'succeeded' : 'failed'} for type: ${settings.type}`);
        return connected;
      } catch (err) {
        logger.error({ message: 'Error testing scanner connection' }, err instanceof Error ? err : new Error(String(err)));
        return false;
      }
    },
    [logger]
  );

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
