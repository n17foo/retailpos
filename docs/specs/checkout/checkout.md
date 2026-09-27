# Checkout – EARS Requirements

> **System**: RetailPOS – Checkout & Order Lifecycle
> **Actor**: Cashier, System
> **Date**: 2026-04-12
> **Source**: `services/checkout/CheckoutService.ts`, `services/checkout/CheckoutServiceInterface.ts`, `services/order/order.ts`, `repositories/OrderRepository.ts`, `repositories/OrderItemRepository.ts`, `contexts/BasketProvider.tsx`, `components/CheckoutModal.tsx`, `screens/order/BasketContent.tsx`, `screens/order/Basket.tsx`, `hooks/useOrders.ts`, `services/audit/AuditLogService.ts`, `services/config/POSConfigService.ts`

---

## Context

Checkout is the process of converting a basket into a persisted `LocalOrder` and recording a payment against it. `CheckoutService` owns the full lifecycle: order creation, payment recording, cancellation, and order queries. It depends on `BasketService` for reading and clearing the basket — it never touches basket internals directly.

Orders are persisted to SQLite in two tables: `orders` (header) and `order_items` (line items). Each `order_item` carries a `tax_rate` snapshot — for offline orders this is the `taxRate` carried on the `BasketItem` at add-to-cart time; for online orders it is overwritten with the authoritative value returned by the platform draft order API.

### Checkout Capability Modes (Online Platforms)

This spec is **capability-driven** and supersedes the older universal draft-first assumption.

For online platforms, `startCheckout()` follows one of three modes determined by `getBasketMode(getPlatformCapabilities(platform))`:

1. **`native_draft` mode** (Shopify, Wix, Commercefull)
   - The basket items are sent to the platform via `OrderServiceFactory.getService(platform).createDraftOrder()`.
   - The platform returns authoritative `tax`, `subtotal`, `total`, and per-line `taxAmount` / `taxRate`.
   - Platform values replace local estimates on `LocalOrder` and `order_items`.
   - `platformOrderId` is stored for completion/sync.
   - `status` is set to `'draft'`.

2. **`remote_cart` mode** (WooCommerce, Magento, BigCommerce, Sylius, PrestaShop)
   - No draft is created at `startCheckout()` time.
   - Local basket totals and `BasketItem.taxRate` remain authoritative.
   - `platformOrderId` remains `null` until background sync creates the remote order post-payment.
   - `status` is set to `'pending'`.

3. **`local_only` mode** (Squarespace, Offline)
   - Fully local basket — no platform API is called at any point in the checkout flow.
   - Local basket totals and `BasketItem.taxRate` remain authoritative.
   - `platformOrderId` remains `null`; order is imported to the platform after payment via `OrderSyncService`.
   - `status` is set to `'pending'`.

The selected mode is controlled by `basketMode` in the platform capability profile, not by `isOnlinePlatform()` alone.

### Offline Mode

For offline mode (`platform === OFFLINE` or `undefined`), no draft order is created and no platform API is called at any point in the checkout flow:

- `startCheckout()` skips the draft step entirely — basket totals and `BasketItem.taxRate` values are used directly.
- `status` is set to `'pending'` (not `'draft'`), `platformOrderId` is `null`.
- `completePayment()` skips the `completeOrder()` platform call — the order is fully local.
- `syncOrderToPlatform()` detects `!isOnlinePlatform(platform)` and immediately marks the order `sync_status = 'synced'` without any API call.

The UI layer (`BasketContent`, `Basket`) drives checkout through `BasketProvider`, which delegates to `CheckoutService`. `CheckoutModal` handles payment method selection and cash tendering. Post-payment sync to the online platform is handled separately by `OrderSyncService` and is out of scope for this spec.

### Actors

| Actor   | Role                                                                                      |
| ------- | ----------------------------------------------------------------------------------------- |
| Cashier | Initiates checkout, selects payment method, enters cash tender, cancels orders            |
| System  | Creates and persists orders, records payments, clears basket, audits events, opens drawer |

### Order Status Machine

```
basket (editing)
  ↓ startCheckout()
draft ──────────────────────────────────────────────────────────────────┐
  ↓ markPaymentProcessing()                                             │ cancelDraftOrder()
processing → paid → synced                                              │ (back to basket, draft deleted on platform)
           ↘ failed                                                     ↓
draft / pending → cancelled                                         basket (editing)
```

| Transition                        | Trigger                                                    |
| --------------------------------- | ---------------------------------------------------------- |
| basket → `draft`                  | `startCheckout()` — platform draft created                 |
| `draft` → basket                  | `cancelDraftOrder()` — platform draft deleted, basket kept |
| `draft` → `processing`            | `markPaymentProcessing(orderId)`                           |
| `processing` → `paid`             | `completePayment()` success path                           |
| `processing` → `failed`           | `completePayment()` catch path                             |
| `paid` → `synced`                 | `OrderSyncService.updateSyncSuccess()`                     |
| `paid` → `failed` (sync)          | `OrderSyncService.updateSyncError()` after retries         |
| `draft` / `pending` → `cancelled` | `cancelOrder(orderId)` — hard cancel, not retryable        |

### Sync Status Machine

```
pending → synced
        ↘ failed  (after MAX_SYNC_RETRIES exhausted)
```

### Key Defaults

