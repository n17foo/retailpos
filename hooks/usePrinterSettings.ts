import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { storage } from '../utils/storage';
import { PrinterConnectionType } from '../services/printer/UnifiedPrinterService';
import { useTranslate } from './useTranslate';
import { LoggerFactory } from '../services/logger';

export interface PrinterSettings {
  enabled: boolean;
  connectionType: PrinterConnectionType;
  deviceName: string;
  deviceAddress: string;
  macAddress: string;
  ipAddress: string;
  port: number;
  printerName: string;
  printReceipts: boolean;
  vendorId?: number;
  productId?: number;
}

const PRINTER_SETTINGS_KEY = 'printerSettings';

const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  enabled: false,
  connectionType: PrinterConnectionType.BLUETOOTH,
  deviceName: '',
  deviceAddress: '',
  macAddress: '',
  ipAddress: '',
  port: 9100,
  printerName: '',
  printReceipts: true,
  vendorId: undefined,
  productId: undefined,
};

// Validation function for printer settings
const validatePrinterSettings = (settings: PrinterSettings): { isValid: boolean; error?: string } => {
  if (!settings.printerName?.trim()) {
    return { isValid: false, error: 'Printer name is required' };
  }

  switch (settings.connectionType) {
    case PrinterConnectionType.BLUETOOTH:
      if (!settings.macAddress?.match(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)) {
        return { isValid: false, error: 'Invalid MAC address format' };
      }
      break;

    case PrinterConnectionType.NETWORK:
      if (!settings.ipAddress?.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
        return { isValid: false, error: 'Invalid IP address format' };
      }
      if (!settings.port || settings.port < 1 || settings.port > 65535) {
        return { isValid: false, error: 'Port must be between 1 and 65535' };
      }
      break;

    case PrinterConnectionType.USB:
      if (settings.vendorId === undefined || settings.productId === undefined) {
        return { isValid: false, error: 'Vendor ID and Product ID are required for USB printers' };
      }
      break;
  }

  return { isValid: true };
};

export const usePrinterSettings = () => {
  const { t } = useTranslate();
  const logger = LoggerFactory.getInstance().createLogger('usePrinterSettings');

  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved');
  const [isTesting, setIsTesting] = useState(false);
  const testConnectionRef = useRef<AbortController | null>(null);

  // Load printer settings from MMKV storage
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const savedSettings = await storage.getObject<PrinterSettings>(PRINTER_SETTINGS_KEY);
      if (savedSettings) {
        setPrinterSettings({ ...DEFAULT_PRINTER_SETTINGS, ...savedSettings });
        logger.info('Printer settings loaded successfully');
      } else {
        logger.info('No saved printer settings found, using defaults');
      }
      return true;
    } catch (err) {
      const errorMessage = 'Failed to load printer settings';
      setError(errorMessage);
      logger.error({ message: errorMessage }, err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveSettings = useCallback(
    async (settings: PrinterSettings) => {
      try {
        const validation = validatePrinterSettings(settings);
        if (!validation.isValid) {
          setError(validation.error || 'Invalid printer settings');
          setSaveStatus('error');
          const showValidationError = (error: string) => {
            const errorMessage = t('settings.printer.validationError', { error, defaultValue: `Validation error: ${error}` }) as string;
            Alert.alert(t('settings.printer.validationErrorTitle', 'Validation Error') as string, errorMessage);
            return errorMessage;
          };
          showValidationError(validation.error || 'Invalid printer settings');
          return false;
        }

        setSaveStatus('saving');
        await storage.setItem(PRINTER_SETTINGS_KEY, settings);
        setPrinterSettings(settings);
        setSaveStatus('saved');
        logger.info('Printer settings saved successfully');
        return true;
      } catch (err) {
        const errorMessage = t('settings.printer.saveError', { error: err.message, defaultValue: `Error: ${err.message}` }) as string;
        setError(errorMessage);
        setSaveStatus('error');
        logger.error({ message: 'Error saving printer settings' }, err instanceof Error ? err : new Error(String(err)));
        const showError = (error: Error) => {
          const errorMessage = t('settings.printer.saveError', {
            error: error.message,
            defaultValue: `Error: ${error.message}`,
          }) as string;
          Alert.alert(t('common.error', 'Error') as string, errorMessage);
          return errorMessage;
        };
        showError(err);
        return false;
      }
    },
    [t]
  );

  // Handle printer settings change
  const handlePrinterSettingsChange = useCallback((settings: Partial<PrinterSettings>) => {
    setPrinterSettings(prev => ({
      ...prev,
      ...settings,
    }));
    setSaveStatus('unsaved');
  }, []);

  // Test printer connection with timeout and abort controller
  const testConnection = useCallback(async (settings: PrinterSettings) => {
    if (testConnectionRef.current) {
      testConnectionRef.current.abort();
    }

    const controller = new AbortController();
    testConnectionRef.current = controller;

    try {
      setIsTesting(true);
      setError(null);

      // Validate settings before testing
      const validation = validatePrinterSettings(settings);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid printer settings');
      }

      // Set a timeout for the connection test
      const timeout = new Promise<boolean>((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 10000));

      // Actual connection test implementation would go here
      // This is a placeholder that simulates a successful connection
      const testPromise = new Promise<boolean>(resolve => {
        // Simulate network delay
        setTimeout(() => {
          // Simulate 90% success rate for testing
          const isSuccess = Math.random() > 0.1;
          resolve(isSuccess);
        }, 2000);
      });

      const result = await Promise.race([testPromise, timeout]);

      if (controller.signal.aborted) {
        return false;
      }

      if (!result) {
        throw new Error('Failed to connect to the printer. Please check your settings.');
      }

      return true;
    } catch (err) {
      if (err.name !== 'AbortError') {
        const errorMessage = err.message || 'Failed to connect to the printer';
        setError(errorMessage);
        logger.error({ message: 'Error testing printer connection' }, err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
      return false;
    } finally {
      if (testConnectionRef.current === controller) {
        setIsTesting(false);
        testConnectionRef.current = null;
      }
    }
  }, []);

  // Clean up any pending test connections on unmount
  useEffect(() => {
    return () => {
      if (testConnectionRef.current) {
        testConnectionRef.current.abort();
      }
    };
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Helper to check if settings are valid
  const validateCurrentSettings = useCallback(() => {
    return validatePrinterSettings(printerSettings);
  }, [printerSettings]);

  return {
    printerSettings,
    handlePrinterSettingsChange,
    testConnection,
    loadSettings,
    saveSettings,
    validateSettings: validateCurrentSettings,
    isLoading,
    isTesting,
    error,
    saveStatus,
  };
};

export default usePrinterSettings;
