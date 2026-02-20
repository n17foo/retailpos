// Import Worldpay SDK
import '@worldpay/access-worldpay-checkout-react-native-sdk';
import { PaymentRequest, PaymentResponse, PaymentServiceInterface } from './PaymentServiceInterface';

// Since we're having issues with the types, we'll use dynamic imports with proper types
// This allows us to use the SDK while maintaining type safety in our own code
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party SDK with no type definitions
type WorldpaySDKType = any;

declare const global: { Worldpay?: WorldpaySDKType };

// Access the SDK through the global namespace as it might be exposed
const WorldpaySDK: WorldpaySDKType = global.Worldpay || require('@worldpay/access-worldpay-checkout-react-native-sdk');

// Define payment device interface since it's not exported by the SDK
interface PaymentDevice {
  id: string;
  name: string;
  type?: string;
  model?: string;
  connectionType?: string;
  status?: string;
}

// Define configuration interface since it's not exported by the SDK
interface DeviceConfig {
  merchantId: string;
  environment: string;
  siteReference: string;
  installationId: string;
  timeoutSeconds?: number;
}

// Define device status enum since it's not exported by the SDK
enum DeviceStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTING = 'DISCONNECTING',
  ERROR = 'ERROR',
}

// Define custom interfaces for types not exported by the SDK
interface TransactionStatus {
  transactionId: string;
  status: string;
  responseCode: string;
  responseMessage?: string;
}

// Define a proper error class for Worldpay errors
class WorldpayError extends Error {
  code: string;

  constructor(options: { code: string; message: string }) {
    super(options.message);
    this.code = options.code;
    this.name = 'WorldpayError';

    // This is needed because TypeScript's extend of built-in types
    Object.setPrototypeOf(this, WorldpayError.prototype);
  }
}

// Payment and transaction result interfaces
interface PaymentResult {
  responseCode: string;
  transactionId?: string;
  errorMessage?: string;
  transactionState?: string;
  orderCode?: string;
}

interface TransactionResult {
  responseCode: string;
  transactionId?: string;
  errorMessage?: string;
  transactionState?: string;
}

interface RefundResult extends TransactionResult {
  refundTransactionId?: string;
}

interface VoidResult extends TransactionResult {}

// The PaymentRequest and PaymentResponse interfaces are now imported from paymentServiceInterface.ts

// Worldpay SDK configuration
const worldpayConfig: DeviceConfig = {
  merchantId: process.env.WORLDPAY_MERCHANT_ID || 'YOUR_WORLDPAY_MERCHANT_ID', // Should be set in .env file for production
  environment: process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'TEST',
  siteReference: process.env.WORLDPAY_SITE_REFERENCE || 'YOUR_WORLDPAY_SITE_REFERENCE',
  installationId: process.env.WORLDPAY_INSTALLATION_ID || 'YOUR_WORLDPAY_INSTALLATION_ID',
  timeoutSeconds: 60, // 60 seconds timeout for terminal operations
};

/**
 * Service to handle communication with Worldpay payment terminals
 * Uses the official Worldpay React Native SDK
 */
export class WorldpayService implements PaymentServiceInterface {
  private static instance: WorldpayService;
  private checkout: WorldpaySDKType;
  private isConnected: boolean = false;
  private deviceId: string | null = null;
  private connectedDevice: PaymentDevice | null = null;