| Field                                  | Default                            | Source                                                        |
| -------------------------------------- | ---------------------------------- | ------------------------------------------------------------- |
| `status` on create (`native_draft`)    | `draft`                            | `OrderRepository.create()` when platform draft succeeds       |
| `status` on create (other modes)       | `pending`                          | `OrderRepository.create()` when no platform draft             |
| `sync_status` on create                | `pending`                          | `OrderRepository.create()`                                    |
| `openDrawer` on cash                   | `false`                            | `posConfig.values.drawerOpenOnCash`                           |
| `taxRate` on order item (offline)      | Snapshot from `BasketItem.taxRate` | `CheckoutService.startCheckout()`                             |
| `taxRate` on order item (native_draft) | From platform draft order response | `CheckoutService.startCheckout()`                             |
| `taxRate` on order item (remote_cart)  | Snapshot from `BasketItem.taxRate` | `CheckoutService.startCheckout()`                             |
| Draft order creation                   | `native_draft` platforms only      | `OrderServiceFactory.getService(platform).createDraftOrder()` |

---

## 1. Ubiquitous Requirements

**1.1** The system shall persist every order to SQLite via `OrderRepository.create()` before returning from `startCheckout()`.

**1.2** The system shall persist every order line item to SQLite via `OrderItemRepository.createMany()` in the same `startCheckout()` call, including the `taxRate` value for each item.

**1.3** The system shall audit-log every order creation, payment completion, and cancellation via `AuditLogService`.

**1.4** The system shall never clear the basket unless `completePayment()` succeeds — basket clearing is the final step of the success path only.

**1.5** For offline orders, the `taxRate` stored on each `BasketItem` at add-to-cart time is the authoritative rate for that line item. For online orders, the platform draft order response is the authoritative source — its per-line tax values overwrite the locally-resolved rates before SQLite persistence.

**1.6** The system shall preserve the basket intact when a payment fails or an order is cancelled, so the cashier can retry without re-adding items.

**1.7** The system shall record `paidAt` timestamp on the order row when `updatePayment()` is called.

**1.8** The system shall map `OrderRow` + `OrderItemRow[]` to a fully typed `LocalOrder` with `BasketItem[]` whenever an order is read back from SQLite.

**1.9** For online platforms where `basketMode === 'native_draft'`, the system shall create a draft order at `startCheckout()` via `OrderServiceFactory.getService(platform).createDraftOrder()` before persisting locally.

**1.10** A draft order (`status: 'draft'`) represents a basket that has been sent to the platform for tax calculation but not yet paid. The cashier may return to the basket from a draft order — this deletes the platform draft and the local draft row, leaving the basket intact for editing. This applies only to `native_draft` platforms.

**1.11** Only one draft order may be active at a time per basket. When `startCheckout()` is called while a draft order already exists, the system shall cancel the existing draft before creating a new one.

**1.12** For `local_only` mode (`platform === OFFLINE`, `undefined`, or Squarespace), the system shall skip all platform API calls throughout the checkout lifecycle — no draft creation, no `completeOrder()` call. For Squarespace, the order is imported post-payment via `OrderSyncService.createOrder()`.

**1.13** For `remote_cart` mode platforms (WooCommerce, Magento, BigCommerce, Sylius, PrestaShop), the system shall use local basket totals at checkout time. The platform order is created post-payment by `OrderSyncService.createOrder()` — no draft is created at checkout start.

---

## 2. Event-Driven Requirements

### 2.1 Start Checkout

**2.1.1** When `startCheckout(platform?, cashierId?, cashierName?)` is called, the system shall call `basketService.getBasket()` and throw `'Cannot checkout with empty basket'` if `basket.items` is empty.

**2.1.2** When the basket is non-empty, `platform` is online, and `basketMode === 'native_draft'` for that platform, the system shall call `OrderServiceFactory.getService(platform).createDraftOrder(order)` before persisting locally.

**2.1.3** When the platform draft order call succeeds, the system shall use platform-returned `subtotal`, `tax`, `total`, and per-line `taxAmount` / `taxRate` values to build `LocalOrder` and `order_items`.

**2.1.4** When the platform draft order call succeeds, the system shall store the platform's returned order ID as `platformOrderId` on the `LocalOrder`.

**2.1.5** When draft creation is attempted and fails (network error, API error, or service not initialised), the system shall log a warning and fall back to locally-resolved basket totals — checkout shall not be blocked.

**2.1.6** When `platform` is `OFFLINE`, `undefined`, or online with `basketMode !== 'native_draft'`, the system shall skip draft creation and use locally-resolved basket totals and `BasketItem.taxRate` values.

**2.1.7** When the order data is finalised (from platform or local), the system shall generate a UUID for the local order, set `status: 'draft'` for online orders (platform draft created) or `status: 'pending'` for offline/fallback orders, and `syncStatus: 'pending'`, and snapshot all basket fields (`discountAmount`, `discountCode`, `customerEmail`, `customerName`, `note`).

**2.1.8** When the order row is created, the system shall call `OrderRepository.create()` with all header fields, then `OrderItemRepository.createMany()` with each line item — using platform-returned `taxRate` for online orders or `BasketItem.taxRate` for offline orders.

**2.1.9** When both persists succeed, the system shall call `auditLogService.log('order:created', { userId, userName, details, metadata: { orderId, itemCount, total } })`.

**2.1.10** When `startCheckout()` returns, the system shall return the full `LocalOrder` object with `status: 'pending'`.

