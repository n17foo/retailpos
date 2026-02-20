import { PaymentRequest, PaymentResponse, PaymentServiceInterface } from '../PaymentServiceInterface';

/**
 * Mock implementation of Square payment service for development in Expo Go
 * This avoids the native module error while still providing a functional interface
 */
export class SquareMockService implements PaymentServiceInterface {
  private static instance: SquareMockService;
  private isConnected: boolean = false;
  private deviceId: string | null = null;
  private connectedDevice: unknown = null;

  // Mock readers for testing
  private mockReaders = [
    { id: 'SQUARE_READER_1', name: 'Mock Square Reader 1' },
    { id: 'SQUARE_READER_2', name: 'Mock Square Reader 2' },
  ];

  private constructor() {
    console.log('Square MOCK service initialized for development');
  }

  public static getInstance(): SquareMockService {
    if (!SquareMockService.instance) {
      SquareMockService.instance = new SquareMockService();
    }
    return SquareMockService.instance;
  }

  /**
   * Connect to a mock Square reader
   */
  public async connectToTerminal(deviceId: string): Promise<boolean> {
    console.log(`[MOCK] Connecting to Square reader: ${deviceId}`);

    // Simulate a delay for realism
    await new Promise(resolve => setTimeout(resolve, 800));

    this.isConnected = true;
    this.deviceId = deviceId;
    this.connectedDevice = this.mockReaders.find(r => r.id === deviceId);

    console.log(`[MOCK] Successfully connected to Square reader: ${deviceId}`);
    return true;
  }

  /**
   * Process payment with mock Square reader
   */
  public async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.isConnected || !this.deviceId) {
      throw new Error('Not connected to Square payment terminal');
    }

    console.log(`[MOCK] Processing payment of $${request.amount.toFixed(2)} on Square reader ${this.deviceId}`);

    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2500));

    // 95% success rate for testing
    const success = Math.random() < 0.95;

    if (success) {
      const transactionId = 'sq_' + Math.random().toString(36).substring(2, 15);
      return {
        success: true,
        transactionId,
        receiptNumber: `SQ-${transactionId.substring(3, 11)}`,
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        errorMessage: 'Simulated Square payment failure',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get available mock Square readers
   */
  public async getAvailableTerminals(): Promise<Array<{ id: string; name: string }>> {
    console.log('[MOCK] Discovering Square readers');

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1200));

    return this.mockReaders;
  }

  /**
   * Disconnect from the mock Square reader
   */
  public disconnect(): void {
    if (this.isConnected && this.deviceId) {
      console.log(`[MOCK] Disconnecting from Square reader: ${this.deviceId}`);

      this.isConnected = false;
      this.deviceId = null;
      this.connectedDevice = null;
    }
  }

  /**
   * Check if connected to a mock Square reader
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
    console.log(`[MOCK] Getting status for Square transaction: ${transactionId}`);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 750));

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
    console.log(`[MOCK] Voiding Square transaction: ${transactionId}`);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 96% success rate for testing
    const success = Math.random() < 0.96;

    if (success) {
      return {
        success: true,
        transactionId,
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        errorMessage: 'Simulated Square void failure',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Issue a refund in mock system
   */
  public async refundTransaction(transactionId: string, amount: number): Promise<PaymentResponse> {
    console.log(`[MOCK] Refunding Square transaction: ${transactionId} for $${amount.toFixed(2)}`);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1300));

    // 95% success rate for testing
    const success = Math.random() < 0.95;

    if (success) {
      const refundId = 'sr_' + Math.random().toString(36).substring(2, 15);
      return {
        success: true,
        transactionId: refundId,
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        errorMessage: 'Simulated Square refund failure',
        timestamp: new Date(),
      };
    }
  }
}
