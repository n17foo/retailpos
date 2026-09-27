# Refunds – EARS Requirements

> **System**: RetailPOS – Refunds & Returns
> **Actor**: Manager, System
> **Date**: 2026-04-13
> **Source**: `services/refunds/RefundService.ts`, `services/refunds/platforms/PlatformRefundServiceInterface.ts`, `services/refunds/platforms/OfflineRefundService.ts`, `services/refunds/platforms/shopifyRefundService.ts`, `repositories/ReturnRepository.ts`, `hooks/useRefund.ts`, `screens/ReturnsScreen.tsx`

---

## Context

A **refund** is a monetary reversal — money returned to the customer. A **return** is a physical event — items coming back to the store. These are distinct operations. A refund can happen without a return (e.g. a service complaint, a pricing error, a card dispute). A return can happen without a monetary refund (e.g. exchange only). This spec covers both, with refunds as the primary concept.

`RefundService` is the unified singleton that handles both paths:

- **Standalone refund** — `processRefund(orderId, refundData, platform?)` sends a monetary reversal to the platform API (or records it locally for offline orders). No return record is created.
- **Payment terminal refund** — `processPaymentRefund(transactionId, amount, reason?)` records a local refund against a card transaction ID via `OfflineRefundService`.
- **Return with optional refund** — `processReturn(input)` creates `return` records in SQLite and, when `issueRefund: true`, also calls `processRefund()` to trigger the monetary reversal.

Platform refund services (`ShopifyRefundService`, `WooCommerceRefundService`, etc.) implement `PlatformRefundServiceInterface` and are instantiated lazily per platform. `OfflineRefundService` handles all local/offline cases and persists refund records to `keyValueRepository`.

### Refund Sources

| Source             | Description                                          | Service path                                           |
| ------------------ | ---------------------------------------------------- | ------------------------------------------------------ |
| `ecommerce`        | Refund via platform API (Shopify, WooCommerce, etc.) | `processRefund(orderId, data, platform)`               |
| `payment_terminal` | Refund via card terminal transaction ID              | `processPaymentRefund(transactionId, amount, reason?)` |
| Return-triggered   | Monetary refund issued as part of a return           | `processReturn({ issueRefund: true })`                 |

### Refund Capability Matrix (Platform)

Legend:

- `S` = Supported (platform-native)
- `C` = Custom adapter required (tenant/project-specific)
- `NR` = Not recommended for parity promise

| Platform     | Refund capability | Suggested mode      |
| ------------ | ----------------- | ------------------- |
| Shopify      | S                 | `platform_native`   |
| WooCommerce  | C                 | `custom_adapter`    |
| Magento      | S                 | `platform_native`   |
| BigCommerce  | S                 | `platform_native`   |
| Sylius       | C                 | `custom_adapter`    |
| Wix          | S                 | `platform_native`   |
| PrestaShop   | C                 | `custom_adapter`    |
| Squarespace  | NR                | `local_record_only` |
| Commercefull | S                 | `platform_native`   |
| Offline      | S                 | `local_record_only` |

`refundMode` semantics:

- `platform_native`: call platform refund API directly
- `custom_adapter`: call platform-specific adapter; capability must be explicitly enabled and ready
- `local_record_only`: do not call remote refund API; allow local return flow and local refund records only

### Key Data Shapes

**RefundData** (input to `processRefund`):

- `amount?` — total refund amount
- `reason?` — human-readable reason
- `note?` — internal note
- `items?[]` — per-line-item breakdown: `lineItemId`, `quantity`, `amount?`, `restockInventory?`

**RefundResult** (output):

- `success` — whether the refund was accepted
- `refundId?` — platform-assigned refund ID
- `amount?` — confirmed refund amount
- `error?` — error message on failure
- `timestamp` — always present

**RefundRecord** (history entry):

- `id`, `orderId`, `transactionId?`, `amount`, `items?[]`, `reason?`, `note?`, `status` (`pending` | `completed` | `failed`), `source` (`ecommerce` | `payment_terminal`), `timestamp`

**ReturnItem** (SQLite `returns` table):

- `id`, `orderId`, `orderItemId?`, `productId`, `variantId?`, `productName`, `quantity`, `refundAmount`, `reason?`, `restock`, `status` (`pending` | `approved` | `rejected` | `completed`), `processedBy?`, `processedAt?`, `createdAt`, `updatedAt`

---

## 1. Ubiquitous Requirements

**1.1** `RefundService` shall be a singleton — a single instance is shared across the application.

**1.2** The refund subsystem shall be initialised lazily — `initializeRefundService()` is called on the first refund operation if not called explicitly at startup.

**1.3** Every `RefundResult` shall include a `timestamp` field regardless of success or failure.