**2.1.11** When `BasketProvider.startCheckout(platform)` is called from the UI, the system shall pass the active `cashierId` and `cashierName` from `AuthContext` to `CheckoutService.startCheckout()`.

### 2.2 Mark Payment Processing

**2.2.1** When `markPaymentProcessing(orderId)` is called, the system shall call `OrderRepository.updateStatus(orderId, 'processing')` and return the updated `LocalOrder`.

**2.2.2** When `OrderRepository.findById(orderId)` returns `null` after the status update, the system shall throw `'Order <orderId> not found'`.

### 2.3 Complete Payment

**2.3.1** When `completePayment(orderId, paymentMethod, transactionId?)` is called, the system shall call `OrderRepository.updatePayment(orderId, paymentMethod, transactionId)`, which sets `status: 'paid'`, records `payment_method`, `payment_transaction_id`, and `paid_at`.

**2.3.2** When `updatePayment()` succeeds, the system shall call `basketService.clearBasket()` to reset the active basket.

**2.3.3** When `paymentMethod` is `'cash'` and `posConfig.values.drawerOpenOnCash` is `true`, the system shall set `openDrawer: true` in the returned `CheckoutResult`.

**2.3.4** When all steps succeed, the system shall call `auditLogService.log('order:paid', { details, metadata: { orderId, paymentMethod, transactionId } })` and return `{ success: true, orderId, openDrawer }`.

**2.3.5** When any step in `completePayment()` throws, the system shall catch the error, call `OrderRepository.updateStatus(orderId, 'failed')`, and return `{ success: false, orderId, error: errorMessage }` — the basket is not cleared.

### 2.4 Cancel Order

**2.4.1** When `cancelOrder(orderId)` is called, the system shall call `OrderRepository.updateStatus(orderId, 'cancelled')`.

**2.4.2** When the status update succeeds, the system shall call `auditLogService.log('order:cancelled', { details, metadata: { orderId } })`.

**2.4.3** When `cancelOrder()` is called, the basket shall remain intact — `clearBasket()` is not called.

### 2.5 Cancel Draft Order (Return to Basket)

**2.5.1** When `cancelDraftOrder(orderId)` is called, the system shall:

1. Call `OrderServiceFactory.getService(platform).cancelDraftOrder(platformOrderId)` to cancel the draft on the platform (if `platformOrderId` is set).
2. Call `OrderRepository.delete(orderId)` to remove the local draft row.
3. Leave the basket completely intact — no items are removed, no totals are reset.

**2.5.2** When the platform draft cancellation fails (network error, API error), the system shall log a warning and still delete the local draft row — the orphaned platform draft will be cleaned up by the platform's own draft expiry mechanism.

**2.5.3** When `cancelDraftOrder()` completes, `BasketProvider` shall set `currentOrder` to `null`, allowing the cashier to edit the basket and call `startCheckout()` again.

**2.5.4** When `startCheckout()` is called while `currentOrder` is non-null and `currentOrder.status === 'draft'`, the system shall call `cancelDraftOrder(currentOrder.id)` first, then proceed to create a new draft — ensuring only one draft exists at a time.

### 2.6 CheckoutModal — Method Selection Step

**2.6.1** When `CheckoutModal` opens with `step: 'method'`, the system shall display the order summary (ref, item count, subtotal, tax, total) and the payment method list built from `paymentMode` and `activeProvider`.

**2.6.2** When `paymentMode === 'cash_only'` (desktop / Electron, web, or no SDK provider active), the system shall render only the `cash` option — no terminal or card option is shown.

**2.6.3** When `paymentMode === 'tap_to_pay'`, the system shall render `cash` and a provider-labelled terminal option (e.g. "Tap to Pay (Stripe NFC)" or "Card Terminal (Square)"). The terminal option label and icon reflect the active `PaymentProvider`.

**2.6.4** When `paymentMode === 'tap_to_pay'` and `terminalConnected` is `false`, the system shall render the terminal option as enabled but with description `'Terminal not connected — tap to connect'`, allowing the cashier to select it and proceed to the terminal connection flow.

**2.6.5** When the cashier taps "Pay" with `selectedMethod !== 'cash'`, the system shall call `onSelectPayment({ method: selectedMethod })` immediately.

**2.6.6** When the cashier taps "Pay" with `selectedMethod === 'cash'`, the system shall transition to `step: 'cash_tender'` without calling `onSelectPayment`.

**2.6.7** When the cashier taps the close button, the system shall reset `step` to `'method'`, clear `tenderedStr`, and call `onCancel()`.

**2.6.8** When `CheckoutModal` opens, `selectedMethod` shall default to `'cash'` so the cashier can confirm immediately without an extra tap for the most common payment type.

### 2.7 Payment Method Change Mid-Checkout

The cashier may select a payment method, begin processing, and then need to switch — for example the customer offers cash after a terminal payment is declined, or the terminal is unavailable.

**2.7.1** When the cashier taps the back/cancel button inside `CheckoutModal` after `markPaymentProcessing()` has been called but before `completePayment()` succeeds, the system shall call `cancelOrder(orderId)` to reset the order status to `cancelled` and close the modal.

**2.7.2** When `cancelOrder()` completes after a mid-checkout method change, `BasketProvider` shall set `currentOrder` to `null` and leave the basket intact, so the cashier can tap "Complete Order" again to start a fresh checkout with the new payment method.

