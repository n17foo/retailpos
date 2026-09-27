# Sync Queue – EARS Requirements

> **System**: RetailPOS – Order Sync & Queue Management
> **Actor**: Manager, System
> **Date**: 2026-04-12
> **Source**: `services/sync/OrderSyncService.ts`, `services/sync/OrderSyncServiceInterface.ts`, `hooks/useSyncQueue.ts`, `screens/SyncQueueScreen.tsx`, `repositories/OrderRepository.ts`, `services/order/OrderServiceInterface.ts`, `services/config/POSConfigService.ts`, `contexts/BasketProvider.tsx`

---

## Context

After a payment is completed locally, the order must be synchronised to the e-commerce platform. Sync behavior is capability-driven by `basketMode`:

- **`native_draft` platforms** (Shopify, Wix, Commercefull):
  - If `platformOrderId` exists, sync completes the existing draft via `orderService.completeOrder()`.
- **`remote_cart` platforms** (WooCommerce, Magento, BigCommerce, Sylius, PrestaShop):
  - No draft was created at checkout time. Sync creates a new order via `orderService.createOrder()`.
- **`local_only` platforms** (Squarespace):
  - Sync imports the order via `orderService.createOrder()` (Squarespace Orders API supports third-party POS imports).
- **Offline platform**:
  - No platform API call; order is marked synced locally.

This replaces the older two-mode interpretation (`draftOrders === supported` / `draftOrders !== supported`).

`OrderSyncService` owns the sync lifecycle. It is called immediately after payment by `CheckoutService.completePayment()` (best-effort, non-blocking) and is also available for manual retry via `SyncQueueScreen`. `useSyncQueue` provides the hook layer for the screen. Retry logic uses an in-memory counter with exponential-backoff classification — network and 5xx errors are retryable; 4xx errors are not.

### Actors

| Actor   | Role                                                                                   |
| ------- | -------------------------------------------------------------------------------------- |
| System  | Syncs paid orders to platform after payment, retries on failure, tracks retry counts   |
| Manager | Monitors queue, retries individual or all failed orders, discards unrecoverable orders |

### Sync Status Machine

```
pending → synced        (sync succeeded)
        ↘ pending       (retryable error, retries < MAX_SYNC_RETRIES)
        ↘ failed        (non-retryable error OR retries exhausted)
```

| Transition             | Trigger                                                            |
| ---------------------- | ------------------------------------------------------------------ |
| `pending` → `synced`   | `updateSyncSuccess(orderId, platformOrderId)`                      |
| `pending` → `pending`  | `updateSyncError(orderId, 'pending', message)` — retryable, queued |
| `pending` → `failed`   | `updateSyncError(orderId, 'failed', message)` — exhausted or 4xx   |
| `failed` → `pending`   | `retrySingleOrder()` — resets retry count, re-queues               |
| `failed` → `cancelled` | `discardFailedOrder()` — manager manually discards                 |

### Key Defaults

| Field                  | Default                   | Source                                   |
| ---------------------- | ------------------------- | ---------------------------------------- |
| `MAX_SYNC_RETRIES()`   | From `POSConfigService`   | `OrderSyncService.syncOrderToPlatform()` |
| Retry eligibility      | Network errors + HTTP 5xx | `OrderSyncService.isRetryable()`         |
| In-memory retry count  | Resets on app restart     | `OrderSyncService.retryCounts` Map       |
| `syncStatus` on create | `'pending'`               | `OrderRepository.create()`               |

---

## 1. Ubiquitous Requirements

**1.1** The system shall only sync orders with `status === 'paid'` — orders in any other status shall be rejected with `'Order must be paid before syncing'`.

**1.2** The system shall skip orders already marked `syncStatus === 'synced'` and return `success: true` immediately without making a platform API call.

**1.3** For orders with a `platformOrderId` (draft created at checkout on `native_draft` platforms), the system shall call `orderService.completeOrder(platformOrderId, paymentMethod)` to mark the existing draft as paid rather than creating a duplicate order.

**1.4** For orders without a `platformOrderId` and with an online platform (`remote_cart` or `local_only` mode), the system shall call `orderService.createOrder(platformOrder)` to create a new order on the platform.

**1.5** For offline orders (`platform === OFFLINE` or `undefined`), the system shall skip all platform API calls and immediately mark the order `sync_status = 'synced'` — offline orders are fully self-contained in SQLite and require no external sync.

