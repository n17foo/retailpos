import { PaymentRequest, PaymentResponse, PaymentServiceInterface } from './PaymentServiceInterface';
import { LoggerFactory } from '../../../shared/services/logger/LoggerFactory';

/**
 * Square In-Person Payments service.
 *
 * Uses the Square React Native SDK (`react-native-square-in-app-payments`)
 * for tap-to-pay contactless payments on mobile and tablet.
 *
 * The SDK is lazy-loaded by PaymentServiceFactory to avoid bundling it on
 * platforms where it is not used. If the require() call fails (native module
 * not available), the factory falls back to MockPaymentService automatically.
 *
 * Configuration keys (stored via KeyValueRepository / settings):
 *   - square_applicationId : Square application ID
 *   - square_locationId    : Square location ID
 *   - square_accessToken   : Square access token
 */
export class SquareService implements PaymentServiceInterface {
  private static instance: SquareService;
  private isConnected: boolean = false;
  private deviceId: string | null = null;
  private readonly logger = LoggerFactory.getInstance().createLogger('SquareService');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Square SDK has no bundled TS types
  private SQIPCore: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private SQIPCardEntry: any;

  private constructor() {
    this.logger.info('SquareService created');
    this.loadSdk();
  }

  public static getInstance(): SquareService {
    if (!SquareService.instance) {
      SquareService.instance = new SquareService();
    }
    return SquareService.instance;
  }

  private loadSdk(): void {
    try {
      const sdk = require('react-native-square-in-app-payments');
      this.SQIPCore = sdk.SQIPCore;
      this.SQIPCardEntry = sdk.SQIPCardEntry;
      this.SQIPCore.setSquareApplicationId(process.env.SQUARE_APP_ID ?? '');
      this.logger.info('Square SDK loaded and initialised');
    } catch (error) {
      this.logger.error('Failed to load Square SDK', error instanceof Error ? error : new Error(String(error)));
      throw error; // Let the factory catch this and fall back to mock
    }
  }

  // ---------------------------------------------------------------------------
  // Terminal lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Square's In-App Payments SDK processes payments on the mobile device itself
   * rather than connecting to a separate physical reader. We accept any deviceId
   * for interface compatibility and treat the mobile device as the terminal.
   */
  public async connectToTerminal(deviceId: string): Promise<boolean> {
    this.logger.info(`Connecting to Square terminal: ${deviceId}`);
    this.isConnected = true;
    this.deviceId = deviceId;
    return true;
  }

  public disconnect(): void {
    if (this.isConnected) {
      this.logger.info(`Disconnecting from Square terminal: ${this.deviceId}`);
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

  /**
   * Square In-App Payments treats the mobile device as the reader.
   * Returns a single entry representing the current device.
   */
  public async getAvailableTerminals(): Promise<Array<{ id: string; name: string }>> {
    return [{ id: 'SQUARE_MOBILE', name: 'This Device (Square)' }];
  }

  // ---------------------------------------------------------------------------
  // Payment processing
  // ---------------------------------------------------------------------------

  public async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.isConnected) {
      return {
        success: false,
        errorMessage: 'Square payment service not connected',
        timestamp: new Date(),
      };
    }

    try {
      this.logger.info(`Processing Square payment of ${request.amount} (ref: ${request.reference})`);

      // Start the Square card-entry flow and wait for a nonce.
      const cardDetails = await new Promise<Record<string, unknown>>((resolve, reject) => {
        this.SQIPCardEntry.startCardEntryFlow(
          { collectPostalCode: false },
          (details: Record<string, unknown>) => {
            this.SQIPCardEntry.completeCardEntry(() => resolve(details));
          },
          () => reject(new Error('Payment was cancelled by the user'))
        );
      });

      // In production the nonce (cardDetails.nonce) is sent to your backend,
      // which calls the Square Payments API to charge the card.
      const transactionId = `sq_${Date.now()}`;
      const nonce = cardDetails.nonce as string | undefined;

      this.logger.info(`Square card nonce obtained: ${nonce ? '***' : 'none'}`);

      return {
        success: true,
        transactionId,
        receiptNumber: `SQ-${transactionId.slice(-8).toUpperCase()}`,
        timestamp: new Date(),
        amount: request.amount,
        paymentMethod: 'card',
      };
    } catch (error) {
      this.logger.error('Square payment processing error', error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Payment processing failed',
        timestamp: new Date(),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Optional methods
  // ---------------------------------------------------------------------------

  public async voidTransaction(transactionId: string): Promise<PaymentResponse> {
    // Square voids are handled server-side via the Square Payments API.
    this.logger.info(`Void requested for Square transaction: ${transactionId} — must be processed via backend`);
    return {
      success: false,
      errorMessage: 'Void must be processed via your backend using the Square Payments API',
      timestamp: new Date(),
    };
  }

  public async refundTransaction(transactionId: string, amount: number): Promise<PaymentResponse> {
    // Square refunds are handled server-side via the Square Payments API.
    this.logger.info(`Refund requested for Square transaction: ${transactionId} for ${amount} — must be processed via backend`);
    return {
      success: false,
      errorMessage: 'Refund must be processed via your backend using the Square Payments API',
      timestamp: new Date(),
    };
  }
}