**2.7.3** When the cashier is on the `cash_tender` step and taps the back button, the system shall return to `step: 'method'` — `markPaymentProcessing()` has not been called yet at this point, so no order status change is needed.

**2.7.4** When the cashier selects a different method on the `method` step before tapping "Pay", the system shall update `selectedMethod` in local state — no API calls are made until "Pay" is tapped.

**2.7.5** When a terminal payment fails with `success: false` and the cashier wants to pay by cash instead, the system shall allow the cashier to cancel the current order (per 2.7.1–2.7.2) and restart checkout — the basket is preserved throughout.

### 2.8 CheckoutModal — Cash Tendering Step

**2.8.1** When `step === 'cash_tender'`, the system shall display the amount due, a tendered amount display, a change/shortfall row, quick-tender shortcuts, and a numeric keypad.

**2.8.2** When the cashier presses a digit key, the system shall append it to `tenderedStr`, preventing more than two decimal places and preventing multiple decimal points.

**2.8.3** When the cashier presses the delete key, the system shall remove the last character from `tenderedStr`.

**2.8.4** When the cashier taps a quick-tender shortcut, the system shall set `tenderedStr` to that amount formatted to two decimal places.

**2.8.5** When `tenderedAmount >= orderTotal`, the system shall show `changeDue = tenderedAmount - orderTotal` in the change row with a success style, and enable the confirm button.

**2.8.6** When `tenderedAmount < orderTotal`, the system shall show the shortfall amount in the change row with an error style, and disable the confirm button.

**2.8.7** When the cashier taps confirm and `isTenderValid` is `true`, the system shall call `onSelectPayment({ method: 'cash', tenderedAmount })`.

**2.8.8** When the cashier taps the back button in the cash tender step, the system shall return to `step: 'method'` without calling `onSelectPayment` or `onCancel`.

**2.8.9** When `CheckoutModal` opens, the system shall generate quick-tender shortcuts: exact amount, ceiling to nearest dollar (if different), and round-ups to the nearest $5, $10, and $20 — deduplicating any equal values.

### 2.9 Post-Payment UI

**2.9.1** When `completePayment()` returns `success: true` in `BasketContent`, the system shall close `CheckoutModal`, clear `currentOrderId`, and call `onCheckout?.()`.

**2.9.2** When `completePayment()` returns `success: true` in `Basket`, the system shall additionally close the swipeable panel and call `onPrintReceipt?.(orderId)` if provided.

**2.9.3** When `completePayment()` returns `success: true` and `openDrawer === true`, both `BasketContent` and `Basket` shall call `cashDrawerServiceFactory.getService().open()` as a fire-and-forget operation.

**2.9.4** When `completePayment()` returns `success: true`, `useCheckout` shall attempt to auto-print a receipt if `PrinterServiceFactory.isConnectedToPrinter()` is `true` and `printerSettings.printReceipts` is not `false`. Receipt printing is fire-and-forget — it shall never block or fail the payment success path. This applies to both cash and terminal payments.

**2.9.5** When `completePayment()` returns `success: true`, `BasketProvider` shall call `refreshBasket()` and `refreshUnsyncedCount()` to update the UI.

### 2.10 Order Queries

**2.10.1** When `getLocalOrders(status?)` is called, the system shall call `OrderRepository.findAll(status)` and map each row to a `LocalOrder` with its items loaded from `OrderItemRepository.findByOrderId()`.

**2.10.2** When `getUnsyncedOrders()` is called, the system shall call `OrderRepository.findUnsynced()`, which returns orders with `status = 'paid'` and `sync_status != 'synced'`, ordered by `created_at ASC`.

**2.10.3** When `getLocalOrder(orderId)` is called, the system shall call `OrderRepository.findById(orderId)` and return `null` if not found, or the mapped `LocalOrder` with items if found.

**2.10.4** When `useOrders.fetchOrders()` is called, the hook shall load all orders from `OrderRepository.findAll()`, load items for each via `OrderItemRepository.findByOrderId()`, and map them to `OrderWithItems[]`.

**2.10.5** When `useOrders.deleteOrder(id)` is called, the hook shall call `OrderRepository.delete(id)` (which CASCADE-deletes associated `order_items`) and then call `fetchOrders()` to refresh the list.

---

## 3. State-Driven Requirements

**3.1** While `isProcessing` is `true` in `BasketContent` or `Basket`, the checkout button shall render an `ActivityIndicator` and be disabled.

**3.2** While `checkoutModalVisible` is `true`, `CheckoutModal` shall be rendered with `isProcessing` forwarded from local state.

**3.3** While `step === 'cash_tender'` in `CheckoutModal`, the back button shall be visible and the close button shall remain accessible.

**3.4** While `tenderedStr` is empty in the cash tender step, the tendered display shall show `formatMoney(0, currency.code)` in the placeholder style.

**3.5** While `isProcessing` is `true` inside `CheckoutModal`, all interactive controls (method options, keypad, quick-tender buttons, back, close) shall be disabled.

**3.6** While `useOrders.isLoading` is `true`, the order history screen shall render a loading indicator.

**3.7** While `useOrders.error` is non-null, the order history screen shall surface the error to the user.

---

## 4. Optional Feature Requirements