**1.6** The system shall persist `platform_order_id` and set `sync_status = 'synced'` via `OrderRepository.updateSyncSuccess()` when a sync succeeds.

**1.7** The system shall classify sync errors as retryable (network errors, HTTP 5xx) or non-retryable (HTTP 4xx, validation errors) and apply the appropriate sync status update.

**1.8** The system shall track retry attempts per order in an in-memory `retryCounts` Map — this counter resets on app restart.

**1.9** The system shall never block the payment completion flow — sync is best-effort and failures are surfaced in the Sync Queue screen, not at the checkout UI.

---

## 2. Event-Driven Requirements

### 2.1 Post-Payment Sync (Automatic)

**2.1.1** When `CheckoutService.completePayment()` records a successful payment and the order has a `platformOrderId`, the system shall call `orderService.completeOrder(platformOrderId, paymentMethod, transactionId)` to mark the platform draft as paid.

**2.1.2** When `completeOrder()` fails, the system shall log a warning and continue — the local order is already `paid` and will be picked up by the sync queue for retry.

**2.1.3** When `completePayment()` succeeds for an offline order (no `platformOrderId`), the system shall leave `sync_status = 'pending'` so `OrderSyncService` creates the order on the platform during the next sync cycle.

### 2.2 Sync Single Order

**2.2.1** When `syncOrderToPlatform(orderId)` is called, the system shall load the order via `checkoutService.getLocalOrder(orderId)` and validate it is `status === 'paid'` and `syncStatus !== 'synced'`.

**2.2.2** When the order has a `platformOrderId`, the system shall call `orderService.completeOrder(platformOrderId, paymentMethod)` to update the existing platform draft.

**2.2.3** When the order has no `platformOrderId`, the system shall build a platform `Order` object from the local order's items, totals, customer, and discount, then call `orderService.createOrder(platformOrder)`.

**2.2.4** When `createOrder()` or `completeOrder()` succeeds, the system shall call `OrderRepository.updateSyncSuccess(orderId, platformOrderId)` to record the platform ID and set `sync_status = 'synced'`.

**2.2.5** When the sync call throws a retryable error and `retryCount < MAX_SYNC_RETRIES()`, the system shall increment the retry counter, call `OrderRepository.updateSyncError(orderId, 'pending', errorMessage)`, and return `success: false` with a "queued for retry" message.

**2.2.6** When the sync call throws a non-retryable error, or `retryCount >= MAX_SYNC_RETRIES()`, the system shall call `OrderRepository.updateSyncError(orderId, 'failed', errorMessage)`, clear the retry counter, and return `success: false`.

### 2.3 Sync All Pending Orders

**2.3.1** When `syncAllPendingOrders()` is called, the system shall call `checkoutService.getUnsyncedOrders()` to get all orders with `status = 'paid'` and `sync_status != 'synced'`, ordered by `created_at ASC`.

**2.3.2** When processing the unsynced list, the system shall call `syncOrderToPlatform()` for each order sequentially and accumulate `synced` and `failed` counts into a `SyncResult`.

**2.3.3** When `syncAllPendingOrders()` completes, the system shall return `{ synced, failed, errors[] }` to the caller.

### 2.4 Retry Single Order (Manual)

**2.4.1** When `retrySingleOrder(orderId)` is called, the system shall delete the order's entry from `retryCounts` (resetting to zero attempts) and call `OrderRepository.updateSyncError(orderId, 'pending', '')` to re-queue it.

**2.4.2** When the retry count is reset, the system shall call `syncOrderToPlatform(orderId)` and return the result.

**2.4.3** When `SyncQueueScreen` calls `retryOrder(orderId)`, the hook shall call `orderSyncService.retrySingleOrder(orderId)`, refresh the queue, and return `true` on success or `false` on failure.

**2.4.4** When `retryOrder()` returns `true`, `SyncQueueScreen` shall show `Alert.alert('Success', 'Order synced successfully.')`.

**2.4.5** When `retryOrder()` returns `false`, `SyncQueueScreen` shall show `Alert.alert('Failed', 'Order sync failed. It will be retried automatically.')`.

### 2.5 Retry All Orders (Manual)

**2.5.1** When the manager taps "Retry All", `SyncQueueScreen` shall show a confirmation dialog: `'Retry syncing X order(s)?'` where X is `totalCount`.

**2.5.2** When the manager confirms, the system shall call `useSyncQueue.retryAll()` → `orderSyncService.syncAllPendingOrders()`.

