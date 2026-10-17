import { getStoreCurrencyCode } from '../config/StoreCurrency';
import { PaymentRequest, PaymentResponse, PaymentServiceInterface } from './PaymentServiceInterface';
import { LoggerFactory } from '../logger/LoggerFactory';

/**
 * Adyen In-Person Payments service.
 *
 * Uses the Adyen React Native SDK (`@adyen/react-native`) for tap-to-pay
 * contactless payments on mobile and tablet.
 *
 * The SDK is lazy-loaded by PaymentServiceFactory to avoid bundling it on
 * platforms where it is not used. If the require() call fails (native module
 * not available), the factory falls back to MockPaymentService automatically.
 *
 * Configuration keys (stored via KeyValueRepository / settings):
 *   - adyen_apiKey        : Adyen API key
 *   - adyen_clientKey     : Adyen client key (publishable)
 *   - adyen_environment   : 'test' | 'live'
 *   - adyen_merchantAccount : Adyen merchant account name
 */
export class AdyenService implements PaymentServiceInterface {
  private static instance: AdyenService;
  private isConnected: boolean = false;
  private deviceId: string | null = null;
  private readonly logger = LoggerFactory.getInstance().createLogger('AdyenService');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Adyen SDK has no bundled TS types
  private sdk: any = null;

  private constructor() {
    this.logger.info('AdyenService created');
    this.loadSdk();
  }

  public static getInstance(): AdyenService {
    if (!AdyenService.instance) {
      AdyenService.instance = new AdyenService();
    }
    return AdyenService.instance;
  }

  private loadSdk(): void {
    try {
      this.sdk = require('@adyen/react-native');
      this.logger.info('Adyen React Native SDK loaded');
    } catch (error) {
      this.logger.error('Failed to load Adyen SDK', error instanceof Error ? error : new Error(String(error)));
      throw error; // Let the factory catch this and fall back to mock
    }
  }

  // ---------------------------------------------------------------------------
  // Terminal lifecycle
  // ---------------------------------------------------------------------------

  public async connectToTerminal(deviceId: string): Promise<boolean> {
    try {
      this.logger.info(`Connecting to Adyen terminal: ${deviceId}`);
      // Adyen Terminal API: establish a local connection to the payment terminal.
      await this.sdk.AdyenTerminal.connect({ terminalId: deviceId });
      this.isConnected = true;
      this.deviceId = deviceId;
      this.logger.info(`Connected to Adyen terminal: ${deviceId}`);
      return true;
    } catch (error) {
      this.logger.error('Failed to connect to Adyen terminal', error instanceof Error ? error : new Error(String(error)));
      this.isConnected = false;
      this.deviceId = null;
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    try {
      this.logger.info(`Disconnecting from Adyen terminal: ${this.deviceId}`);
      await this.sdk.AdyenTerminal.disconnect();
    } catch (error) {
      this.logger.error('Error disconnecting from Adyen terminal', error instanceof Error ? error : new Error(String(error)));
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
      this.logger.info('Discovering Adyen terminals');
      const terminals: Array<{ terminalId: string; terminalModel: string }> = await this.sdk.AdyenTerminal.discoverTerminals();
      return terminals.map(t => ({ id: t.terminalId, name: t.terminalModel || t.terminalId }));
    } catch (error) {
      this.logger.error('Failed to discover Adyen terminals', error instanceof Error ? error : new Error(String(error)));
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
        errorMessage: 'Not connected to an Adyen terminal',
        timestamp: new Date(),
      };
    }

    try {
      this.logger.info(`Processing Adyen payment of ${request.amount} (ref: ${request.reference})`);

      const result = await this.sdk.AdyenTerminal.startPayment({
        amount: { value: request.amount, currency: request.currency?.toUpperCase() },
        reference: request.reference,
        merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT ?? '',
        metadata: {
          orderId: request.orderId ?? '',
          customerName: request.customerName ?? '',
        },
      });

      if (result.resultCode === 'Authorised') {
        return {
          success: true,
          transactionId: result.pspReference,
          receiptNumber: result.pspReference,
          timestamp: new Date(),
          amount: request.amount,
          paymentMethod: result.paymentMethod ?? 'contactless',
          cardBrand: result.additionalData?.cardBrand,
          last4: result.additionalData?.cardSummary,
        };
      }

      return {
        success: false,
        errorMessage: result.refusalReason ?? 'Payment was not authorised',
        errorCode: result.resultCode,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Adyen payment processing error', error instanceof Error ? error : new Error(String(error)));
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
      this.logger.info(`Voiding Adyen transaction: ${transactionId}`);
      const result = await this.sdk.AdyenTerminal.cancelPayment({ pspReference: transactionId });
      return {
        success: result.status === 'received',
        transactionId,
        timestamp: new Date(),
        errorMessage: result.status !== 'received' ? 'Void request was not accepted' : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to void Adyen transaction', error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Void failed',
        timestamp: new Date(),
      };
    }
  }

  public async refundTransaction(transactionId: string, amount: number): Promise<PaymentResponse> {
    try {
      this.logger.info(`Refunding Adyen transaction: ${transactionId} for ${amount}`);
      const result = await this.sdk.AdyenTerminal.refundPayment({
        pspReference: transactionId,
        amount: { value: amount, currency: (await getStoreCurrencyCode()).toUpperCase() },
      });
      return {
        success: result.status === 'received',
        transactionId: result.pspReference ?? transactionId,
        timestamp: new Date(),
        amount,
        errorMessage: result.status !== 'received' ? 'Refund request was not accepted' : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to refund Adyen transaction', error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Refund failed',
        timestamp: new Date(),
      };
    }
  }
}
