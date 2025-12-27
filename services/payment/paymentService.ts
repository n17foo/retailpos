import { PaymentServiceInterface, PaymentRequest, PaymentResponse } from './paymentServiceInterface';
import { PaymentProvider, PaymentServiceFactory } from './paymentServiceFactory';

/**
 * Unified payment service that combines service functionality with provider switching
 */
class PaymentService implements PaymentServiceInterface {
  private serviceFactory: PaymentServiceFactory;
  private activeService: PaymentServiceInterface;

  constructor() {
    // Use the factory to get the appropriate service implementation
    this.serviceFactory = PaymentServiceFactory.getInstance();
    this.activeService = this.serviceFactory.getPaymentService();
  }

  // Method to switch payment providers
  setPaymentProvider(provider: PaymentProvider): void {
    this.serviceFactory.setPaymentProvider(provider);
    this.activeService = this.serviceFactory.getPaymentService();
    console.log(`[PAYMENT SERVICE] Provider set to: ${provider}`);
  }

  // Get current provider
  getCurrentProvider(): PaymentProvider {
    return this.serviceFactory.getCurrentProvider();
  }

  // PaymentServiceInterface implementation - delegate to active service
  async connectToTerminal(deviceId: string): Promise<boolean> {
    return this.activeService.connectToTerminal(deviceId);
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    return this.activeService.processPayment(request);
  }

  disconnect(): void {
    this.activeService.disconnect();
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

  // Optional methods - check if they exist on the active service first
  async getTransactionStatus(transactionId: string): Promise<any> {
    if ('getTransactionStatus' in this.activeService) {
      return (this.activeService as any).getTransactionStatus(transactionId);
    }
    throw new Error('getTransactionStatus not supported by the current payment provider');
  }

  async voidTransaction(transactionId: string): Promise<PaymentResponse> {
    if ('voidTransaction' in this.activeService) {
      return (this.activeService as any).voidTransaction(transactionId);
    }
    throw new Error('voidTransaction not supported by the current payment provider');
  }

  async refundTransaction(transactionId: string, amount: number): Promise<PaymentResponse> {
    if ('refundTransaction' in this.activeService) {
      return (this.activeService as any).refundTransaction(transactionId, amount);
    }
    throw new Error('refundTransaction not supported by the current payment provider');
  }
}

// Export a singleton instance
const paymentService = new PaymentService();
export default paymentService;
