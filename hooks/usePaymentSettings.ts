import { useState, useCallback, useEffect } from 'react';
import { storage } from '../utils/storage';
import { PaymentProvider } from '../services/payment/paymentServiceFactory';
import { usePayment } from './usePayment';
import { LoggerFactory } from '../services/logger';

// Interface for payment settings
export interface PaymentSettings {
  provider: PaymentProvider;
  syncInventory: boolean;
  worldpay: {
    merchantId: string;
    siteReference: string;
    installationId: string;
  };
  stripe: {
    publishableKey: string;
    secretKey: string;
    apiKey?: string;
    locationId?: string;
  };
  stripe_nfc: {
    apiKey: string;
    merchantId: string;
    enableNfc: boolean;
    backendUrl: string;
    publishableKey?: string;
    useDirectApi?: boolean;
    useSimulatedReader?: boolean;
    connectionTimeout?: string;
  };
  square: {
    applicationId: string;
    locationId: string;
    accessToken: string;
  };
}

// Default payment settings
const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  provider: PaymentProvider.WORLDPAY,
  syncInventory: false,
  worldpay: {
    merchantId: '',
    siteReference: '',
    installationId: '',
  },
  stripe: {
    publishableKey: '',
    secretKey: '',
    apiKey: '',
    locationId: '',
  },
  stripe_nfc: {
    apiKey: '',
    merchantId: '',
    enableNfc: false,
    backendUrl: 'https://your-backend-url.com',
  },
  square: {
    applicationId: '',
    locationId: '',
    accessToken: '',
  },
};

export const usePaymentSettings = () => {
  const { setPaymentProvider } = usePayment();
  const logger = LoggerFactory.getInstance().createLogger('usePaymentSettings');
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('unsaved');

  // Load settings from storage
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const savedSettings = await storage.getObject<PaymentSettings>('paymentSettings');
      if (savedSettings) {
        setPaymentSettings({ ...DEFAULT_PAYMENT_SETTINGS, ...savedSettings });
        logger.info('Payment settings loaded successfully');
      } else {
        logger.info('No saved payment settings found, using defaults');
      }
      return true;
    } catch (err) {
      const errorMessage = 'Failed to load payment settings';
      setError(errorMessage);
      setSaveStatus('error');
      logger.error({ message: errorMessage }, err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save settings to storage
  const saveSettings = useCallback(
    async (settings: PaymentSettings) => {
      try {
        setIsLoading(true);
        setSaveStatus('saving');
        await storage.setItem('paymentSettings', settings);
        setPaymentSettings(settings);
        await setPaymentProvider(settings.provider);
        setSaveStatus('saved');
        logger.info({ message: 'Payment settings saved successfully', provider: settings.provider });
        return true;
      } catch (err) {
        const errorMessage = 'Failed to save payment settings';
        setError(errorMessage);
        setSaveStatus('error');
        logger.error({ message: errorMessage }, err instanceof Error ? err : new Error(String(err)));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [setPaymentProvider]
  );

  // Handle settings change
  const handlePaymentSettingsChange = useCallback((updates: Partial<PaymentSettings>) => {
    setPaymentSettings(prev => ({
      ...prev,
      ...updates,
      // Ensure provider-specific settings are preserved
      worldpay: { ...prev.worldpay, ...(updates.worldpay || {}) },
      stripe: { ...prev.stripe, ...(updates.stripe || {}) },
      stripe_nfc: { ...prev.stripe_nfc, ...(updates.stripe_nfc || {}) },
      square: { ...prev.square, ...(updates.square || {}) },
    }));
    setSaveStatus('unsaved');
  }, []);

  // Test connection to payment provider
  const testConnection = useCallback(async (provider: PaymentProvider) => {
    try {
      setIsLoading(true);
      logger.info({ message: `Testing connection to ${provider}` });

      // Implement different testing logic per provider
      switch (provider) {
        case PaymentProvider.STRIPE_NFC: {
          // For Stripe NFC, use the dedicated StripeNfcService to test the terminal connection

          // First, save all the current settings to storage so the service can access them
          await storage.setItem('stripe_nfc_apiKey', paymentSettings.stripe_nfc.apiKey);
          await storage.setItem('stripe_nfc_publishableKey', paymentSettings.stripe_nfc.publishableKey || '');
          await storage.setItem('stripe_nfc_merchantId', paymentSettings.stripe_nfc.merchantId);
          await storage.setItem('stripe_nfc_backendUrl', paymentSettings.stripe_nfc.backendUrl);
          await storage.setItem('stripe_nfc_useDirectApi', String(paymentSettings.stripe_nfc.useDirectApi || false));
          await storage.setItem('stripe_nfc_useSimulatedReader', String(paymentSettings.stripe_nfc.useSimulatedReader || false));
          await storage.setItem('stripe_nfc_connectionTimeout', paymentSettings.stripe_nfc.connectionTimeout || '30');
          await storage.setItem('stripe_nfc_enableNfc', String(paymentSettings.stripe_nfc.enableNfc || false));

          // Import and use the StripeNfcService
          const { StripeNfcService } = await import('../services/payment/stripeNfcService');
          const stripeService = StripeNfcService.getInstance();

          // Test the connection
          logger.info({ message: 'Testing Stripe NFC terminal connection' });
          const testResult = await stripeService.testTerminalConnection();

          // Log the test result
          if (testResult.success) {
            logger.info({
              message: 'Stripe NFC terminal connection test successful',
              details: testResult.message,
            });
          } else {
            logger.warn({
              message: 'Stripe NFC terminal connection test failed',
              error: testResult.message,
            });
            throw new Error(testResult.message || 'Connection test failed');
          }

          return testResult.success;
        }
        case PaymentProvider.WORLDPAY:
        case PaymentProvider.STRIPE:
        case PaymentProvider.SQUARE:
        default:
          // For other providers, simply return true
          // In the future, implement specific connection tests for each provider
          logger.info({ message: `Connection test not implemented for ${provider}, returning success` });
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
          return true;
      }
    } catch (err) {
      const errorMessage = `Failed to connect to ${provider}`;
      setError(errorMessage);
      logger.error({ message: errorMessage, provider }, err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    paymentSettings,
    isLoading,
    error,
    saveStatus,
    loadSettings,
    saveSettings,
    handlePaymentSettingsChange,
    testConnection,
  };
};
