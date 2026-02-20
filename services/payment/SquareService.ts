import { PaymentRequest, PaymentResponse, PaymentServiceInterface } from './PaymentServiceInterface';

// Conditionally import Square SDK to avoid bundling issues
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party SDK with no type definitions
type SquareSDKModule = Record<string, (...args: any[]) => any>;
let SQIPCore: SquareSDKModule;
let SQIPCardEntry: SquareSDKModule;
let SQIPApplePay: SquareSDKModule;
let SQIPGooglePay: SquareSDKModule;

try {
  // Import Square SDK v1.x named exports
  const squareSdk = require('react-native-square-in-app-payments');
  SQIPCore = squareSdk.SQIPCore;
  SQIPCardEntry = squareSdk.SQIPCardEntry;
  SQIPApplePay = squareSdk.SQIPApplePay;
  SQIPGooglePay = squareSdk.SQIPGooglePay;
} catch (error) {
  console.warn('Square SDK not available, running in mock mode:', error);
}

/**
 * Square Payment Service
 * Implements the Square In-App Payments SDK for payment processing
 */
export class SquareService implements PaymentServiceInterface {
  private static instance: SquareService;
  private isConnected: boolean = false;
  private deviceId: string | null = null;
  private connectedDevice: unknown = null;

  private constructor() {
    try {
      // Initialize Square SDK
      this.initializeSquareSdk();
      console.log('Square payment service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Square payment service:', error);
    }
  }

  /**
   * Initialize the Square SDK
   */
  private async initializeSquareSdk() {
    try {
      // Initialize with your Square app ID using SQIPCore
      await SQIPCore.setSquareApplicationId(process.env.SQUARE_APP_ID || 'YOUR_SQUARE_APP_ID');
    } catch (error) {
      console.error('Error initializing Square SDK:', error);
      throw error;
    }
  }

  public static getInstance(): SquareService {
    if (!SquareService.instance) {
      SquareService.instance = new SquareService();
    }
    return SquareService.instance;
  }

  /**
   * Connect to a Square card reader
   * Note: Square's mobile SDK doesn't directly connect to physical readers
   * but rather processes payments directly through the mobile device.
   * This implementation simulates connection for compatibility with our interface.
   */
  public async connectToTerminal(deviceId: string): Promise<boolean> {
    try {
      console.log(`Connecting to Square terminal: ${deviceId}`);

      // For compatibility with our interface, we use the deviceId param
      // In a real Square implementation, you might use this to identify different iOS/Android devices
      // that can accept payments

      this.isConnected = true;
      this.deviceId = deviceId;
      this.connectedDevice = { id: deviceId, name: `Square Reader ${deviceId}` };

      return true;
    } catch (error) {
      console.error('Failed to connect to Square terminal:', error);
      this.isConnected = false;
      this.deviceId = null;
      this.connectedDevice = null;
      return false;
    }
  }

  /**
   * Process payment with Square In-App Payments
   */
  public async processPayment(request: PaymentRequest): Promise<PaymentResponse> {
    if (!this.isConnected) {
      throw new Error('Square payment service not connected');
    }

    try {
      console.log(`Processing payment of $${request.amount.toFixed(2)} with Square`);

      // Start card entry using SQIPCardEntry
      const cardEntryResult = await new Promise<Record<string, unknown>>((resolve, reject) => {
        // Configure the card entry flow with callbacks
        const cardEntryConfig = {
          collectPostalCode: false,
        };

        const onCardNonceRequestSuccess = (cardDetails: Record<string, unknown>) => {
          // Card entry was successful, we now have a nonce
          SQIPCardEntry.completeCardEntry(() => {
            resolve(cardDetails);
          });
        };

        const onCardEntryCancel = () => {
          // User canceled the payment
          reject(new Error('Payment was canceled'));
        };

        // Start the card entry flow
        SQIPCardEntry.startCardEntryFlow(cardEntryConfig, onCardNonceRequestSuccess, onCardEntryCancel);
      });

      // After getting the card nonce, you would normally send this to your server
      // along with the payment amount, and your server would use Square's API to charge the card

      // For demo purposes, we'll simulate a successful payment
      const transactionId = `square_${Date.now()}`;

      return {
        success: true,
        transactionId,
        receiptNumber: `RCPT-${Math.floor(10000 + Math.random() * 90000)}`,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('Square payment processing error:', error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown payment processing error',
        timestamp: new Date(),
      };
    }
  }

  /**
   * Get available payment terminals
   * Note: Square doesn't have the concept of multiple readers in the In-App Payments SDK
   * This simulates available terminals for compatibility
   */
  public async getAvailableTerminals(): Promise<Array<{ id: string; name: string }>> {
    // Simulate available terminals
    return [{ id: 'SQUARE-MOBILE', name: 'This Device (Mobile)' }];
  }

  /**
   * Disconnect from Square
   */
  public disconnect(): void {
    if (this.isConnected) {
      console.log(`Disconnecting from Square terminal: ${this.deviceId}`);
      this.isConnected = false;
      this.deviceId = null;
      this.connectedDevice = null;
    }
  }

  /**
   * Check if connected
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
   * Get transaction status
   */
  public async getTransactionStatus(transactionId: string): Promise<PaymentResponse> {
    // In a real implementation, you would call Square's API to check the status
    // For now, we're simulating a response
    return {
      success: true,
      transactionId,
      timestamp: new Date(),
    };
  }

  /**
   * Square doesn't support direct void through the in-app payments SDK
   * This would normally be done via your backend using Square's API
   */
  public async voidTransaction(transactionId: string): Promise<PaymentResponse> {
    return {
      success: true,
      transactionId,
      timestamp: new Date(),
    };
  }

  /**
   * Issue a refund - in a real implementation, would be done via backend
   */
  public async refundTransaction(transactionId: string, amount: number): Promise<PaymentResponse> {
    return {
      success: true,
      transactionId,
      timestamp: new Date(),
    };
  }
}
