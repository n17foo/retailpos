import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { keyValueRepository } from '../../../shared/repositories/KeyValueRepository';
import { PrinterConnectionType } from '../services/printer/UnifiedPrinterService';
import { PrinterServiceFactory } from '../services/printer/PrinterServiceFactory';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { useLogger } from '../../../shared/hooks/useLogger';
import { validatePrinterSettings } from '../utils/printerSettings.utils';

export type { PrinterSettingsInput, ValidationResult } from '../utils/printerSettings.utils';

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

export const usePrinterSettings = () => {
  const { t } = useTranslate();
  const logger = useLogger('usePrinterSettings');

  const [printerSettings, setPrinterSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved');
  const [isTesting, setIsTesting] = useState(false);
  const testConnectionRef = useRef<AbortController | null>(null);

  // Load printer settings from storage
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const savedSettings = await keyValueRepository.getObject<PrinterSettings>(PRINTER_SETTINGS_KEY);
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
  }, [logger]);

  const saveSettings = useCallback(
    async (settings: PrinterSettings) => {
      try {
        const validation = validatePrinterSettings(settings);
        if (!validation.isValid) {
          // validation.error is an i18n key — translate before showing/storing
          const translated = validation.error
            ? (t(validation.error, { defaultValue: validation.error }) as string)
            : (t('settings.printer.validation.invalid', 'Invalid printer settings') as string);
          setError(translated);
          setSaveStatus('error');
          const errorMessage = t('settings.printer.validationError', {
            error: translated,
            defaultValue: `Validation error: ${translated}`,
          }) as string;
          Alert.alert(t('settings.printer.validationErrorTitle', 'Validation Error') as string, errorMessage);
          return false;
        }

        setSaveStatus('saving');
        await keyValueRepository.setItem(PRINTER_SETTINGS_KEY, settings);
        setPrinterSettings(settings);
        setSaveStatus('saved');
        logger.info('Printer settings saved successfully');
        return true;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errorMessage = t('settings.printer.saveError', { error: errMsg, defaultValue: `Error: ${errMsg}` }) as string;
        setError(errorMessage);
        setSaveStatus('error');
        logger.error({ message: 'Error saving printer settings' }, err instanceof Error ? err : new Error(String(err)));
        Alert.alert(t('common.error', 'Error') as string, errorMessage);
        return false;
      }
    },
    [t, logger]
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
  const testConnection = useCallback(
    async (settings: PrinterSettings) => {
      if (testConnectionRef.current) {
        testConnectionRef.current.abort();
      }

      const controller = new AbortController();
      testConnectionRef.current = controller;

      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      try {
        setIsTesting(true);
        setError(null);

        // Validate settings before testing
        const validation = validatePrinterSettings(settings);
        if (!validation.isValid) {
          throw new Error(validation.error || 'Invalid printer settings');
        }

        // Set a timeout for the connection test
        const timeout = new Promise<boolean>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Connection timeout')), 10000);
        });

        // Delegate to the real printer service
        const printerFactory = PrinterServiceFactory.getInstance();
        const testPromise = printerFactory.testConnection({
          connectionType: settings.connectionType,
          printerName: settings.printerName,
          macAddress: settings.macAddress,
          ipAddress: settings.ipAddress,
          port: settings.port,
          vendorId: settings.vendorId,
          productId: settings.productId,
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
        if (err instanceof Error && err.name === 'AbortError') {
          return false;
        }
        {
          const errorMessage = err instanceof Error ? err.message : 'Failed to connect to the printer';
          setError(errorMessage);
          logger.error({ message: 'Error testing printer connection' }, err instanceof Error ? err : new Error(String(err)));
          throw err;
        }
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (testConnectionRef.current === controller) {
          setIsTesting(false);
          testConnectionRef.current = null;
        }
      }
    },
    [logger]
  );

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
