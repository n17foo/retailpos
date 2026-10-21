import { useCallback, useMemo } from 'react';
import { PaymentRequest, PaymentResponse } from '../services/PaymentServiceInterface';
import { PaymentProvider } from '../services/PaymentServiceFactory';
import paymentService from '../services/PaymentService';
import { isElectron, isMobile } from '../../../shared/utils/electron';
import { instoreApiConfig } from '../../multi-register/services/InstoreApiConfig';

/** The payment modes the checkout UI needs to know about. */
export type PaymentMode =
  /** A tap-to-pay SDK provider is active and the device supports it. */
  | 'tap_to_pay'
  /** Store-api PED terminal (LAN payment device) in multi-register mode. */
  | 'instore_ped'
  /** No card payment available on this device — cash only. */
  | 'cash_only';

/** Tap-to-pay providers that have a React Native SDK. */
const TAP_TO_PAY_PROVIDERS = new Set<PaymentProvider>([
  PaymentProvider.STRIPE_NFC,
  PaymentProvider.STRIPE,
  PaymentProvider.SQUARE,
  PaymentProvider.ADYEN,
  PaymentProvider.TAP_PAYMENTS,
]);

/**
 * Custom hook for payment processing functionality
 * Provides a stable interface to the payment service singleton
 */
export const usePayment = () => {
  const connectToTerminal = useCallback((deviceId: string): Promise<boolean> => paymentService.connectToTerminal(deviceId), []);

  const processPayment = useCallback((request: PaymentRequest): Promise<PaymentResponse> => paymentService.processPayment(request), []);

  const disconnect = useCallback((): void => {
    paymentService.disconnect();
  }, []);

  const isTerminalConnected = useCallback((): boolean => paymentService.isTerminalConnected(), []);

  const getConnectedDeviceId = useCallback((): string | null => paymentService.getConnectedDeviceId(), []);

  const getAvailableTerminals = useCallback(() => paymentService.getAvailableTerminals(), []);

  const setPaymentProvider = useCallback((provider: PaymentProvider) => paymentService.setPaymentProvider(provider), []);

  const getCurrentProvider = useCallback(() => paymentService.getCurrentProvider(), []);

  /**
   * Returns the payment mode for the current device and active provider.
   *
   * - Desktop (Electron): always `cash_only` — no React Native payment SDKs.
   * - Mobile/tablet with a tap-to-pay provider: `tap_to_pay`.
   * - Anything else: `cash_only`.
   */
  const getPaymentMode = useCallback((): PaymentMode => {
    // Store-api PED works on any platform — the terminal lives on the LAN and
    // the server drives it, so no local SDK is needed.
    if (paymentService.getCurrentProvider() === PaymentProvider.INSTORE_API) {
      return instoreApiConfig.isClient ? 'instore_ped' : 'cash_only';
    }
    // Desktop has no tap-to-pay SDK support.
    if (isElectron()) return 'cash_only';
    // Web (non-Electron) also has no SDK support.
    if (!isMobile()) return 'cash_only';
    // Mobile/tablet: check whether the active provider is a tap-to-pay SDK.
    const provider = paymentService.getCurrentProvider();
    return TAP_TO_PAY_PROVIDERS.has(provider) ? 'tap_to_pay' : 'cash_only';
  }, []);

  return useMemo(
    () => ({
      connectToTerminal,
      processPayment,
      disconnect,
      isTerminalConnected,
      getConnectedDeviceId,
      getAvailableTerminals,
      setPaymentProvider,
      getCurrentProvider,
      getPaymentMode,
    }),
    [
      connectToTerminal,
      processPayment,
      disconnect,
      isTerminalConnected,
      getConnectedDeviceId,
      getAvailableTerminals,
      setPaymentProvider,
      getCurrentProvider,
      getPaymentMode,
    ]
  );
};
