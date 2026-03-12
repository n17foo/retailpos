import { PaymentRequest, PaymentResponse, PaymentServiceInterface } from './PaymentServiceInterface';
import { LoggerFactory } from '../logger/LoggerFactory';
import { getElectronAPI } from '../../utils/electron';
import { keyValueRepository } from '../../repositories/KeyValueRepository';

/**
 * Electron-specific payment service.
 *
 * On desktop (Electron) the React Native payment SDKs are unavailable:
 *  - `@stripe/stripe-terminal-react-native` → requires native iOS/Android modules
 *  - `react-native-square-in-app-payments` → mobile-only
 *  - `@worldpay/access-worldpay-checkout-react-native-sdk` → mobile-only
 *
 * This service delegates to the Electron main process via IPC methods that use
 * the **Stripe Terminal JS SDK** (`@stripe/terminal-js`) which is designed for
 * web / Node.js environments. The main process manages the SDK lifecycle and
 * communicates with Stripe smart readers over the local network.
 *
 * For non-Stripe payment terminals on desktop, the Electron main process can
 * integrate with the terminal vendor's desktop SDK (e.g. Worldpay Desktop Gateway)
 * and expose similar IPC methods.
 */
export class ElectronPaymentService implements PaymentServiceInterface {
  private static instance: ElectronPaymentService;
  private logger = LoggerFactory.getInstance().createLogger('ElectronPaymentService');
  private connected = false;
  private readerId: string | null = null;
  private initialized = false;

  private constructor() {
    this.logger.info('Electron payment service created');
  }

  static getInstance(): ElectronPaymentService {
    if (!ElectronPaymentService.instance) {
      ElectronPaymentService.instance = new ElectronPaymentService();
    }
    return ElectronPaymentService.instance;
  }

  /**
   * Initialise the Stripe Terminal JS SDK in the Electron main process.
   */
  private async ensureInitialized(): Promise<boolean> {
    if (this.initialized) return true;

    const api = getElectronAPI();
    if (!api) {
      this.logger.error('ElectronAPI not available');
      return false;
    }

    try {
      const settings = await keyValueRepository.getObject<{
        stripePublishableKey?: string;
        stripeLocationId?: string;
      }>('paymentSettings');

      if (!settings?.stripePublishableKey) {
        this.logger.warn('Stripe publishable key not configured in payment settings');
        return false;
      }

      this.initialized = await api.paymentInit({
        publishableKey: settings.stripePublishableKey,
        locationId: settings.stripeLocationId || '',
      });

      return this.initialized;
    } catch (error) {
      this.logger.error({ message: 'Failed to initialise Stripe Terminal' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async connectToTerminal(deviceId: string): Promise<boolean> {
    const api = getElectronAPI();
    if (!api) return false;

    if (!(await this.ensureInitialized())) return false;

    try {
      this.logger.info(`Connecting to Stripe reader: ${deviceId}`);
      const result = await api.paymentConnectReader(deviceId);
      this.connected = result;
      this.readerId = result ? deviceId : null;
      return result;
    } catch (error) {
      this.logger.error({ message: 'Failed to connect to reader' }, error instanceof Error ? error : new Error(String(error)));
      this.connected = false;
      this.readerId = null;
      return false;
    }
  }

  async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.connected) {
      throw new Error('Not connected to payment terminal');
    }

    const api = getElectronAPI();
    if (!api) {
      return { success: false, errorMessage: 'ElectronAPI not available', timestamp: new Date() };
    }

    try {
      this.logger.info(`Processing payment of ${request.amount.toFixed(2)} on Electron terminal`);

      const result = await api.paymentCollect({
        amount: request.amount,
        currency: request.currency || 'gbp',
        reference: request.reference,
      });

      return {
        success: result.success,
        transactionId: result.transactionId,
        errorMessage: result.errorMessage,
        cardBrand: result.cardBrand,
        last4: result.last4,
        timestamp: new Date(),
        paymentMethod: 'card',
      };
    } catch (error) {
      this.logger.error({ message: 'Payment processing failed' }, error instanceof Error ? error : new Error(String(error)));
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown payment error',
        timestamp: new Date(),
      };
    }
  }

  disconnect(): void {
    const api = getElectronAPI();
    if (api && this.connected) {
      api.paymentDisconnect().catch(err => {
        this.logger.error({ message: 'Error disconnecting from reader' }, err instanceof Error ? err : new Error(String(err)));
      });
    }
    this.connected = false;
    this.readerId = null;
  }

  isTerminalConnected(): boolean {
    return this.connected;
  }

  getConnectedDeviceId(): string | null {
    return this.readerId;
  }

  async getAvailableTerminals(): Promise<Array<{ id: string; name: string }>> {
    const api = getElectronAPI();
    if (!api) return [];

    if (!(await this.ensureInitialized())) return [];

    try {
      return await api.paymentDiscoverReaders();
    } catch (error) {
      this.logger.error({ message: 'Failed to discover readers' }, error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  async voidTransaction(transactionId: string): Promise<PaymentResponse> {
    // Stripe Terminal JS SDK doesn't support direct void — must use server-side API
    this.logger.warn(`Void not supported via Electron terminal SDK for ${transactionId}`);
    return {
      success: false,
      errorMessage: 'Void must be processed via Stripe Dashboard or server API',
      timestamp: new Date(),
    };
  }

  async refundTransaction(transactionId: string, _amount: number): Promise<PaymentResponse> {
    // Stripe Terminal JS SDK refunds are server-side only
    this.logger.warn(`Refund not supported via Electron terminal SDK for ${transactionId}`);
    return {
      success: false,
      errorMessage: 'Refund must be processed via Stripe Dashboard or server API',
      timestamp: new Date(),
    };
  }
}
