import { PaymentRequest, PaymentResponse, PaymentServiceInterface } from '../PaymentServiceInterface';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';

/**
 * Unified mock implementation of PaymentServiceInterface.
 *
 * Used for ALL providers when:
 *   - The app is running in Expo Go (no native modules available), or
 *   - USE_MOCK_PAYMENT=true is set in the environment.
 *
 * Simulates the full provider lifecycle — discovery, connection, payment,
 * void, refund — with realistic delays and stub data so the UI can be
 * exercised end-to-end without real hardware.
 */
export class MockPaymentService implements PaymentServiceInterface {
  private static instance: MockPaymentService;
  private isConnected: boolean = false;
  private deviceId: string | null = null;
  private readonly logger = LoggerFactory.getInstance().createLogger('MockPaymentService');

  private readonly mockTerminals = [
    { id: 'MOCK_TERMINAL_1', name: 'Mock Terminal 1' },
    { id: 'MOCK_TERMINAL_2', name: 'Mock Terminal 2' },
  ];

  private constructor() {
    this.logger.info('[MOCK] MockPaymentService initialized');
  }

  public static getInstance(): MockPaymentService {
    if (!MockPaymentService.instance) {
      MockPaymentService.instance = new MockPaymentService();
    }
    return MockPaymentService.instance;
  }

  // ---------------------------------------------------------------------------
  // Terminal lifecycle
  // ---------------------------------------------------------------------------

  public async connectToTerminal(deviceId: string): Promise<boolean> {
    this.logger.info(`[MOCK] Connecting to terminal: ${deviceId}`);
    await delay(900);
    this.isConnected = true;
    this.deviceId = deviceId;
    this.logger.info(`[MOCK] Connected to terminal: ${deviceId}`);
    return true;
  }

  public disconnect(): void {
    if (this.isConnected) {
      this.logger.info(`[MOCK] Disconnecting from terminal: ${this.deviceId}`);
      this.isConnected = false;
      this.deviceId = null;
    }
  }

  public isTerminalConnected(): boolean {
    return this.isConnected;
  }

  public getConnectedDeviceId(): string | null {
    return this.deviceId;
  }

  public async getAvailableTerminals(): Promise<Array<{ id: string; name: string }>> {
    this.logger.info('[MOCK] Discovering terminals');
    await delay(1200);
    return this.mockTerminals;
  }

  // ---------------------------------------------------------------------------
  // Payment processing
  // ---------------------------------------------------------------------------

  public async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.isConnected || !this.deviceId) {
      return {
        success: false,
        errorMessage: 'Not connected to a payment terminal',
        timestamp: new Date(),
      };
    }

    this.logger.info(`[MOCK] Processing payment of ${request.amount} for reference ${request.reference}`);
    await delay(2500);

    // 90 % success rate — realistic enough for UI testing.
    if (Math.random() < 0.9) {
      const txId = mockId('tx');
      return {
        success: true,
        transactionId: txId,
        receiptNumber: `RCPT-${txId.slice(-8).toUpperCase()}`,
        timestamp: new Date(),
        amount: request.amount,
        paymentMethod: 'contactless',
        cardBrand: randomCardBrand(),
        last4: randomLast4(),
      };
    }

    return {
      success: false,
      errorMessage: 'Simulated payment failure — please try again',
      errorCode: 'payment_declined',
      timestamp: new Date(),
    };
  }

  // ---------------------------------------------------------------------------
  // Optional methods
  // ---------------------------------------------------------------------------

  public async getTransactionStatus(transactionId: string): Promise<PaymentResponse> {
    this.logger.info(`[MOCK] Getting status for transaction: ${transactionId}`);
    await delay(600);
    return {
      success: true,
      transactionId,
      timestamp: new Date(),
      amount: 1000,
      paymentMethod: 'contactless',
    };
  }

  public async voidTransaction(transactionId: string): Promise<PaymentResponse> {
    this.logger.info(`[MOCK] Voiding transaction: ${transactionId}`);
    await delay(1000);

    if (Math.random() < 0.95) {
      return { success: true, transactionId, timestamp: new Date() };
    }
    return {
      success: false,
      errorMessage: 'Simulated void failure',
      timestamp: new Date(),
    };
  }

  public async refundTransaction(transactionId: string, amount: number): Promise<PaymentResponse> {
    this.logger.info(`[MOCK] Refunding transaction: ${transactionId} for ${amount}`);
    await delay(1300);

    if (Math.random() < 0.95) {
      return {
        success: true,
        transactionId: mockId('re'),
        timestamp: new Date(),
        amount,
      };
    }
    return {
      success: false,
      errorMessage: 'Simulated refund failure',
      timestamp: new Date(),
    };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function mockId(prefix: string): string {
  return `${prefix}_mock_${Math.random().toString(36).slice(2, 15)}`;
}

function randomCardBrand(): string {
  const brands = ['Visa', 'Mastercard', 'Amex', 'Discover'];
  return brands[Math.floor(Math.random() * brands.length)];
}

function randomLast4(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