**2.5.3** When `retryAll()` completes, `SyncQueueScreen` shall show `Alert.alert('Sync Complete', 'Synced: X, Failed: Y')`.

**2.5.4** When `isProcessing` is `true`, the "Retry All" button shall show an `ActivityIndicator` and be disabled.

### 2.6 Discard Failed Order

**2.6.1** When the manager taps "Discard" on a failed order, `SyncQueueScreen` shall show a destructive confirmation: `'This order will be marked as cancelled and will not be synced to the platform. This cannot be undone.'`

**2.6.2** When the manager confirms, the system shall call `orderSyncService.discardFailedOrder(orderId)`.

**2.6.3** When `discardFailedOrder(orderId)` is called, the system shall call `OrderRepository.updateStatus(orderId, 'cancelled')` and `OrderRepository.updateSyncError(orderId, 'failed', 'Manually discarded by user')`, then clear the retry counter.

**2.6.4** When `discardFailedOrder()` returns `false`, `SyncQueueScreen` shall show `Alert.alert('Error', 'Failed to discard order.')`.

**2.6.5** When `discardFailedOrder()` succeeds, the queue shall refresh and the order shall no longer appear in the list.

### 2.7 Queue Loading & Refresh

**2.7.1** When `useSyncQueue` mounts, the system shall call `loadQueue()` which fetches all unsynced orders via `OrderRepository.findUnsynced()` plus any `paid` orders with `sync_status = 'failed'`, deduplicates, and sorts by `created_at DESC`.

**2.7.2** When the manager pulls to refresh on `SyncQueueScreen`, the system shall call `useSyncQueue.refresh()` → `loadQueue()`.

**2.7.3** When `loadQueue()` throws, the system shall silently fail and render the empty state — no error is surfaced to the manager.

**2.7.4** When any retry or discard operation completes, the system shall call `loadQueue()` to refresh counts and order statuses.

---

## 3. State-Driven Requirements

**3.1** While `isLoading` is `true` in `SyncQueueScreen`, the system shall render a full-screen `ActivityIndicator` with "Loading sync queue…" label.

**3.2** While `orders` is empty and `isLoading` is `false`, the system shall render the empty state: checkmark icon, "All synced!" title, and description text. The "Retry All" button shall be hidden.

**3.3** While `totalCount > 0`, the system shall render the summary bar showing total, pending (`totalCount - failedCount`), and failed counts, plus the "Retry All" button.

**3.4** While `isProcessing` is `true`, all Retry and Discard buttons on individual order cards shall be disabled.

**3.5** While an order has `syncStatus === 'failed'` and a non-empty `syncError`, the system shall render the error box below the order metadata.

**3.6** While an order has `syncStatus === 'failed'`, the system shall render both the "Retry" and "Discard" buttons on that card.

**3.7** While an order has `syncStatus === 'pending'`, the system shall render only the "Retry" button (no Discard — the order is not yet failed).

---

## 4. Optional Feature Requirements

**4.1** Where `item.cashierName` is non-null on a `SyncQueueOrder`, the system shall render "Cashier: {name}" in the order metadata row.

**4.2** Where `item.syncError` is non-empty on a failed order, the system shall render the error message truncated to 2 lines in the error box.

---

## 5. Unwanted Behaviour / Edge Cases

### 5.1 Order Not Found

**5.1.1** If `checkoutService.getLocalOrder(orderId)` returns `null` in `syncOrderToPlatform()`, the system shall return `{ success: false, orderId, error: 'Order not found' }` without making any platform API call.

### 5.2 Already Synced

**5.2.1** If `syncOrderToPlatform()` is called on an order with `syncStatus === 'synced'`, the system shall return `{ success: true, orderId, platformOrderId }` immediately — idempotent, no duplicate platform call.

### 5.3 Wrong Status

**5.3.1** If `syncOrderToPlatform()` is called on an order with `status !== 'paid'` (e.g. `pending`, `processing`, `draft`), the system shall return `{ success: false, orderId, error: 'Order must be paid before syncing' }`.

### 5.4 Retry Count Reset on Restart

**5.4.1** If the app restarts after a sync failure, the in-memory `retryCounts` Map is cleared — the order's `sync_status` in SQLite (`'pending'` or `'failed'`) is the durable state. On the next `syncAllPendingOrders()` call, the order will be retried with a fresh counter.

### 5.5 Concurrent Sync