**1.4** Platform refund services shall be instantiated lazily per platform and cached in `platformRefundServices` — a service is only created when first needed.

**1.5** `OfflineRefundService` shall persist all refund records to `keyValueRepository` under the key `'offline_local_refunds'` so they survive app restarts.

**1.6** Every return record shall be created with `status: 'pending'` and immediately auto-approved and completed for POS returns — there is no manual approval step in the current flow.

**1.7** Every refund operation shall be non-blocking to the caller — errors are caught internally and returned as `{ success: false, error }` rather than thrown.

---

## 2. Event-Driven Requirements

### 2.1 Initialisation

**2.1.1** When `RefundService.initializeRefundService()` is called, the system shall create and initialise an `OfflineRefundService` instance and set `refundInitialized = true`.

**2.1.2** When `useRefund` mounts, the system shall call `returnService.initializeRefundService()` and set `isInitialized` state accordingly.

**2.1.3** When initialisation fails, `useRefund` shall set `error` to `'Failed to initialize returns service'` and `isInitialized` to `false`.

### 2.2 Standalone Refund (E-commerce)

**2.2.1** When `RefundService.processRefund(orderId, refundData, platform)` is called with a platform, the system shall call `getPlatformRefundService(platform)` to obtain the platform-specific service, initialise it if not already initialised, and call `service.processRefund(orderId, refundData)`.

**2.2.2** When `RefundService.processRefund(orderId, refundData)` is called without a platform, the system shall use `OfflineRefundService` to record the refund locally.

**2.2.3** When the platform refund service call succeeds, the system shall return a `RefundResult` with `success: true`, `refundId`, `amount`, and `timestamp`, and call `auditLogService.log('refund:processed', { details, metadata: { orderId, refundId, amount, platform } })`.

**2.2.4** When the platform refund service call fails, the system shall return a `RefundResult` with `success: false`, `error`, and `timestamp` — it shall not throw and shall not audit-log the failure.

**2.2.5** When `useRefund.processEcommerceRefund(orderId, refundData)` is called, the system shall delegate to `returnService.processRefund(orderId, refundData, platform)` and surface the result to the caller.

### 2.3 Payment Terminal Refund

**2.3.1** When `RefundService.processPaymentRefund(transactionId, amount, reason?)` is called, the system shall use `OfflineRefundService` to record a local refund against the transaction ID with `reason` defaulting to `'Payment terminal refund'`. On success, the system shall call `auditLogService.log('refund:processed', { details, metadata: { transactionId, refundId, amount } })`.

**2.3.2** When `useRefund.processPaymentRefund(transactionId, amount, reason?)` is called, the system shall delegate to `returnService.processPaymentRefund()` and surface the result.

**2.3.3** When `ReturnsScreen` submits a payment refund, the system shall validate that `transactionId` and `amount` are both non-empty, and that `amount` parses to a positive number, before calling `processPaymentRefund`. If `amount` is empty, non-numeric, or ≤ 0, the system shall set `formError` to `'Amount must be a positive number.'` and not call the service.

**2.3.4** When `ReturnsScreen` submits an e-commerce refund, the system shall validate that `orderId` and `amount` are both non-empty, and that `amount` parses to a positive number, before calling `processEcommerceRefund`. If `amount` is empty, non-numeric, or ≤ 0, the system shall set `formError` to `'Amount must be a positive number.'` and not call the service.

### 2.4 Return with Refund

**2.4.1** When `RefundService.processReturn(input)` is called, the system shall validate that the order exists and has `status === 'paid'` or `status === 'synced'` before proceeding.

**2.4.2** When the order is valid, the system shall create a `ReturnRow` in SQLite for each item in `input.items` via `returnRepository.create()`, then immediately call `returnRepository.updateStatus(id, 'completed', processedBy)`.

**2.4.3** When `input.issueRefund` is `true`, the system shall call `processRefund()` with the summed `totalRefund` amount and the platform from `input.platform` or the order's own `platform` field.

**2.4.4** When the platform refund call within `processReturn` fails, the system shall log a warning and send a `'Refund Warning'` notification — the return records are still created and the overall result is `success: true`.

**2.4.5** When `processReturn` completes successfully, the system shall call `auditLogService.log('return:created', { userId, details, metadata })` and `notificationService.notify('Return Processed', ...)`.

### 2.5 Refund History

**2.5.1** When `RefundService.getRefundHistory(orderId, platform?)` is called, the system shall delegate to the appropriate platform service (or `OfflineRefundService`) and return the list of `RefundRecord` entries for that order.

**2.5.2** When `useRefund.getRefundHistory(orderId)` is called, the system shall delegate to `returnService.getRefundHistory(orderId, platform)` and return the result.