**4.1** Where `posConfig.values.drawerOpenOnCash` is `true` and `paymentMethod === 'cash'`, the system shall set `openDrawer: true` in `CheckoutResult` and the UI shall fire-and-forget `cashDrawerServiceFactory.getService().open()`.

**4.2** Where `terminalConnected` is `true` in `CheckoutModal`, the terminal payment option shall be enabled and selectable.

**4.3** Where `onPrintReceipt` is provided to `CheckoutModal`, the system shall render a "Print Receipt" button on the method selection step.

**4.4** Where `transactionId` is provided to `completePayment()`, the system shall persist it to `orders.payment_transaction_id` for reconciliation.

**4.5** Where `platform` is provided to `startCheckout()`, the system shall persist it to `orders.platform` so `OrderSyncService` knows which platform API to target.

---

## 5. Unwanted Behaviour / Edge Cases

### 5.1 Empty Basket

**5.1.1** If `startCheckout()` is called when `basket.items` is empty, then `CheckoutService` shall throw `'Cannot checkout with empty basket'` and `BasketProvider` shall set `error` to the message without creating any order row.

**5.1.2** If the checkout button is tapped when `cartItems.length === 0`, then the button shall be disabled and `handleStartCheckout` / `handleCheckout` shall return immediately.

### 5.2 Order Not Found

**5.2.1** If `markPaymentProcessing(orderId)` is called with an `orderId` that does not exist in SQLite, then `CheckoutService` shall throw `'Order <orderId> not found'` after the status update attempt.

**5.2.2** If `getLocalOrder(orderId)` is called with an unknown ID, then the system shall return `null` without throwing.

### 5.3 Payment Failure

**5.3.1** If `OrderRepository.updatePayment()` throws inside `completePayment()`, then the system shall catch the error, call `updateStatus(orderId, 'failed')`, and return `{ success: false, orderId, error }` — the basket is not cleared.

**5.3.2** If `basketService.clearBasket()` throws after `updatePayment()` succeeds, then the order is already marked `paid` in SQLite — the system shall log the error but still return `{ success: true, orderId }` to avoid double-charging.

**5.3.3** If `processPayment()` (terminal via `usePayment`) returns `success: false` in `Basket`, then the system shall show an `Alert.alert` with the error and shall not call `completePayment()`.

### 5.4 Cancel Edge Cases

**5.4.1** If `handleCancelCheckout()` is called when `currentOrderId` is `null`, then the system shall close the modal and return without calling `cancelOrder()`.

**5.4.2** If `cancelOrder()` is called on an order that is already `paid`, then `OrderRepository.updateStatus()` will overwrite the status — this is a known limitation to be addressed when order state guards are added.

### 5.5 Cash Tender Edge Cases

**5.5.1** If the cashier enters a tendered amount with more than two decimal places via the keypad, then `CheckoutModal` shall silently ignore the extra digit, preserving the two-decimal-place limit.

**5.5.2** If the cashier enters `'0'` followed by another digit (not `'.'`), then `CheckoutModal` shall replace the leading zero rather than appending, preventing values like `'07'`.

**5.5.3** If `quickAmounts()` produces duplicate values (e.g. exact amount equals the nearest-dollar ceiling), then `CheckoutModal` shall deduplicate them before rendering.

### 5.6 Concurrent Access

**5.6.1** If two checkout operations are initiated simultaneously (e.g. two registers sharing the same SQLite file), then SQLite's serialised write model shall prevent data corruption — the second `INSERT INTO orders` will succeed independently with its own UUID.

### 5.7 App Crash Recovery

**5.7.1** If the app crashes after `OrderRepository.create()` but before `completePayment()`, then on restart the order shall remain in `status: 'pending'` or `'processing'` in SQLite — the cashier can locate it in Order History and the basket will be restored from `BasketRepository.findActiveBasket()`.

**5.7.2** If the app crashes after `updatePayment()` but before `clearBasket()`, then on restart the order shall be `status: 'paid'` in SQLite and the basket will still contain items — the cashier must manually clear the basket to avoid a duplicate order.

### 5.8 Draft Order Edge Cases

**5.8.1** If `OrderServiceFactory.getService(platform)` returns a service that is not initialised when `startCheckout()` is called, the system shall log a warning and fall back to basket-local totals — checkout shall not be blocked.

**5.8.2** If the platform draft order API returns a `platformOrderId` but the line items in the response do not match the basket items (e.g. a product was deleted on the platform), the system shall log a warning and use the platform totals as-is — item reconciliation is out of scope for the POS checkout flow.

**5.8.3** If the platform draft order API returns `tax: 0` for all items (e.g. the platform has tax disabled), the system shall accept those values and persist `tax_rate: 0` on all order items — it shall not fall back to locally-resolved rates.

**5.8.4** If `startCheckout()` is called for an online platform but the device is offline, the draft order call will fail — the system shall fall back to basket-local totals and proceed, with the order syncing to the platform later via `OrderSyncService`.

### 5.9 Offline Mode

**5.9.1** If `platform` is `OFFLINE` or `undefined` when `startCheckout()` is called, the system shall skip `createDraftOrder()` entirely — `status` shall be `'pending'` and `platformOrderId` shall be `null`.

**5.9.2** If `platform` is `OFFLINE` when `completePayment()` is called, the system shall skip the `orderService.completeOrder()` call — the order is fully recorded in SQLite and no platform notification is needed.