**5.5.1** If `syncAllPendingOrders()` is called while a previous call is still running, both will process the same unsynced list independently — SQLite's serialised write model prevents double-updates, and `updateSyncSuccess` is idempotent for the same `platformOrderId`.

### 5.6 Platform Service Not Initialised

**5.6.1** If `orderServiceFactory.getService(platform)` returns an uninitialised service, the `createOrder()` or `completeOrder()` call will throw — this is treated as a retryable error and the order remains `sync_status = 'pending'`.

### 5.7 Discard Non-Failed Order

**5.7.1** If `discardFailedOrder()` is called on an order that is not `sync_status = 'failed'` (e.g. still `pending`), `OrderRepository.updateStatus()` will still set it to `cancelled` — callers should guard against this by only showing the Discard button for failed orders (spec 3.6).

### 5.8 Offline Orders

**5.8.1** If `syncOrderToPlatform()` is called on an order with `platform === OFFLINE` or `platform === undefined`, the system shall call `OrderRepository.updateSyncSuccess(orderId, orderId)` immediately and return `{ success: true, orderId }` — no platform API call is made.

**5.8.2** If an offline order appears in the sync queue (e.g. after an app restart before the fast-path ran), the system shall process it identically to 5.8.1 — it will be marked synced on the next `syncAllPendingOrders()` call without any network activity.

**5.8.3** If `discardFailedOrder()` is called on an offline order, the behaviour is identical to online orders — the order is marked `cancelled` in SQLite. No platform API call is needed.

---

## 6. Complex Requirements

**6.1** When `syncOrderToPlatform()` is called for an order with a `platformOrderId`, the system shall call `orderService.completeOrder()` rather than `createOrder()` — this prevents duplicate orders on the platform when the draft was already created at checkout time. The `platformOrderId` returned by `completeOrder()` is stored via `updateSyncSuccess()`.

**6.2** When `basketItemsToLineItems()` maps local basket items to platform line items, the system shall use `item.originalId ?? item.productId` as the `productId` so that online products reference their platform ID rather than the local UUID.

**6.3** When `basketItemsToLineItems()` calculates `taxAmount` and `lineTotal`, the system shall use `item.taxRate ?? DEFAULT_TAX_RATE()` as the rate — this ensures the sync payload matches the tax that was displayed to the cashier at checkout, even if the platform recalculates on its end.

**6.4** When `retrySingleOrder()` is called, the system shall reset the retry counter to zero before calling `syncOrderToPlatform()` — this gives the order a full fresh set of `MAX_SYNC_RETRIES()` attempts, regardless of how many times it previously failed.

---

## 7. Sync Lifecycle Summary

### Post-payment sync (automatic)

```
CheckoutService.completePayment() succeeds
  → [platformOrderId set] orderService.completeOrder(platformOrderId, paymentMethod)
      → [success] updateSyncSuccess() → sync_status: synced
      → [failure] log warning, sync_status stays 'pending' for queue pickup
  → [no platformOrderId, online platform] sync_status stays 'pending' for queue pickup
  → [offline platform] sync_status stays 'pending' for queue pickup
      (OrderSyncService will fast-path to synced on next cycle)

[Background / manual] syncAllPendingOrders()
  → getUnsyncedOrders()                          ← status=paid, sync_status!=synced
  → for each order:
      syncOrderToPlatform(orderId)
        → [offline platform] updateSyncSuccess(orderId, orderId) ← immediate, no API call
        → [platformOrderId] completeOrder()      ← mark existing draft as paid
        → [no platformOrderId, online] createOrder() ← create new order on platform
        → [success] updateSyncSuccess()          ← sync_status: synced
        → [retryable error, retries < MAX] updateSyncError('pending') ← re-queue
        → [non-retryable OR exhausted] updateSyncError('failed') ← needs manual action
```

### Manual retry flow

```
Manager taps "Retry" on failed order
  → retrySingleOrder(orderId)
    → retryCounts.delete(orderId)               ← reset counter
    → updateSyncError(orderId, 'pending', '')   ← re-queue
    → syncOrderToPlatform(orderId)              ← attempt sync
  → loadQueue()                                 ← refresh UI
  → Alert: success or failure

Manager taps "Retry All"
  → Alert confirmation
  → syncAllPendingOrders()
  → loadQueue()
  → Alert: "Synced: X, Failed: Y"
```

### Discard flow

