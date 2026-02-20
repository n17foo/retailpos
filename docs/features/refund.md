# Refunds & Returns

## User Story

**As a** retail manager  
**I want to** process refunds for card payments and e-commerce orders  
**So that** customers receive their money back when items are returned

## Rules

- Two refund types: **Payment refund** (card transaction ID) and **E-commerce refund** (platform order ID)
- Amount must be positive and ≤ original transaction amount
- Reason field optional but recommended for audit trail
- Refund history auto-loads when an ID is entered
- ReturnService can orchestrate both return + monetary refund in one operation
- Every refund is audit-logged with userId, amount, reason

---

## Flow 1: Payment Refund (Card Transaction)

1. **Manager opens More → Refunds** → RefundScreen loads, refund service initializes
2. **Select "Payment Refund"** → transaction ID input shown
3. **Enter transaction ID** → e.g. "TXN-12345"
4. **Refund history loads** → previous refunds for this transaction displayed
5. **Enter amount** → e.g. $25.99 (validated as positive, ≤ original)
6. **Enter reason** → "Customer returned defective item"
7. **Tap "Process Refund"** → refundTransaction(transactionId, amount) sent to payment provider
8. **Success** → alert shown, history refreshed, audit logged (refund:processed)
9. **Failure** → error alert, form fields preserved for retry

## Flow 2: E-commerce Order Refund

1. **Select "E-commerce Refund"** → order ID input shown
2. **Enter order ID** → e.g. "ORD-67890"
3. **Refund history loads** → previous refunds for this order from platform
4. **Enter amount and reason** → validated
5. **Tap "Process Refund"** → refund sent to platform API (Shopify, WooCommerce, etc.)
6. **Success** → platform order status updated to partially_refunded or refunded
7. **Audit logged** → refund:processed with orderId, amount, userId

## Flow 3: Return with Refund

1. **ReturnService.processReturn()** called with `issueRefund: true` and `platform`
2. **Returnable items calculated** → checks original order quantities minus already returned
3. **Return record created** → stored in `returns` table
4. **Refund orchestrated** → RefundServiceFactory gets platform refund service
5. **Monetary refund processed** → via payment provider or platform API
6. **ProcessReturnResult** → includes returnId and optional refundId
7. **Notification sent** → "Return processed" via NotificationService

## Flow 4: Refund Validation & Error Handling

1. **Missing fields** → "Transaction ID and amount are required" error, form preserved
2. **Negative amount** → validation rejects, error shown
3. **Amount exceeds original** → validation rejects
4. **Service not initialized** → "Refund service is not initialized" error, button disabled
5. **Provider failure** → error alert with provider error message, retry available

## Flow 5: Refund History

1. **Enter transaction/order ID** → history auto-fetched
2. **Chronological list** → shows each refund: amount, date, status, reason
3. **Partial refunds tracked** → cumulative refunded amount visible
4. **History refreshes** → after each successful refund

## Questions

- How does the system prevent duplicate refunds for the same transaction?
- Can refunds exceed the original transaction amount?
- How are refunds audited for financial compliance?
- How does the return flow integrate with inventory restocking?