**5.9.3** If `cancelDraftOrder()` is called on an offline order (`platform === OFFLINE`), the system shall skip the platform API call and only delete the local SQLite row — `OfflineOrderService.cancelDraftOrder()` is a no-op by design.

---

## 6. Complex Requirements

**6.1** When `completePayment()` is called and `posConfig.values.drawerOpenOnCash` is `true` and `paymentMethod === 'cash'`, the system shall atomically: record the payment in SQLite, clear the basket, set `openDrawer: true`, audit-log `order:paid`, and return `CheckoutResult` — the UI then fires the drawer open as a separate side-effect.

**6.2** When `startCheckout()` is called while `basket.customerEmail` is set, the system shall copy both `customerEmail` and `customerName` from the basket snapshot into the `LocalOrder` and persist them to `orders.customer_email` and `orders.customer_name`, ensuring customer association survives basket clearing.

**6.3** When `OrderItemRepository.createMany()` persists line items for an online order, each item's `taxRate` shall be the value returned by the platform draft order response — not the locally-resolved rate from `TaxCalculationService`. For offline orders, the locally-resolved rate is used.

**6.4** When `mapOrderRowToLocalOrder()` reconstructs a `LocalOrder` from SQLite, the system shall parse `order_items.taxable` from `0/1` to `boolean`, parse `order_items.properties` from JSON string to `Record<string, string>`, and map `order_items.tax_rate` to `BasketItem.taxRate` as a number or `undefined`.

**6.5** When `useOrders.fetchOrders()` loads orders, it shall perform a sequential per-order item fetch (`findByOrderId` for each row) rather than a single JOIN, accepting the N+1 query cost in exchange for simpler mapping code — this is acceptable for the expected order volumes on a single-register POS.

**6.6** When the platform draft order API returns a `platformOrderId`, the system shall store it on the local order so that `OrderSyncService` can reference the existing platform order during sync rather than creating a duplicate.

---

## 7. Checkout Lifecycle Summary

### Full checkout flow

```
Cashier taps "Complete Order"
  → BasketProvider.startCheckout(platform)
    → [currentOrder?.status === 'draft'] cancelDraftOrder(currentOrder.id) first
    → CheckoutService.startCheckout(platform, cashierId, cashierName)
      → basketService.getBasket()                    ← validate non-empty
      → generateUUID()                               ← orderId

      ── native_draft platforms (Shopify, Wix, Commercefull) ──────────
      → OrderServiceFactory.getService(platform).createDraftOrder(basketAsOrder)
          → platform API creates draft order
          → returns { platformOrderId, subtotal, tax, total, lineItems[].taxRate }
          → status = 'draft'
          → [on failure] log warning, fall back to basket totals, status = 'pending'
      ── remote_cart platforms (Woo, Magento, BigCommerce, Sylius, PrestaShop) ──
      → skip draft creation, use basket totals, status = 'pending'
      ── local_only platforms (Squarespace, Offline) ───────────────────
      → use basket.subtotal / tax / total + BasketItem.taxRate values
      → status = 'pending'

      → OrderRepository.create()                     ← persist header (status: draft|pending)
      → OrderItemRepository.createMany()             ← persist items
      → auditLogService.log('order:created')
      → return LocalOrder
  → BasketProvider.currentOrder = LocalOrder
  → CheckoutModal opens with platform-confirmed totals

── Cashier changes payment method ────────────────────────────────────────
  [before tapping "Pay" — no API calls made yet]
  → cashier taps a different method option in CheckoutModal
  → selectedMethod updated in local state only
  → taps "Pay" with the new method → normal flow continues

  [after tapping "Pay" on terminal — markPaymentProcessing already called]
  → terminal declined OR cashier taps cancel
  → cancelOrder(orderId)                             ← status: cancelled
  → currentOrder = null, basket intact
  → cashier taps "Complete Order" again
  → startCheckout() → new draft created
  → CheckoutModal opens → cashier selects cash → pays

  [on cash tender step — back button]
  → setStep('method')                                ← no API call, markPaymentProcessing not yet called
  → cashier selects different method → taps "Pay"


  → BasketProvider.cancelDraftOrder(currentOrder.id)
    → platform API: cancel/delete draft order (fire-and-forget on failure)
    → OrderRepository.delete(orderId)               ← remove local draft
    → currentOrder = null
  → Basket is intact — cashier adds item, taps "Complete Order" again
  → new draft created (loop back to top)

── Cashier pays ──────────────────────────────────────────────────────────
Cashier selects payment method
  → CheckoutModal step: 'method'
  → [cash] → step: 'cash_tender' → enter amount → confirm
  → [terminal — tap_to_pay mode only] → onSelectPayment({ method }) immediately

BasketProvider.handlePayment(selection)
  → markPaymentProcessing(orderId)                   ← status: processing
  → [terminal] processPayment() via usePayment
  → completePayment(orderId, method, transactionId?)
      → OrderRepository.updatePayment()              ← status: paid, paid_at set
      → [online] platform order updated to paid/processing via OrderSyncService
      → basketService.clearBasket()                  ← basket reset
      → [cash + drawerEnabled] openDrawer = true
      → auditLogService.log('order:paid')
      → return { success: true, orderId, openDrawer }
  → [openDrawer] cashDrawerServiceFactory.getService().open()
  → refreshBasket() + refreshUnsyncedCount()
  → CheckoutModal closes

[Background] OrderSyncService picks up unsynced orders
  → getUnsyncedOrders()                              ← status=paid, sync_status!=synced
  → [platformOrderId set] update existing platform draft → paid
  → [no platformOrderId] create new order on platform
  → updateSyncSuccess() → sync_status: synced
     OR updateSyncError() → retry → sync_status: failed
```

