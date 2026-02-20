# Payments

## User Story

**As a** retail cashier  
**I want to** process customer payments through card terminals  
**So that** transactions are completed securely and receipts are generated

## Rules

- Supports multiple providers: Stripe, Stripe NFC, Square, Worldpay, mock
- Stripe NFC uses specialized tap-to-pay component (mobile/tablet only)
- Traditional terminals require device selection and connection
- Payment responses include transactionId, receiptNumber, cardBrand, last4, paymentMethod
- Refunds support full and partial amounts via transactionId
- Terminal auto-disconnects when leaving the payment screen
- Demo mode available when no route params provided
- Audit log records every payment, void, and refund

---

## Flow 1: Terminal Connection & Card Payment

1. **Checkout triggers payment** → navigates to PaymentTerminalScreen with amount and items
2. **Discover terminals** → getAvailableTerminals() returns list of {id, name}
3. **Cashier selects terminal** → connectToTerminal(deviceId) called
4. **Connection spinner** → UI shows loading indicator
5. **Connected** → status shows "Connected to: Main Counter"
6. **Tap "Process Payment"** → processPayment({ amount, reference, currency, items }) sent to terminal
7. **Processing spinner** → "Processing payment..." displayed
8. **Success** → PaymentResponse returned with transactionId, receiptNumber, cardBrand, last4
9. **Receipt generated** → payment details forwarded to printer service
10. **Cash drawer** → if drawerOpenOnCash enabled and payment is cash, drawer opens
11. **Screen unmounts** → auto-disconnect from terminal, cleanup resources

## Flow 2: Stripe NFC Tap-to-Pay (Mobile/Tablet)

1. **Payment provider is Stripe NFC** → detected from payment config
2. **Specialized component renders** → StripeNfcPaymentTerminal replaces standard terminal UI
3. **Customer taps card/phone** → NFC reader captures payment data
4. **Stripe processes** → payment authorized via Stripe API
5. **Success** → returns transactionId, paymentMethod: "contactless"
6. **Failure** → error shown with retry option

## Flow 3: Payment Failure & Retry

1. **Payment submitted** → terminal processes request
2. **Card declined** → PaymentResponse returns success: false, errorCode: "card_declined"
3. **Error alert shown** → "Card declined" with "Try Again" and "Cancel" buttons
4. **Try Again** → returns to payment screen, terminal stays connected
5. **Cancel** → onCancel callback fired, navigates back to order screen
6. **Error logged** → audit trail records failure with errorCode and timestamp

## Flow 4: Transaction Refund

1. **Manager opens Refund screen** → enters transactionId and refund amount
2. **refundTransaction(transactionId, amount)** → sent to payment provider
3. **Provider processes** → contacts payment gateway for refund authorization
4. **Success** → PaymentResponse with refund details returned
5. **Order updated** → paymentStatus changes to "partially_refunded" or "refunded"
6. **Audit logged** → refund:processed event recorded with userId and amount

## Flow 5: Transaction Void

1. **Payment initiated but needs cancellation** → before settlement
2. **voidTransaction(transactionId)** → sent to payment provider
3. **Provider cancels** → prevents charge from settling
4. **Success** → PaymentResponse indicates void status
5. **Customer not charged** → prevents double-charging

## Flow 6: Demo Mode

1. **PaymentTerminalScreen opened without route params** → demo mode detected
2. **Demo amount ($25.99)** and demo item displayed
3. **"Demo Mode" subtitle** shown in header
4. **Process payment** → simulated transaction via mock provider
5. **Success alert** → shows demo transaction details
6. **No real charges** → safe for training and testing

## Flow 7: Terminal Status Monitoring

1. **Payment service initialized** → tracks connection state
2. **isTerminalConnected()** → returns current boolean status
3. **getConnectedDeviceId()** → returns device ID or null
4. **UI indicators update** → green/red connection badge
5. **Unexpected disconnect** → error notification, prompt to reconnect

## Questions

- What happens if terminal connection drops mid-payment?
- How does the system handle partial payment authorizations?
- What PCI compliance measures protect card data in transit?
- How are payment failures surfaced for fraud detection?
- What is the timeout for terminal connections before auto-disconnect?
