// Only import mock payment services to avoid native module errors in Expo Go
import { SquareMockService } from './mock/squareMockService';
import { StripeMockService } from './mock/stripeMockService';
import { StripeNfcMockService } from './mock/stripeNfcMockService';
import { WorldpayMockService } from './mock/worldpayMockService';
import { PaymentServiceInterface } from './paymentServiceInterface';
import { LoggerFactory } from '../logger';
import { USE_MOCK_PAYMENT } from '@env';
/**
 * Available payment processors
 */
export enum PaymentProvider {
  WORLDPAY = 'worldpay',
  STRIPE = 'stripe',
  STRIPE_NFC = 'stripe_nfc',
  SQUARE = 'square',
}

/**
 * Factory for creating payment service instances
 * Allows the application to switch between different payment providers
 */
export class PaymentServiceFactory {
  private static instance: PaymentServiceFactory;
  private currentProvider: PaymentProvider = PaymentProvider.WORLDPAY; // Default provider
  private logger = LoggerFactory.getInstance().createLogger('PaymentServiceFactory');

  private constructor() {}

  public static getInstance(): PaymentServiceFactory {
    if (!PaymentServiceFactory.instance) {
      PaymentServiceFactory.instance = new PaymentServiceFactory();
    }
    return PaymentServiceFactory.instance;
  }

  /**
   * Get the current payment service
   * Note: Only mock services are used in this build to avoid native module errors
   */
  public getPaymentService(): PaymentServiceInterface {
    this.logger.info(`Getting payment service (mock=${USE_MOCK_PAYMENT}, provider=${this.currentProvider})`);
    try {
      switch (this.currentProvider) {
        case PaymentProvider.STRIPE:
          return USE_MOCK_PAYMENT === 'true' ? StripeMockService.getInstance() : require('./stripeService').StripeService.getInstance();
        case PaymentProvider.STRIPE_NFC:
          return USE_MOCK_PAYMENT === 'true'
            ? StripeNfcMockService.getInstance()
            : require('./stripeNfcService').StripeNfcService.getInstance();
        case PaymentProvider.SQUARE:
          if (USE_MOCK_PAYMENT === 'true') {
            return SquareMockService.getInstance();
          } else {
            // Lazy load to avoid bundling issues with react-native-square-in-app-payments
            try {
              const { SquareService } = require('./squareService');
              return SquareService.getInstance();
            } catch (error) {
              this.logger.warn({ message: 'Square service not available, falling back to mock' }, error instanceof Error ? error : new Error(String(error)));
              return SquareMockService.getInstance();
            }
          }
        case PaymentProvider.WORLDPAY:
        default:
          return USE_MOCK_PAYMENT === 'true'
            ? WorldpayMockService.getInstance()
            : require('./worldpayService').WorldpayService.getInstance();
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error({ message: 'Failed to initialize payment service' }, error instanceof Error ? error : new Error(msg));
      throw new Error('Failed to initialize payment service: ' + msg);
    }
  }

  /**
   * Set the payment provider to use
   */
  public setPaymentProvider(provider: PaymentProvider): void {
    this.currentProvider = provider;
    this.logger.info(`Payment provider set to: ${provider}`);
  }

  /**
   * Get the current payment provider
   */
  public getCurrentProvider(): PaymentProvider {
    return this.currentProvider;
  }
}