  private constructor() {
    try {
      // Initialize Worldpay SDK using a more flexible approach
      // Try different ways to access the SDK as libraries may expose their APIs differently
      if (typeof WorldpaySDK === 'function') {
        // If it's a constructor function
        this.checkout = new WorldpaySDK(worldpayConfig);
      } else if (WorldpaySDK.init) {
        // If it has an init function
        this.checkout = WorldpaySDK;
        this.checkout.init(worldpayConfig);
      } else if (WorldpaySDK.initialize) {
        // If it has an initialize function
        this.checkout = WorldpaySDK;
        this.checkout.initialize(worldpayConfig);
      } else if (WorldpaySDK.Checkout) {
        // If it exports a Checkout property
        this.checkout = WorldpaySDK.Checkout.getInstance();
        this.checkout.initialize(worldpayConfig);
      } else {
        // Fallback to using the object directly
        this.checkout = WorldpaySDK;
        console.warn('Worldpay SDK initialized using default approach - verify this works correctly');
        this.checkout.initialize(worldpayConfig);
      }

      console.log('Worldpay payment service initialized successfully');

      // Set up device status listener
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to initialize Worldpay payment service:', error);
      this.isConnected = false;
    }
  }

  private setupEventListeners(): void {
    // Listen for device status changes
    this.checkout.addDeviceStatusListener((device: PaymentDevice, status: string) => {
      console.log(`Payment device ${device.id} status changed: ${status}`);

      if (device.id === this.deviceId) {
        this.isConnected = status === DeviceStatus.CONNECTED;

        if (!this.isConnected) {
          this.deviceId = null;
          this.connectedDevice = null;
        }
      }
    });
  }

  public static getInstance(): WorldpayService {
    if (!WorldpayService.instance) {
      WorldpayService.instance = new WorldpayService();
    }
    return WorldpayService.instance;
  }

  /**
   * Connect to a Worldpay payment terminal device
   * Uses Bluetooth, USB, or network communication based on the device type
   */
  public async connectToTerminal(deviceId: string): Promise<boolean> {
    try {
      console.log(`Connecting to Worldpay payment terminal: ${deviceId}`);

      // Discover available payment terminals
      const devices = await this.checkout.scanForDevices();

      // Find the requested device from the discovered devices
      const targetDevice = devices.find(device => device.id === deviceId);

      if (!targetDevice) {
        throw new WorldpayError({
          code: 'DEVICE_NOT_FOUND',
          message: `Device with ID ${deviceId} not found`,
        });
      }

      // Connect to the terminal
      await this.checkout.connectToDevice(targetDevice);

      this.isConnected = true;
      this.deviceId = deviceId;
      this.connectedDevice = targetDevice;

      console.log(`Successfully connected to terminal: ${targetDevice.name}`);
      return true;
    } catch (error) {
      console.error('Failed to connect to Worldpay payment terminal:', error);
      this.isConnected = false;
      this.deviceId = null;
      this.connectedDevice = null;

      // Rethrow specific connection errors for better error handling in UI
      if (error instanceof WorldpayError) {
        throw error;
      }

      return false;
    }
  }

