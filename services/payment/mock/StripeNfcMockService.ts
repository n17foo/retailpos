import { PaymentRequest, PaymentResponse, PaymentServiceInterface } from '../PaymentServiceInterface';

/**
 * Mock implementation of Stripe NFC Tap to Pay service for development in Expo Go
 * This avoids the native module error while still providing a functional interface
 */
export class StripeNfcMockService implements PaymentServiceInterface {
  private static instance: StripeNfcMockService;
  private isConnected: boolean = false;
  private deviceId: string | null = null;

  // For NFC tap to pay, the "device" is the phone itself
  private mockDevice = { id: 'MOCK_NFC_DEVICE', name: 'Mock NFC Reader (Built-in)' };

  private constructor() {
    console.log('Stripe NFC MOCK service initialized for development');
  }

  public static getInstance(): StripeNfcMockService {
    if (!StripeNfcMockService.instance) {
      StripeNfcMockService.instance = new StripeNfcMockService();
    }
    return StripeNfcMockService.instance;
  }

  /**
   * Connect to the mock NFC reader
   */
  public async connectToTerminal(deviceId: string): Promise<boolean> {
    console.log('[MOCK] Initializing Stripe NFC reader');

    // Simulate a delay for realism
    await new Promise(resolve => setTimeout(resolve, 800));

    this.isConnected = true;
    this.deviceId = deviceId || this.mockDevice.id;

    console.log(`[MOCK] Successfully initialized Stripe NFC reader: ${this.deviceId}`);
    return true;
  }

  /**
   * Process payment with mock Stripe NFC
   */
  public async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.isConnected) {
      throw new Error('NFC reader not initialized');
    }

    console.log(`[MOCK] Processing NFC tap payment of $${request.amount.toFixed(2)}`);
    console.log(`[MOCK] Please tap card on the device... (simulating)`);

    // Simulate card tap delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('[MOCK] Card detected! Processing...');

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 90% success rate for testing
    const success = Math.random() < 0.9;

    if (success) {
      const transactionId = 'pi_nfc_mock_' + Math.random().toString(36).substring(2, 15);
      return {
        success: true,
        transactionId,
        receiptNumber: `TAP-${Date.now().toString().substring(9)}`,
        timestamp: new Date(),
      };
    } else {
      // Simulate different error scenarios
      const errorTypes = [
        'Card read error. Please try again.',
        'Card declined by issuer.',
        'Card removed too quickly.',
        'Connection interrupted during processing.',
      ];
      const randomError = errorTypes[Math.floor(Math.random() * errorTypes.length)];

      return {
        success: false,
        errorMessage: `Simulated error: ${randomError}`,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get available NFC readers (usually just the device itself)
   */
  public async getAvailableTerminals(): Promise<Array<{ id: string; name: string }>> {
    console.log('[MOCK] Checking NFC availability');

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 800));

    return [this.mockDevice];
  }

  /**
   * Reset the mock NFC reader state
   */
  public disconnect(): void {
    if (this.isConnected) {
      console.log('[MOCK] Resetting Stripe NFC reader state');
      this.isConnected = false;
      this.deviceId = null;
    }
  }

  /**
   * Check if mock NFC reader is ready
   */
  public isTerminalConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get connected device ID
   */
  public getConnectedDeviceId(): string | null {
    return this.deviceId;
  }

  /**
   * Get transaction status from mock system
   */
  public async getTransactionStatus(transactionId: string): Promise<PaymentResponse> {
    console.log(`[MOCK] Getting status for NFC transaction: ${transactionId}`);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 600));

    const isValid = transactionId.startsWith('pi_nfc_mock_');

    return {
      success: isValid,
      transactionId,
      amount: 1000, // $10.00
      timestamp: new Date(),
      paymentMethod: 'contactless',
    };
  }

  /**
   * Void/cancel a transaction in mock system
   */
  public async voidTransaction(transactionId: string): Promise<PaymentResponse> {
    console.log(`[MOCK] Voiding NFC transaction: ${transactionId}`);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 95% success rate for testing
    const success = Math.random() < 0.95;

    if (success) {
      return {
        success: true,
        transactionId,
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        errorMessage: 'Simulated void failure - transaction may be too old to void',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Issue a refund in mock system
   */
  public async refundTransaction(transactionId: string, amount: number): Promise<PaymentResponse> {
    console.log(`[MOCK] Refunding NFC transaction: ${transactionId} for $${amount.toFixed(2)}`);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1200));

    // 95% success rate for testing
    const success = Math.random() < 0.95;

    if (success) {
      const refundId = 're_nfc_mock_' + Math.random().toString(36).substring(2, 15);
      return {
        success: true,
        transactionId: refundId,
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        errorMessage: 'Simulated refund failure - insufficient funds or invalid transaction',
        timestamp: new Date(),
      };
    }
  }
}
