// Only import mock payment services to avoid native module errors in Expo Go
import { SquareMockService } from './mock/squareMockService';
import { StripeMockService } from './mock/stripeMockService';
import { StripeNfcMockService } from './mock/stripeNfcMockService';
import { WorldpayMockService } from './mock/worldpayMockService';
import { PaymentServiceInterface } from './paymentServiceInterface';
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
    console.log(`[PAYMENT SERVICE] Using mock payment service: ${USE_MOCK_PAYMENT}`);
    try {
      switch (this.currentProvider) {
        case PaymentProvider.STRIPE:
          return USE_MOCK_PAYMENT === 'true' ? StripeMockService.getInstance() : require('./stripeService').StripeService.getInstance();
        case PaymentProvider.STRIPE_NFC:
          return USE_MOCK_PAYMENT === 'true'
            ? StripeNfcMockService.getInstance()
            : require('./stripeNfcService').StripeNfcService.getInstance();
        case PaymentProvider.SQUARE:
          return USE_MOCK_PAYMENT === 'true' ? SquareMockService.getInstance() : require('./squareService').SquareService.getInstance();
        case PaymentProvider.WORLDPAY:
        default:
          return USE_MOCK_PAYMENT === 'true'
            ? WorldpayMockService.getInstance()
            : require('./worldpayService').WorldpayService.getInstance();
      }
    } catch (error) {
      console.error(`Failed to initialize payment service: ${error}`);
      throw new Error('Failed to initialize payment service: ' + error.message);
    }
  }

  /**
   * Set the payment provider to use
   */
  public setPaymentProvider(provider: PaymentProvider): void {
    this.currentProvider = provider;
    console.log(`Payment provider set to: ${provider}`);
  }

  /**
   * Get the current payment provider
   */
  public getCurrentProvider(): PaymentProvider {
    return this.currentProvider;
  }
}
