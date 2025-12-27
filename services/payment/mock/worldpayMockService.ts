import { PaymentRequest, PaymentResponse, PaymentServiceInterface } from '../paymentServiceInterface';

/**
 * Mock implementation of Worldpay service for development in Expo Go
 * This avoids the native module error while still providing a functional interface
 */
export class WorldpayMockService implements PaymentServiceInterface {
  private static instance: WorldpayMockService;
  private isConnected: boolean = false;
  private deviceId: string | null = null;
  private connectedDevice: any = null;

  // Mock readers for testing
  private mockReaders = [
    { id: 'WPAY_TERMINAL_1', name: 'Mock Worldpay Terminal 1' },
    { id: 'WPAY_TERMINAL_2', name: 'Mock Worldpay Terminal 2' },
  ];

  private constructor() {
    console.log('Worldpay MOCK service initialized for development');
  }

  public static getInstance(): WorldpayMockService {
    if (!WorldpayMockService.instance) {
      WorldpayMockService.instance = new WorldpayMockService();
    }
    return WorldpayMockService.instance;
  }

  /**
   * Connect to a mock Worldpay terminal
   */
  public async connectToTerminal(deviceId: string): Promise<boolean> {
    console.log(`[MOCK] Connecting to Worldpay terminal: ${deviceId}`);

    // Simulate a delay for realism
    await new Promise(resolve => setTimeout(resolve, 1200));

    this.isConnected = true;
    this.deviceId = deviceId;
    this.connectedDevice = this.mockReaders.find(r => r.id === deviceId);

    console.log(`[MOCK] Successfully connected to Worldpay terminal: ${deviceId}`);
    return true;
  }

  /**
   * Process payment with mock Worldpay terminal
   */
  public async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.isConnected || !this.deviceId) {
      throw new Error('Not connected to Worldpay payment terminal');
    }

    console.log(`[MOCK] Processing payment of $${request.amount.toFixed(2)} on Worldpay terminal ${this.deviceId}`);

    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 3500));

    // 92% success rate for testing
    const success = Math.random() < 0.92;

    if (success) {
      const transactionId = 'wp_' + Math.random().toString(36).substring(2, 15);
      return {
        success: true,
        transactionId,
        receiptNumber: `WP-${transactionId.substring(3, 11)}`,
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        errorMessage: 'Simulated Worldpay payment failure',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get available mock Worldpay terminals
   */
  public async getAvailableTerminals(): Promise<Array<{ id: string; name: string }>> {
    console.log('[MOCK] Discovering Worldpay terminals');

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1700));

    return this.mockReaders;
  }

  /**
   * Disconnect from the mock Worldpay terminal
   */
  public disconnect(): void {
    if (this.isConnected && this.deviceId) {
      console.log(`[MOCK] Disconnecting from Worldpay terminal: ${this.deviceId}`);

      this.isConnected = false;
      this.deviceId = null;
      this.connectedDevice = null;
    }
  }

  /**
   * Check if connected to a mock Worldpay terminal
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
  public async getTransactionStatus(transactionId: string): Promise<any> {
    console.log(`[MOCK] Getting status for Worldpay transaction: ${transactionId}`);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 900));

    return {
      id: transactionId,
      status: 'AUTHORISED',
      amount: 1000, // $10.00
      currency: 'GBP',
      created: new Date().getTime() / 1000,
    };
  }

  /**
   * Void/cancel a transaction in mock system
   */
  public async voidTransaction(transactionId: string): Promise<PaymentResponse> {
    console.log(`[MOCK] Voiding Worldpay transaction: ${transactionId}`);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 94% success rate for testing
    const success = Math.random() < 0.94;

    if (success) {
      return {
        success: true,
        transactionId,
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        errorMessage: 'Simulated Worldpay void failure',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Issue a refund in mock system
   */
  public async refundTransaction(transactionId: string, amount: number): Promise<PaymentResponse> {
    console.log(`[MOCK] Refunding Worldpay transaction: ${transactionId} for $${amount.toFixed(2)}`);

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1800));

    // 93% success rate for testing
    const success = Math.random() < 0.93;

    if (success) {
      const refundId = 'wr_' + Math.random().toString(36).substring(2, 15);
      return {
        success: true,
        transactionId: refundId,
        timestamp: new Date(),
      };
    } else {
      return {
        success: false,
        errorMessage: 'Simulated Worldpay refund failure',
        timestamp: new Date(),
      };
    }
  }
}