### Order persistence schema

| Column                   | Type    | Set by                                             |
| ------------------------ | ------- | -------------------------------------------------- |
| `id`                     | TEXT PK | `generateUUID()` in `startCheckout()`              |
| `platform`               | TEXT    | `startCheckout(platform)`                          |
| `subtotal`               | REAL    | Basket snapshot                                    |
| `tax`                    | REAL    | Basket snapshot (sum of per-item tax)              |
| `total`                  | REAL    | Basket snapshot                                    |
| `status`                 | TEXT    | `'pending'` → `updateStatus()` / `updatePayment()` |
| `sync_status`            | TEXT    | `'pending'` → `updateSyncSuccess/Error()`          |
| `payment_method`         | TEXT    | `updatePayment()`                                  |
| `payment_transaction_id` | TEXT    | `updatePayment()`                                  |
| `paid_at`                | INTEGER | `updatePayment()` (Unix ms)                        |
| `synced_at`              | INTEGER | `updateSyncSuccess()`                              |

| Column (order_items) | Type    | Set by                                                                   |
| -------------------- | ------- | ------------------------------------------------------------------------ |
| `tax_rate`           | REAL    | Platform draft order response (online) OR `BasketItem.taxRate` (offline) |
| `taxable`            | INTEGER | `BasketItem.taxable` (0/1)                                               |

---

## 8. Component Traceability