```
Manager taps "Discard" on failed order
  → Alert destructive confirmation
  → discardFailedOrder(orderId)
    → updateStatus(orderId, 'cancelled')
    → updateSyncError(orderId, 'failed', 'Manually discarded by user')
    → retryCounts.delete(orderId)
  → loadQueue()                                 ← order removed from list
```

---

## 8. Component Traceability

| Requirement (summary)                             | Component / Hook / Service                                                        | Source File                            |
| ------------------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------- |
| Post-payment sync via completeOrder               | `CheckoutService.completePayment` → `orderService.completeOrder()`                | `services/checkout/CheckoutService.ts` |
| Post-payment sync failure is non-blocking         | `CheckoutService.completePayment` (catch → log warning, continue)                 | `services/checkout/CheckoutService.ts` |
| Order validated before sync                       | `OrderSyncService.syncOrderToPlatform` (status + syncStatus checks)               | `services/sync/OrderSyncService.ts`    |
| Offline order fast-pathed to synced (no API call) | `OrderSyncService.syncOrderToPlatform` (`!isOnlinePlatform` branch)               | `services/sync/OrderSyncService.ts`    |
| Draft order completed on platform                 | `OrderSyncService.syncOrderToPlatform` → `orderService.completeOrder()`           | `services/sync/OrderSyncService.ts`    |
| New order created on platform (no draft)          | `OrderSyncService.syncOrderToPlatform` → `orderService.createOrder()`             | `services/sync/OrderSyncService.ts`    |
| Sync success recorded                             | `OrderRepository.updateSyncSuccess(orderId, platformOrderId)`                     | `repositories/OrderRepository.ts`      |
| Retryable error → re-queue                        | `OrderSyncService` → `updateSyncError(orderId, 'pending', msg)`                   | `services/sync/OrderSyncService.ts`    |
| Non-retryable / exhausted → failed                | `OrderSyncService` → `updateSyncError(orderId, 'failed', msg)`                    | `services/sync/OrderSyncService.ts`    |
| Error classification                              | `OrderSyncService.isRetryable()` (network + 5xx = retryable)                      | `services/sync/OrderSyncService.ts`    |
| Retry counter tracked in memory                   | `OrderSyncService.retryCounts` Map                                                | `services/sync/OrderSyncService.ts`    |
| Sync all pending orders                           | `OrderSyncService.syncAllPendingOrders()` → sequential loop                       | `services/sync/OrderSyncService.ts`    |
| Unsynced orders queried                           | `CheckoutService.getUnsyncedOrders()` → `OrderRepository.findUnsynced()`          | `services/checkout/CheckoutService.ts` |
| Manual retry single order                         | `OrderSyncService.retrySingleOrder()` → reset counter + re-sync                   | `services/sync/OrderSyncService.ts`    |
| Manual discard failed order                       | `OrderSyncService.discardFailedOrder()` → `updateStatus('cancelled')`             | `services/sync/OrderSyncService.ts`    |
| Queue loaded on mount                             | `useSyncQueue.loadQueue()` → `OrderRepository.findUnsynced()` + `findAll('paid')` | `hooks/useSyncQueue.ts`                |
| Queue refreshed after operations                  | `useSyncQueue` → `loadQueue()` after retry/discard                                | `hooks/useSyncQueue.ts`                |
| Summary bar counts                                | `SyncQueueScreen` → `totalCount`, `failedCount` from `useSyncQueue`               | `screens/SyncQueueScreen.tsx`          |
| Order card status badge (green/amber/red)         | `SyncQueueScreen.getSyncStatusColor()`                                            | `screens/SyncQueueScreen.tsx`          |
| Retry All confirmation dialog                     | `SyncQueueScreen.handleRetryAll` → `Alert.alert`                                  | `screens/SyncQueueScreen.tsx`          |
| Discard confirmation dialog (destructive)         | `SyncQueueScreen.handleDiscardOrder` → `Alert.alert` (destructive)                | `screens/SyncQueueScreen.tsx`          |
| Pull-to-refresh                                   | `SyncQueueScreen` → `RefreshControl` → `useSyncQueue.refresh()`                   | `screens/SyncQueueScreen.tsx`          |
| Empty state ("All synced!")                       | `SyncQueueScreen` `ListEmptyComponent`                                            | `screens/SyncQueueScreen.tsx`          |
| Basket items mapped to platform line items        | `OrderSyncService.basketItemsToLineItems()` (originalId, taxRate)                 | `services/sync/OrderSyncService.ts`    |