**2.5.3** When `ReturnsScreen` detects a change in `orderId` or `transactionId`, the system shall automatically call `getRefundHistory()` with the active ID and update the history list.

**2.5.4** When a refund is successfully processed in `ReturnsScreen`, the system shall call `getRefundHistory()` again to refresh the list.

### 2.6 Platform Refund Services

**2.6.1** When `getPlatformRefundService(platform)` is called for a platform not yet in the cache, the system shall instantiate the appropriate service class and cache it.

**2.6.2** When `getPlatformRefundService(platform)` is called for an unknown platform, the system shall fall back to `OfflineRefundService`.

**2.6.3** When a platform refund service's `initialize()` is called, the system shall retrieve API credentials from the secrets store and set `initialized = true` on success.

**2.6.4** When `ShopifyRefundService.processRefund(orderId, refundData)` is called, the system shall POST to `orders/{orderId}/refunds.json` with the refund payload and return the platform-assigned refund ID.

**2.6.5** When `OfflineRefundService.processRefund(orderId, refundData)` is called, the system shall generate a local `refundId`, create a `RefundRecord`, add it to the in-memory history map, and persist the updated map to `keyValueRepository`.

### 2.7 ReturnsScreen — UI Flow

**2.7.1** When `ReturnsScreen` mounts, the system shall render the refund type selector (Payment Refund / E-commerce Refund) with Payment Refund selected by default.

**2.7.2** When the manager selects "Payment Refund", the system shall show the Transaction ID input field.

**2.7.3** When the manager selects "E-commerce Refund", the system shall show the Order ID input field.

**2.7.4** When a refund succeeds, `ReturnsScreen` shall display a success message, clear the amount and reason fields, and refresh the history list.

**2.7.5** When a refund fails, `ReturnsScreen` shall display the error message and preserve all form fields for retry.

**2.7.6** When `isInitialized` is `false`, the "Process Refund" button shall be disabled.

**2.7.7** When `isLoading` is `true`, the "Process Refund" button shall show a loading indicator.

---

## 3. State-Driven Requirements

**3.1** While `isInitialized` is `false` in `useRefund`, calls to `processPaymentRefund`, `processEcommerceRefund`, and `getRefundHistory` shall throw `'Returns service not initialized'` and return failure results.

**3.2** While `isLoading` is `true` in `useRefund`, the `ReturnsScreen` button shall be in loading state and non-interactive.

**3.3** While the refund history list is empty, `ReturnsScreen` shall render `'No refund history available'` in place of the list.

**3.4** While `historyLoading` is `true`, `ReturnsScreen` shall render an `ActivityIndicator` in the history section.

---

## 4. Optional Feature Requirements

**4.1** Where `processReturn` is called with `restock: true` on an item, the `returns` table shall record `restock = 1` — inventory restocking is tracked but not yet automatically applied.

**4.2** Where `RefundData.items` is populated, platform refund services that support line-item refunds (e.g. Shopify) shall include per-line-item breakdown in the refund API call.

**4.3** Where `RefundData.note` is provided, platform services shall include it as an internal note on the refund record.

**4.4** Where `processReturn` is called with `issueRefund: false` or omitted, only the return records are created — no monetary refund is triggered.

---

## 5. Unwanted Behaviour / Edge Cases

**5.1** If `processReturn` is called for an order with `status !== 'paid'` and `status !== 'synced'`, the system shall return `{ success: false, error: 'Order must be paid before processing a return' }` without creating any return records.

**5.2** If `processReturn` is called for an unknown `orderId`, the system shall return `{ success: false, error: 'Order not found' }`.

**5.3** If the platform refund API call fails during `processReturn`, the return records are already committed to SQLite — the system shall log a warning and notify the manager but shall not roll back the return records.

**5.4** If `getRefundHistory` throws, `useRefund` shall catch the error, set `error` state, and return an empty array — the screen shall not crash.

**5.5** If `OfflineRefundService.saveToStorage()` fails, the in-memory refund history remains intact for the session but the record will be lost on restart — the error is logged but not surfaced to the caller.

**5.6** If `ReturnsScreen` receives a non-numeric or zero/negative value in the amount field, the screen shall reject it with `'Amount must be a positive number.'` before calling any service method — the service layer does not perform its own amount validation.

**5.7** If `configurePlatformRefund(platform, config)` is called by `ServiceConfigBridge`, the system shall call `getPlatformRefundService(platform)` to warm up the service — the `_config` parameter is accepted but not currently applied (services read credentials from the secrets store directly).

---

## 6. Complex Requirements

**6.1** When `processReturn` calculates `totalRefund`, the system shall sum `item.refundAmount` across all items and round to two decimal places (`Math.round(totalRefund * 100) / 100`) before passing to `processRefund` — this prevents floating-point accumulation errors.

