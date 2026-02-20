import { useCallback, useMemo } from 'react';
import { PaymentRequest, PaymentResponse } from '../services/payment/PaymentServiceInterface';
import { PaymentProvider } from '../services/payment/PaymentServiceFactory';
import paymentService from '../services/payment/PaymentService';

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
    ]
  );
};
