import { PaymentServiceInterface, PaymentRequest, PaymentResponse } from './PaymentServiceInterface';
import { PaymentProvider, PaymentServiceFactory } from './PaymentServiceFactory';
import { LoggerFactory } from '../../../shared/services/logger/LoggerFactory';

/**
 * Singleton facade over the active PaymentServiceInterface implementation.
 *
 * All method calls are delegated to the provider returned by
 * PaymentServiceFactory.getPaymentService(). The active provider can be
 * swapped at runtime via setPaymentProvider(); the swap is atomic — the next
 * call to any method will use the new provider.
 */
class PaymentService implements PaymentServiceInterface {
  private readonly serviceFactory: PaymentServiceFactory;
  private activeService: PaymentServiceInterface;
  private readonly logger = LoggerFactory.getInstance().createLogger('PaymentService');

  constructor() {
    this.serviceFactory = PaymentServiceFactory.getInstance();
    this.activeService = this.serviceFactory.getPaymentService();
  }

  // ---------------------------------------------------------------------------
  // Provider management
  // ---------------------------------------------------------------------------

  /**
   * Switches the active payment provider.
   * Disconnects from the current provider before activating the new one.
   *
   * @throws {Error} 'Unsupported payment provider: <value>' for unknown values.
   */
  setPaymentProvider(provider: PaymentProvider): void {
    // Disconnect from the current provider before switching.
    if (this.activeService.isTerminalConnected()) {
      this.activeService.disconnect();
    }
    this.serviceFactory.setPaymentProvider(provider);
    this.activeService = this.serviceFactory.getPaymentService();
    this.logger.info(`Provider switched to: ${provider}`);
  }

  getCurrentProvider(): PaymentProvider {
    return this.serviceFactory.getCurrentProvider();
  }

  // ---------------------------------------------------------------------------
  // PaymentServiceInterface — delegated to active provider
  // ---------------------------------------------------------------------------

  async connectToTerminal(deviceId: string): Promise<boolean> {
    return this.activeService.connectToTerminal(deviceId);
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    return this.activeService.processPayment(request);
  }

  disconnect(): void {
    const result = this.activeService.disconnect();
    if (result instanceof Promise) {
      result.catch(error => {
        this.logger.error({ message: 'Error during disconnect' }, error instanceof Error ? error : new Error(String(error)));
      });
    }
  }

  isTerminalConnected(): boolean {
    return this.activeService.isTerminalConnected();
  }

  getConnectedDeviceId(): string | null {
    return this.activeService.getConnectedDeviceId();
  }

  async getAvailableTerminals(): Promise<Array<{ id: string; name: string }>> {
    return this.activeService.getAvailableTerminals();
  }

  // ---------------------------------------------------------------------------
  // Optional methods — guarded delegation
  // ---------------------------------------------------------------------------

  async getTransactionStatus(transactionId: string): Promise<PaymentResponse> {
    if (this.activeService.getTransactionStatus) {
      return this.activeService.getTransactionStatus(transactionId);
    }
    throw new Error('getTransactionStatus not supported by the current payment provider');
  }

  async voidTransaction(transactionId: string): Promise<PaymentResponse> {
    if (this.activeService.voidTransaction) {
      return this.activeService.voidTransaction(transactionId);
    }
    throw new Error('voidTransaction not supported by the current payment provider');
  }

  async refundTransaction(transactionId: string, amount: number): Promise<PaymentResponse> {
    if (this.activeService.refundTransaction) {
      return this.activeService.refundTransaction(transactionId, amount);
    }
    throw new Error('refundTransaction not supported by the current payment provider');
  }
}

// Export a singleton instance consumed by usePayment and other callers.
const paymentService = new PaymentService();
export default paymentService;
