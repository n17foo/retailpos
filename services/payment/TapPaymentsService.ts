import { getStoreCurrencyCode } from '../config/StoreCurrency';
import { PaymentRequest, PaymentResponse, PaymentServiceInterface } from './PaymentServiceInterface';
import { LoggerFactory } from '../logger/LoggerFactory';

/**
 * Tap Payments In-Person Payments service.
 *
 * Uses the Tap Payments React Native SDK (`card-react-native`) for
 * tap-to-pay contactless payments on mobile and tablet.
 *
 * The SDK is lazy-loaded by PaymentServiceFactory to avoid bundling it on
 * platforms where it is not used. If the require() call fails (native module
 * not available), the factory falls back to MockPaymentService automatically.
 *
 * Configuration keys (stored via KeyValueRepository / settings):
 *   - tap_payments_apiKey       : Tap Payments secret API key
 *   - tap_payments_publishableKey : Tap Payments publishable key
 *   - tap_payments_merchantId   : Tap Payments merchant ID
 */
export class TapPaymentsService implements PaymentServiceInterface {
  private static instance: TapPaymentsService;
  private isConnected: boolean = false;
  private deviceId: string | null = null;
  private readonly logger = LoggerFactory.getInstance().createLogger('TapPaymentsService');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tap Payments SDK has no bundled TS types
  private sdk: any = null;

  private constructor() {
    this.logger.info('TapPaymentsService created');
    this.loadSdk();
  }

  public static getInstance(): TapPaymentsService {
    if (!TapPaymentsService.instance) {
      TapPaymentsService.instance = new TapPaymentsService();
    }
    return TapPaymentsService.instance;
  }

  private loadSdk(): void {
    try {
      this.sdk = require('card-react-native');
      this.logger.info('Tap Payments (card-react-native) SDK loaded');
    } catch (error) {
      this.logger.error('Failed to load Tap Payments SDK', error instanceof Error ? error : new Error(String(error)));
      throw error; // Let the factory catch this and fall back to mock
    }
  }

  // ---------------------------------------------------------------------------
  // Terminal lifecycle
  // ---------------------------------------------------------------------------

  public async connectToTerminal(deviceId: string): Promise<boolean> {
    try {
      this.logger.info(`Connecting to Tap Payments terminal: ${deviceId}`);
      await this.sdk.TapPayments.connect({ terminalId: deviceId });
      this.isConnected = true;
      this.deviceId = deviceId;
      this.logger.info(`Connected to Tap Payments terminal: ${deviceId}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to Tap Payments terminal', error instanceof Error ? error : new Error(String(error)));
      this.isConnected = false;
      this.deviceId = null;
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    try {
      this.logger.info(`Disconnecting from Tap Payments terminal: ${this.deviceId}`);
      await this.sdk.TapPayments.disconnect();
    } catch (error) {
      this.logger.error('Error disconnecting from Tap Payments terminal', error instanceof Error ? error : new Error(String(error)));
    } finally {
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
    try {
      this.logger.info('Discovering Tap Payments terminals');
      const terminals: Array<{ id: string; name: string }> = await this.sdk.TapPayments.discoverTerminals();
      return terminals.map(t => ({ id: t.id, name: t.name || t.id }));
    } catch (error) {
      this.logger.error('Failed to discover Tap Payments terminals', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Payment processing
  // ---------------------------------------------------------------------------

  public async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.isConnected || !this.deviceId) {
      return {
        success: false,
        errorMessage: 'Not connected to a Tap Payments terminal',
        timestamp: new Date(),
      };
    }

    try {
      this.logger.info(`Processing Tap Payments payment of ${request.amount} (ref: ${request.reference})`);

      const result = await this.sdk.TapPayments.charge({
        amount: request.amount,
        currency: request.currency?.toUpperCase(),
        reference: { transaction: request.reference, order: request.orderId ?? request.reference },
        customer: { name: request.customerName ?? '' },
        metadata: { orderId: request.orderId ?? '' },
      });

      if (result.status === 'CAPTURED') {
        return {
          success: true,
          transactionId: result.id,
          receiptNumber: result.receiptId ?? result.id,
          timestamp: new Date(),
          amount: request.amount,
          paymentMethod: result.paymentMethod ?? 'contactless',
          cardBrand: result.card?.brand,
          last4: result.card?.lastFour,
        };
      }

      return {
        success: false,
        errorMessage: result.response?.message ?? 'Payment was not captured',
        errorCode: result.status,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Tap Payments processing error', error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Payment processing failed',
        errorCode: 'payment_error',
        timestamp: new Date(),
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Optional methods
  // ---------------------------------------------------------------------------

  public async voidTransaction(transactionId: string): Promise<PaymentResponse> {
    try {
      this.logger.info(`Voiding Tap Payments transaction: ${transactionId}`);
      const result = await this.sdk.TapPayments.void({ chargeId: transactionId });
      return {
        success: result.status === 'VOIDED',
        transactionId,
        timestamp: new Date(),
        errorMessage: result.status !== 'VOIDED' ? 'Void was not accepted' : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to void Tap Payments transaction', error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Void failed',
        timestamp: new Date(),
      };
    }
  }

  public async refundTransaction(transactionId: string, amount: number): Promise<PaymentResponse> {
    try {
      this.logger.info(`Refunding Tap Payments transaction: ${transactionId} for ${amount}`);
      const result = await this.sdk.TapPayments.refund({
        chargeId: transactionId,
        amount,
        currency: (await getStoreCurrencyCode()).toUpperCase(),
      });
      return {
        success: result.status === 'REFUNDED',
        transactionId: result.id ?? transactionId,
        timestamp: new Date(),
        amount,
        errorMessage: result.status !== 'REFUNDED' ? 'Refund was not accepted' : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to refund Tap Payments transaction', error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Refund failed',
        timestamp: new Date(),
      };
    }
  }
}