| Requirement (summary)                                  | Component / Hook / Service                                                                                              | Source File                                                                         |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Checkout initiated from desktop basket                 | `BasketContent.handleStartCheckout` → `startCheckout(platform)`                                                         | `screens/order/BasketContent.tsx`                                                   |
| Checkout initiated from mobile basket                  | `Basket.handleCheckout` → `startCheckout(platform)`                                                                     | `screens/order/Basket.tsx`                                                          |
| Empty basket guard                                     | `CheckoutService.startCheckout` (items.length === 0 throw)                                                              | `services/checkout/CheckoutService.ts`                                              |
| Order UUID generated                                   | `generateUUID()` in `startCheckout`                                                                                     | `services/checkout/CheckoutService.ts`                                              |
| Basket snapshot → LocalOrder                           | `CheckoutService.startCheckout` (spread basket fields)                                                                  | `services/checkout/CheckoutService.ts`                                              |
| Draft order created on platform (online)               | `CheckoutService.startCheckout` → `OrderServiceFactory.getService(platform).createOrder()`                              | `services/checkout/CheckoutService.ts`, `services/order/OrderServiceFactory.ts`     |
| Platform tax/totals overwrite basket totals (online)   | `CheckoutService.startCheckout` (platform response → LocalOrder)                                                        | `services/checkout/CheckoutService.ts`                                              |
| Draft order failure → fallback to basket totals        | `CheckoutService.startCheckout` (catch → log warning, use basket)                                                       | `services/checkout/CheckoutService.ts`                                              |
| platformOrderId stored on local order                  | `OrderRepository.create()` (`platform_order_id` column)                                                                 | `repositories/OrderRepository.ts`                                                   |
| Order header persisted                                 | `OrderRepository.create()`                                                                                              | `repositories/OrderRepository.ts`                                                   |
| Order items persisted with taxRate (platform or local) | `OrderItemRepository.createMany()` (taxRate field)                                                                      | `repositories/OrderItemRepository.ts`                                               |
| Order creation audited                                 | `auditLogService.log('order:created')`                                                                                  | `services/checkout/CheckoutService.ts`                                              |
| CheckoutModal opened with orderId                      | `BasketProvider` → `setCurrentOrderId` + `setCheckoutModalVisible`                                                      | `contexts/BasketProvider.tsx`                                                       |
| Order summary displayed in modal                       | `CheckoutModal` (summaryCard section)                                                                                   | `components/CheckoutModal.tsx`                                                      |
| Payment method list built dynamically                  | `CheckoutModal.buildMethodList(paymentMode, activeProvider, terminalConnected)`                                         | `components/CheckoutModal.tsx`                                                      |
| Terminal option only on mobile/tablet with SDK         | `CheckoutModal.buildMethodList` (`paymentMode === 'tap_to_pay'` guard)                                                  | `components/CheckoutModal.tsx`                                                      |
| Terminal label reflects active provider                | `CheckoutModal` (`PROVIDER_LABEL[activeProvider]`)                                                                      | `components/CheckoutModal.tsx`                                                      |
| Cash-only on desktop / no provider                     | `CheckoutModal.buildMethodList` (`paymentMode === 'cash_only'` → cash only)                                             | `components/CheckoutModal.tsx`                                                      |
| paymentMode + activeProvider passed to modal           | `useCheckout` → `Basket` / `BasketContent` → `CheckoutModal`                                                            | `hooks/useCheckout.ts`, `screens/sale/Basket.tsx`, `screens/sale/BasketContent.tsx` |
| Payment mode resolved from device + provider           | `usePayment.getPaymentMode()` (isElectron / isMobile / TAP_TO_PAY_PROVIDERS check)                                      | `hooks/usePayment.ts`                                                               |
| Cash → tender step transition                          | `CheckoutModal.handleMethodConfirm` (cash branch → `setStep`)                                                           | `components/CheckoutModal.tsx`                                                      |
| Cash keypad digit entry                                | `CheckoutModal.handleKeyPress`                                                                                          | `components/CheckoutModal.tsx`                                                      |
| Cash keypad delete                                     | `CheckoutModal.handleDelete`                                                                                            | `components/CheckoutModal.tsx`                                                      |
| Quick-tender shortcuts generated                       | `CheckoutModal.quickAmounts()` (deduped)                                                                                | `components/CheckoutModal.tsx`                                                      |
| Change due calculated                                  | `CheckoutModal` (`changeDue = tenderedAmount - orderTotal`)                                                             | `components/CheckoutModal.tsx`                                                      |
| Cash payment confirmed                                 | `CheckoutModal.handleCashConfirm` → `onSelectPayment({ method: 'cash', tenderedAmount })`                               | `components/CheckoutModal.tsx`                                                      |
| Status → processing                                    | `CheckoutService.markPaymentProcessing` → `OrderRepository.updateStatus`                                                | `services/checkout/CheckoutService.ts`                                              |
| Terminal payment via usePayment (Basket)               | `Basket.handlePayment` → `processPayment()`                                                                             | `screens/order/Basket.tsx`, `hooks/usePayment.ts`                                   |
| Payment recorded + basket cleared                      | `CheckoutService.completePayment` → `updatePayment` + `clearBasket`                                                     | `services/checkout/CheckoutService.ts`                                              |
| Cash drawer flag set                                   | `CheckoutService.completePayment` (`openDrawer` logic)                                                                  | `services/checkout/CheckoutService.ts`                                              |
| Cash drawer opened                                     | `BasketContent/Basket.handlePayment` → `cashDrawerServiceFactory.getService().open()`                                   | `screens/sale/BasketContent.tsx`, `screens/sale/Basket.tsx`                         |
| Receipt auto-printed after payment (cash + terminal)   | `useCheckout.handlePayment` → `PrinterServiceFactory.printReceipt()` (fire-and-forget, if connected + enabled)          | `hooks/useCheckout.ts`                                                              |
| Payment audited                                        | `auditLogService.log('order:paid')`                                                                                     | `services/checkout/CheckoutService.ts`                                              |
| Payment failure → order marked failed                  | `CheckoutService.completePayment` (catch → `updateStatus('failed')`)                                                    | `services/checkout/CheckoutService.ts`                                              |
| Order cancelled                                        | `CheckoutService.cancelOrder` → `OrderRepository.updateStatus`                                                          | `services/checkout/CheckoutService.ts`                                              |
| Cancellation audited                                   | `auditLogService.log('order:cancelled')`                                                                                | `services/checkout/CheckoutService.ts`                                              |
| Cancel with no orderId guard                           | `BasketContent/Basket.handleCancelCheckout` (null check)                                                                | `screens/order/BasketContent.tsx`, `screens/order/Basket.tsx`                       |
| Draft order cancelled on platform                      | `CheckoutService.cancelDraftOrder` → `OrderServiceFactory.getService(platform).updateOrder(platformOrderId, cancelled)` | `services/checkout/CheckoutService.ts`                                              |
| Local draft row deleted on cancel                      | `CheckoutService.cancelDraftOrder` → `OrderRepository.delete(orderId)`                                                  | `services/checkout/CheckoutService.ts`                                              |
| Return to basket after draft cancel                    | `BasketProvider.cancelDraftOrder` → `setCurrentOrder(null)`                                                             | `contexts/BasketProvider.tsx`                                                       |
| Existing draft cancelled before new checkout           | `BasketProvider.startCheckout` (currentOrder?.status === 'draft' guard)                                                 | `contexts/BasketProvider.tsx`                                                       |
| Basket refreshed after payment                         | `BasketProvider.completePayment` → `refreshBasket()`                                                                    | `contexts/BasketProvider.tsx`                                                       |
| Unsynced count refreshed after payment                 | `BasketProvider.completePayment` → `refreshUnsyncedCount()`                                                             | `contexts/BasketProvider.tsx`                                                       |
| Orders loaded for history screen                       | `useOrders.fetchOrders()` → `OrderRepository.findAll()`                                                                 | `hooks/useOrders.ts`                                                                |
| Order items loaded per order                           | `useOrders.fetchOrders()` → `OrderItemRepository.findByOrderId()`                                                       | `hooks/useOrders.ts`                                                                |
| Order deleted from history                             | `useOrders.deleteOrder()` → `OrderRepository.delete()` (CASCADE)                                                        | `hooks/useOrders.ts`                                                                |
| Unsynced orders queried for sync                       | `CheckoutService.getUnsyncedOrders()` → `OrderRepository.findUnsynced()`                                                | `services/checkout/CheckoutService.ts`                                              |
| Order row mapped to LocalOrder                         | `CheckoutService.mapOrderRowToLocalOrder()` (taxable 0/1→bool, properties JSON parse)                                   | `services/checkout/CheckoutService.ts`                                              |
| taxRate snapshot preserved on order item               | `OrderItemRepository.createMany()` → `order_items.tax_rate`                                                             | `repositories/OrderItemRepository.ts`                                               |