  /**
   * Send payment request to Worldpay terminal
   */
  public async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.isConnected || !this.deviceId || !this.connectedDevice) {
      throw new Error('Not connected to payment terminal');
    }

    try {
      console.log(`Processing payment of $${request.amount.toFixed(2)} on terminal ${this.deviceId}`);

      // Format payment request for Worldpay SDK
      const paymentRequest = {
        amount: Math.round(request.amount * 100), // Convert to cents/pennies
        currencyCode: 'USD', // Can be made configurable
        orderCode: request.reference,
        orderDescription: `Order ${request.reference}`,
        captureDelay: '0', // Capture immediately
        customerOrderCode: request.reference,
        includeOrderDetails: true,
      };

      if (request.items && request.items.length > 0) {
        // Add line item details if available
        paymentRequest['orderContent'] = request.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          amount: Math.round(item.price * item.quantity * 100),
          description: `${item.name} x${item.quantity}`,
        }));
      }

      // Send the payment request to the physical terminal
      // This will display on the terminal and wait for the customer to tap/insert their card
      const result: PaymentResult = await this.checkout.processPayment(paymentRequest);

      // Map the Worldpay result to our application's PaymentResponse
      if (result.responseCode === '0' && result.transactionState === 'SUCCESS') {
        return {
          success: true,
          transactionId: result.transactionId,
          receiptNumber: result.orderCode || `RCPT-${result.transactionId?.substring(0, 8)}`,
          timestamp: new Date(),
        };
      } else {
        return {
          success: false,
          errorMessage:
            result.transactionState === 'DECLINED'
              ? 'Payment declined by card issuer'
              : result.transactionState === 'CANCELLED'
                ? 'Payment was cancelled'
                : result.errorMessage || 'Payment failed',
          timestamp: new Date(),
        };
      }
    } catch (error) {
      console.error('Worldpay payment processing error:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown payment processing error',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Retrieve a list of available payment terminals
   * Useful for displaying a list of terminals to connect to
   */
  public async getAvailableTerminals(): Promise<PaymentDevice[]> {
    try {
      return await this.checkout.scanForDevices();
    } catch (error) {
      console.error('Failed to discover payment terminals:', error);
      return [];
    }
  }

  /**
   * Disconnect from the Worldpay terminal
   */
  public disconnect(): void {
    if (this.isConnected && this.connectedDevice) {
      console.log(`Disconnecting from Worldpay terminal: ${this.deviceId}`);

      this.checkout
        .disconnectFromDevice(this.connectedDevice)
        .then(() => {
          console.log('Successfully disconnected from terminal');
        })
        .catch(error => {
          console.error('Error during disconnect:', error);
        })
        .finally(() => {
          this.isConnected = false;
          this.deviceId = null;
          this.connectedDevice = null;
        });
    }
  }

  /**
   * Check if connected to a Worldpay terminal
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
   * Get the transaction status
   * Used to check the status of a previous transaction
   */
  public async getTransactionStatus(transactionId: string): Promise<PaymentResponse> {
    if (!this.isConnected) {
      throw new Error('Not connected to payment terminal');
    }

    try {
      const status = await this.checkout.getTransactionStatus(transactionId);
      return {
        success: status?.approved === true,
        transactionId,
        timestamp: new Date(),
        amount: status?.amount || 0,
        paymentMethod: 'worldpay',
        cardBrand: status?.cardBrand || 'unknown',
        last4: status?.last4 || 'xxxx',
      };
    } catch (error) {
      console.error('Failed to get transaction status:', error);
      return {
        success: false,
        transactionId,
        timestamp: new Date(),
        amount: 0,
        paymentMethod: 'worldpay',
        cardBrand: 'unknown',
        last4: 'xxxx',
        errorMessage: error instanceof Error ? error.message : 'Failed to get transaction status',
      };
    }
  }

  /**
   * Void/cancel a transaction
   * Used to cancel a previously approved transaction that hasn't been settled yet
   */
  public async voidTransaction(transactionId: string): Promise<PaymentResponse> {
    if (!this.isConnected) {
      throw new Error('Not connected to payment terminal');
    }

    try {
      const result: VoidResult = await this.checkout.voidTransaction({
        transactionId: transactionId,
      });

      return {
        success: result.responseCode === '0',
        transactionId: result.transactionId,
        errorMessage: result.responseCode !== '0' ? result.errorMessage || 'Failed to void transaction' : undefined,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Failed to void transaction:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error voiding transaction',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Issue a refund
   * Used to refund a previously settled transaction
   */
  public async refundTransaction(transactionId: string, amount: number): Promise<PaymentResponse> {
    if (!this.isConnected) {
      throw new Error('Not connected to payment terminal');
    }

    try {
      const result: RefundResult = await this.checkout.refundTransaction({
        transactionId: transactionId,
        amount: Math.round(amount * 100), // Convert to cents/pennies
        refundReason: 'Customer refund request',
      });

      return {
        success: result.responseCode === '0',
        transactionId: result.refundTransactionId,
        errorMessage: result.responseCode !== '0' ? result.errorMessage || 'Failed to process refund' : undefined,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Failed to process refund:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error processing refund',
        timestamp: new Date(),
      };
    }
  }
}
