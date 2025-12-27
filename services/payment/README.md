# RetailPOS Payment Service

This document provides an overview of the payment service architecture and integration, with a special focus on the Stripe NFC Tap to Pay implementation.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Available Payment Providers](#available-payment-providers)
- [Stripe NFC Tap to Pay](#stripe-nfc-tap-to-pay)
- [Integration Status](#integration-status)
- [Remaining Implementation Steps](#remaining-implementation-steps)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

The payment service in RetailPOS follows a factory pattern design to support multiple payment providers while maintaining a consistent interface. The architecture consists of:

1. **PaymentServiceInterface**: Base interface that all payment providers must implement
2. **PaymentServiceFactory**: Factory class that creates and returns the appropriate payment service
3. **Provider-specific implementations**: Concrete implementations for each payment provider
4. **usePayment Hook**: React hook that provides a unified API for the UI layer

### Core Components:

- **PaymentRequest/PaymentResponse**: Data structures for payment operations
- **Payment Providers**: Implementations for different payment processors
- **Terminal Bridges**: Integration layers for hardware terminals (like Stripe Terminal SDK)
- **Configuration Services**: Store and retrieve payment settings

## Available Payment Providers

The following payment providers are supported:

- **Worldpay**: Traditional card processing
- **Stripe**: Online payments
- **Stripe NFC**: In-person contactless payments using NFC
- **Square**: In-person and online payments

## Stripe NFC Tap to Pay

The Stripe NFC Tap to Pay integration uses Stripe's Terminal SDK to process contactless payments directly on compatible iOS devices with NFC capabilities.

### Key Components:

- **StripeNfcService**: Implements PaymentServiceInterface for Stripe NFC
- **StripeTerminalBridge**: Context provider that wraps the Stripe Terminal SDK
- **StripeNfcPaymentTerminal**: Specialized UI component for Tap to Pay workflow

### Features:

- Terminal discovery and connection management
- Payment processing with detailed responses
- Refund processing
- Error handling and recovery
- Card brand and last 4 digits information
- Animated UI for improved customer experience

## Integration Status

The Stripe NFC Tap to Pay integration has the following components completed:

✅ Core payment processing flow
✅ TypeScript interfaces for payment requests and responses
✅ Integration with Stripe Terminal SDK
✅ Error handling and connection recovery
✅ Specialized UI for Tap to Pay experience
✅ Support for payment metadata (order ID, customer info)
✅ Card brand and last 4 digits in transaction data

## Remaining Implementation Steps

The following enhancements are planned for the Stripe NFC implementation:

### 1. Terminal Discovery and Management

- Implement real terminal discovery instead of using mock data
- Add UI for scanning, selecting, and pairing with available Stripe readers
- Create a terminal management screen for saved readers

### 2. Enhance Configuration and Settings

- Create a dedicated Stripe NFC configuration UI in the settings
- Add connection timeout and retry settings
- Implement reader firmware update checks

### 3. Receipt and Transaction Management

- Generate digital receipts after successful payments
- Implement email/SMS receipt sending functionality
- Add transaction history specific to Stripe NFC payments

### 4. Refund and Transaction Management

- Implement dedicated refund UI for Stripe NFC transactions
- Add partial refund capabilities
- Support card-present refunds to the same card

### 5. Offline Mode and Sync

- Add offline payment capability when internet is unavailable
- Implement transaction syncing when connection is restored
- Add offline mode indicators and warnings

### 6. Testing and Debugging Tools

- Create a test mode with simulated taps
- Add transaction logs for developers
- Implement connection diagnostics

### 7. Security Enhancements

- Implement proper key rotation for Stripe credentials
- Add authentication for sensitive operations
- Secure storage of payment credentials

### 8. Documentation and Onboarding

- Create user documentation for Stripe Terminal setup
- Add in-app onboarding wizard for new Stripe Terminal users
- Provide troubleshooting guides for common issues

### 9. Analytics and Reporting

- Add payment analytics for Stripe NFC transactions
- Implement reporting on transaction success rates
- Track and analyze payment method usage

## Configuration

The Stripe NFC integration uses the StorageService for configuration with the following keys:

- `stripe_nfc_apiKey`: Secret API key
- `stripe_nfc_publishableKey`: Publishable API key
- `stripe_nfc_merchantId`: Stripe merchant ID
- `stripe_nfc_backendUrl`: Backend URL for token generation and other operations
- `stripe_nfc_useDirectApi`: Boolean to control direct API usage vs. backend proxying
- `stripe_nfc_useSimulatedReader`: Boolean to enable simulated readers for testing
- `stripe_nfc_connectionTimeout`: Timeout in milliseconds for reader discovery
- `stripe_nfc_enableNfc`: Master toggle for NFC functionality

## Using the Payment Service

The payment service can be accessed through the `usePayment` hook:

```tsx
const MyComponent = () => {
  const { connectToTerminal, processPayment, disconnect, isTerminalConnected, getConnectedDeviceId, getCurrentProvider } = usePayment();

  const handlePayment = async () => {
    // Create a payment request
    const paymentRequest = {
      amount: 1099, // $10.99
      currency: 'usd',
      reference: 'order-123',
      orderId: 'ORD-123456',
      customerName: 'John Doe',
    };

    // Process the payment
    const response = await processPayment(paymentRequest);

    if (response.success) {
      console.log(`Payment successful: ${response.transactionId}`);
    } else {
      console.error(`Payment failed: ${response.errorMessage}`);
    }
  };
};
```

## Troubleshooting

### Common Issues:

1. **Cannot discover readers:**
   - Ensure Bluetooth and NFC are enabled
   - Check that the device has NFC capabilities
   - Verify the Stripe API keys are correctly configured

2. **Payment processing fails:**
   - Check internet connectivity
   - Verify the terminal is connected
   - Ensure the payment amount is within allowed limits
   - Check that the Stripe account is properly configured for in-person payments

3. **Terminal disconnects frequently:**
   - Keep the iOS device and terminal in close proximity
   - Check for Bluetooth interference
   - Ensure the terminal has sufficient battery

### Debugging:

The Stripe Terminal SDK provides detailed logs that can help diagnose issues:

```typescript
// Enable verbose logging
StripeTerminalBridge.setLogLevel('verbose');

// Check connection status
const isConnected = isTerminalConnected();
console.log(`Terminal connected: ${isConnected}`);

// Get connected terminal ID
const terminalId = getConnectedDeviceId();
console.log(`Connected to terminal: ${terminalId}`);
```

## Contributing

When implementing new payment providers or enhancing existing ones:

1. Implement the `PaymentServiceInterface`
2. Add the provider to the `PaymentProvider` enum
3. Update the factory to return the new service
4. Update the UI to handle any provider-specific features
5. Add appropriate configuration options to settings
