import { PaymentRequest, PaymentResponse, PaymentServiceInterface } from '../PaymentServiceInterface';

/**
 * Mock implementation of Stripe Terminal service for development in Expo Go
 * This avoids the native module error while still providing a functional interface
 */
export class StripeMockService implements PaymentServiceInterface {
  private static instance: StripeMockService;
  private isConnected: boolean = false;
  private deviceId: string | null = null;
  private connectedDevice: unknown = null;

  // Mock readers for testing
  private mockReaders = [
    { id: 'MOCK_READER_1', name: 'Mock Stripe Reader 1' },
    { id: 'MOCK_READER_2', name: 'Mock Stripe Reader 2' },
  ];

  private constructor() {
    console.log('Stripe MOCK service initialized for development');
  }

  public static getInstance(): StripeMockService {
    if (!StripeMockService.instance) {
      StripeMockService.instance = new StripeMockService();
    }
    return StripeMockService.instance;
  }

  /**
   * Connect to a mock terminal reader
   */
  public async connectToTerminal(deviceId: string): Promise<boolean> {
    console.log(`[MOCK] Connecting to Stripe terminal: ${deviceId}`);

    // Simulate a delay for realism
    await new Promise(resolve => setTimeout(resolve, 1000));

    this.isConnected = true;
    this.deviceId = deviceId;
    this.connectedDevice = this.mockReaders.find(r => r.id === deviceId);

    console.log(`[MOCK] Successfully connected to Stripe terminal: ${deviceId}`);
    return true;
  }

  /**
   * Process payment with mock Stripe Terminal
   */
  public async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.isConnected || !this.deviceId) {
      throw new Error('Not connected to payment terminal');
    }

    console.log(`[MOCK] Processing payment of $${request.amount.toFixed(2)} on Stripe terminal ${this.deviceId}`);

    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 90% success rate for testing
    const success = Math.random() < 0.9;

    if (success) {
      const transactionId = 'pi_' + Math.random().toString(36).substring(2, 15);
      return {
        success: true,
        transactionId,
        receiptNumber: `RCPT-${transactionId.substring(3, 11)}`,
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        errorMessage: 'Simulated payment failure',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get available mock Stripe readers
   */
  public async getAvailableTerminals(): Promise<Array<{ id: string; name: string }>> {
    console.log('[MOCK] Discovering Stripe terminals');

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    return this.mockReaders;
  }

  /**
   * Disconnect from the mock Stripe reader
   */
  public disconnect(): void {
    if (this.isConnected && this.deviceId) {
      console.log(`[MOCK] Disconnecting from Stripe terminal: ${this.deviceId}`);

      this.isConnected = false;
      this.deviceId = null;
      this.connectedDevice = null;
    }
  }

  /**
   * Check if connected to a mock Stripe terminal
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
    console.log(`[MOCK] Getting status for transaction: ${transactionId}`);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 800));

    return {
      success: true,
      transactionId,
      amount: 1000, // $10.00
      timestamp: new Date(),
    };
  }

  /**
   * Void/cancel a transaction in mock system
   */
  public async voidTransaction(transactionId: string): Promise<PaymentResponse> {
    console.log(`[MOCK] Voiding transaction: ${transactionId}`);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1200));

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
        errorMessage: 'Simulated void failure',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Issue a refund in mock system
   */
  public async refundTransaction(transactionId: string, amount: number): Promise<PaymentResponse> {
    console.log(`[MOCK] Refunding transaction: ${transactionId} for $${amount.toFixed(2)}`);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 95% success rate for testing
    const success = Math.random() < 0.95;

    if (success) {
      const refundId = 're_' + Math.random().toString(36).substring(2, 15);
      return {
        success: true,
        transactionId: refundId,
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        errorMessage: 'Simulated refund failure',
        timestamp: new Date(),
      };
    }
  }
}