**6.2** When `processReturn` calls `processRefund`, it shall use `order.platform_order_id || input.orderId` as the refund target ID — this ensures the platform receives its own order reference rather than the local UUID.

**6.3** When `getReturnableItems(orderId)` is called, the system shall load all `order_items` for the order and subtract already-completed or approved return quantities per item, returning only items with `returnableQuantity > 0` — this prevents over-returning.

---

## 7. Component Traceability

| Requirement (summary)                                             | Component / Service                                             | Source File                                                    |
| ----------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------- |
| Singleton `RefundService`                                         | `RefundService.getInstance`                                     | `services/refunds/RefundService.ts`                            |
| Lazy initialisation of refund subsystem                           | `RefundService.initializeRefundService`                         | `services/refunds/RefundService.ts`                            |
| Platform service lazy instantiation + cache                       | `RefundService.getPlatformRefundService`                        | `services/refunds/RefundService.ts`                            |
| E-commerce refund via platform API                                | `RefundService.processRefund`                                   | `services/refunds/RefundService.ts`                            |
| `refund:processed` audit log on e-commerce refund success         | `RefundService.processRefund` → `auditLogService.log`           | `services/refunds/RefundService.ts`                            |
| Payment terminal refund via offline service                       | `RefundService.processPaymentRefund`                            | `services/refunds/RefundService.ts`                            |
| `refund:processed` audit log on payment refund success            | `RefundService.processPaymentRefund` → `auditLogService.log`    | `services/refunds/RefundService.ts`                            |
| Return records created in SQLite                                  | `RefundService.processReturn` → `returnRepository.create`       | `services/refunds/RefundService.ts`                            |
| Auto-approve/complete POS returns                                 | `RefundService.processReturn` → `returnRepository.updateStatus` | `services/refunds/RefundService.ts`                            |
| Monetary refund triggered from return                             | `RefundService.processReturn` → `processRefund`                 | `services/refunds/RefundService.ts`                            |
| Refund warning notification on partial failure                    | `RefundService.processReturn` → `notificationService.notify`    | `services/refunds/RefundService.ts`                            |
| `return:created` audit log                                        | `RefundService.processReturn` → `auditLogService.log`           | `services/refunds/RefundService.ts`                            |
| `Return Processed` notification                                   | `RefundService.processReturn` → `notificationService.notify`    | `services/refunds/RefundService.ts`                            |
| Refund history query                                              | `RefundService.getRefundHistory`                                | `services/refunds/RefundService.ts`                            |
| Returnable items calculation (over-return guard)                  | `RefundService.getReturnableItems`                              | `services/refunds/RefundService.ts`                            |
| `PlatformRefundServiceInterface` contract                         | `PlatformRefundServiceInterface`                                | `services/refunds/platforms/PlatformRefundServiceInterface.ts` |
| Shopify refund via `orders/{id}/refunds.json`                     | `ShopifyRefundService.processRefund`                            | `services/refunds/platforms/shopifyRefundService.ts`           |
| Offline refund persisted to `keyValueRepository`                  | `OfflineRefundService.processRefund`                            | `services/refunds/platforms/OfflineRefundService.ts`           |
| Return rows in SQLite                                             | `ReturnRepository`                                              | `repositories/ReturnRepository.ts`                             |
| `useRefund` initialises service on mount                          | `useRefund` useEffect                                           | `hooks/useRefund.ts`                                           |
| `processEcommerceRefund` hook method                              | `useRefund.processEcommerceRefund`                              | `hooks/useRefund.ts`                                           |
| `processPaymentRefund` hook method                                | `useRefund.processPaymentRefund`                                | `hooks/useRefund.ts`                                           |
| `getRefundHistory` hook method                                    | `useRefund.getRefundHistory`                                    | `hooks/useRefund.ts`                                           |
| Refund type selector (payment / e-commerce)                       | `ReturnsScreen` state + buttons                                 | `screens/ReturnsScreen.tsx`                                    |
| Form validation before submit (required fields + positive amount) | `ReturnsScreen.handleProcessRefund`                             | `screens/ReturnsScreen.tsx`                                    |
| Auto-fetch history on ID change                                   | `ReturnsScreen` useEffect                                       | `screens/ReturnsScreen.tsx`                                    |
| Success message + field clear                                     | `ReturnsScreen.handleProcessRefund` success path                | `screens/ReturnsScreen.tsx`                                    |
| Error message preserved on failure                                | `ReturnsScreen.handleProcessRefund` failure path                | `screens/ReturnsScreen.tsx`                                    |
| Button disabled when not initialised                              | `ReturnsScreen` Button `disabled` prop                          | `screens/ReturnsScreen.tsx`                                    |
