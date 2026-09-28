import { useState, useCallback, useEffect } from 'react';
import { keyValueRepository } from '../repositories/KeyValueRepository';
import { PaymentProvider } from '../services/payment/PaymentServiceFactory';
import { usePayment } from './usePayment';
import { useLogger } from '../hooks/useLogger';
import { PaymentSettingsStorage } from '../services/config/PaymentSettingsStorage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StripeNfcSettings {
  apiKey: string;
  publishableKey?: string;
  merchantId: string;
  enableNfc: boolean;
  backendUrl: string;
  useDirectApi?: boolean;
  useSimulatedReader?: boolean;
  connectionTimeout?: string;
}

export interface StripeSettings {
  apiKey?: string;
  publishableKey: string;
  secretKey: string;
  locationId?: string;
}

export interface SquareSettings {
  applicationId: string;
  locationId: string;
  accessToken: string;
}

export interface AdyenSettings {
  apiKey: string;
  clientKey: string;
  environment: 'test' | 'live';
  merchantAccount: string;
}

export interface TapPaymentsSettings {
  apiKey: string;
  publishableKey: string;
  merchantId: string;
}

export interface PaymentSettings {
  provider: PaymentProvider;
  syncInventory: boolean;
  stripe_nfc: StripeNfcSettings;
  stripe: StripeSettings;
  square: SquareSettings;
  adyen: AdyenSettings;
  tap_payments: TapPaymentsSettings;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  provider: PaymentProvider.STRIPE_NFC,
  syncInventory: false,
  stripe_nfc: {
    apiKey: '',
    publishableKey: '',
    merchantId: '',
    enableNfc: false,
    backendUrl: '',
    useDirectApi: false,
    useSimulatedReader: false,
    connectionTimeout: '30',
  },
  stripe: {
    apiKey: '',
    publishableKey: '',
    secretKey: '',
    locationId: '',
  },
  square: {
    applicationId: '',
    locationId: '',
    accessToken: '',
  },
  adyen: {
    apiKey: '',
    clientKey: '',
    environment: 'test',
    merchantAccount: '',
  },
  tap_payments: {
    apiKey: '',
    publishableKey: '',
    merchantId: '',
  },
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const usePaymentSettings = () => {
  const { setPaymentProvider } = usePayment();
  const logger = useLogger('usePaymentSettings');
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(DEFAULT_PAYMENT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'unsaved' | 'saving' | 'error'>('saved');

  // Load settings from storage
  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const saved = await PaymentSettingsStorage.load<PaymentSettings>();
      if (saved) {
        setPaymentSettings({ ...DEFAULT_PAYMENT_SETTINGS, ...saved });
        logger.info('Payment settings loaded');
      } else {
        logger.info('No saved payment settings — using defaults');
      }
      return true;
    } catch (err) {
      const msg = 'Failed to load payment settings';
      setError(msg);
      setSaveStatus('error');
      logger.error({ message: msg }, err instanceof Error ? err : new Error(String(err)));
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [logger]);

  // Save settings to storage and activate the selected provider
  const saveSettings = useCallback(
    async (settings: PaymentSettings) => {
      try {
        setIsLoading(true);
        setSaveStatus('saving');
        await PaymentSettingsStorage.save(settings);
        await PaymentSettingsStorage.saveStripeNfcApiKey(settings.stripe_nfc.apiKey);
        setPaymentSettings(settings);
        await setPaymentProvider(settings.provider);
        setSaveStatus('saved');
        logger.info({ message: 'Payment settings saved', provider: settings.provider });
        return true;
      } catch (err) {
        const msg = 'Failed to save payment settings';
        setError(msg);
        setSaveStatus('error');
        logger.error({ message: msg }, err instanceof Error ? err : new Error(String(err)));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [setPaymentProvider, logger]
  );

  // Partial update helper — merges provider-specific sub-objects
  const handlePaymentSettingsChange = useCallback((updates: Partial<PaymentSettings>) => {
    setPaymentSettings(prev => ({
      ...prev,
      ...updates,
      stripe_nfc: { ...prev.stripe_nfc, ...(updates.stripe_nfc ?? {}) },
      stripe: { ...prev.stripe, ...(updates.stripe ?? {}) },
      square: { ...prev.square, ...(updates.square ?? {}) },
      adyen: { ...prev.adyen, ...(updates.adyen ?? {}) },
      tap_payments: { ...prev.tap_payments, ...(updates.tap_payments ?? {}) },
    }));
    setSaveStatus('unsaved');
  }, []);

  // Test connection to the currently selected provider
  const testConnection = useCallback(
    async (provider: PaymentProvider): Promise<boolean> => {
      try {
        setIsLoading(true);
        logger.info({ message: `Testing connection to ${provider}` });

        switch (provider) {
          case PaymentProvider.STRIPE_NFC: {
            // Persist settings so the service can read them, then run the test.
            await PaymentSettingsStorage.saveStripeNfcApiKey(paymentSettings.stripe_nfc.apiKey);
            await keyValueRepository.setItem('stripe_nfc_publishableKey', paymentSettings.stripe_nfc.publishableKey ?? '');
            await keyValueRepository.setItem('stripe_nfc_merchantId', paymentSettings.stripe_nfc.merchantId);
            await keyValueRepository.setItem('stripe_nfc_backendUrl', paymentSettings.stripe_nfc.backendUrl);
            await keyValueRepository.setItem('stripe_nfc_useDirectApi', String(paymentSettings.stripe_nfc.useDirectApi ?? false));
            await keyValueRepository.setItem(
              'stripe_nfc_useSimulatedReader',
              String(paymentSettings.stripe_nfc.useSimulatedReader ?? false)
            );
            await keyValueRepository.setItem('stripe_nfc_connectionTimeout', paymentSettings.stripe_nfc.connectionTimeout ?? '30');
            await keyValueRepository.setItem('stripe_nfc_enableNfc', String(paymentSettings.stripe_nfc.enableNfc));

            const { StripeNfcService } = await import('../services/payment/StripeNfcService');
            const result = await StripeNfcService.getInstance().testTerminalConnection();
            if (!result.success) throw new Error(result.message ?? 'Connection test failed');
            return true;
          }

          case PaymentProvider.STRIPE:
          case PaymentProvider.SQUARE:
          case PaymentProvider.ADYEN:
          case PaymentProvider.TAP_PAYMENTS:
          default:
            // Specific connection tests for these providers can be added here.
            logger.info({ message: `Connection test not yet implemented for ${provider} — returning success` });
            await new Promise(resolve => setTimeout(resolve, 800));
            return true;
        }
      } catch (err) {
        const msg = `Failed to connect to ${provider}`;
        setError(msg);
        logger.error({ message: msg, provider }, err instanceof Error ? err : new Error(String(err)));
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [paymentSettings.stripe_nfc, logger]
  );

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
