import { PaymentRequest, PaymentResponse } from '../services/payment/paymentServiceInterface';
import { PaymentProvider } from '../services/payment/paymentServiceFactory';
import paymentService from '../services/payment/paymentService';

/**
 * Custom hook for payment processing functionality
 * Provides a simple interface to the payment service while following the factory pattern
 */
export const usePayment = () => {
  // Simple passthrough functions to the underlying payment service
  // This maintains the factory pattern architecture while providing a clean React hook interface

  const connectToTerminal = async (deviceId: string): Promise<boolean> => {
    return paymentService.connectToTerminal(deviceId);
  };

  const processPayment = async (request: PaymentRequest): Promise<PaymentResponse> => {
    return paymentService.processPayment(request);
  };

  const disconnect = (): void => {
    paymentService.disconnect();
  };

  const isTerminalConnected = (): boolean => {
    return paymentService.isTerminalConnected();
  };

  const getConnectedDeviceId = (): string | null => {
    return paymentService.getConnectedDeviceId();
  };

  const getAvailableTerminals = async () => {
    return paymentService.getAvailableTerminals();
  };

  const setPaymentProvider = (provider: PaymentProvider) => {
    return paymentService.setPaymentProvider(provider);
  };

  const getCurrentProvider = () => {
    return paymentService.getCurrentProvider();
  };

  return {
    connectToTerminal,
    processPayment,
    disconnect,
    isTerminalConnected,
    getConnectedDeviceId,
    getAvailableTerminals,
    setPaymentProvider,
    getCurrentProvider,
  };
};
