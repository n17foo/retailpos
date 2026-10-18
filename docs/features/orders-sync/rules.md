# Orders, Sync & Offline — Rules

Sync status machine: `pending → synced | pending(retry) | failed → (discard) cancelled`

## R1 — Orders are local-first

**Rule.** A paid order is persisted to SQLite before any platform sync is
attempted. Sync is always a second, retriable step — never a precondition of
saving the sale.

**Evidence.** `features/orders-sync/repositories/OrderRepository.ts`, `features/checkout/services/CheckoutService.ts`,
`features/orders-sync/services/sync/OrderSyncService.ts`, spec `sync.md §7`.

🟢 **E1.1 — Sale survives sync failure**
Given a paid order whose platform call fails, when sync runs, the order
remains fully recorded locally with `sync_status` reflecting the failure —
the sale is never lost.

🟢 **E1.2 — Order items stored**
Each order's line items persist in `order_items` (quantities, prices, tax,
notes, sale_mode) — reprints and reports work entirely from local data.

## R2 — Sync classification and retry

**Rule.** Sync errors classify as retryable (network failure / HTTP 5xx) or
non-retryable (HTTP 4xx, unknown). Retryable errors keep the order `pending`
and increment a KV-persisted counter until `MAX_SYNC_RETRIES()` (default 3);
then the order becomes `failed`. `synced` orders are never re-synced.

**Evidence.** `features/orders-sync/services/sync/OrderSyncService.ts` (`isRetryable`, KV `sync:retries:*`),
`POSConfigService.MAX_SYNC_RETRIES`, spec `sync.md §1.7`.

🟢 **E2.1 — Success**
Given a paid pending order, when the platform call succeeds, then
`sync_status='synced'` and `platform_order_id` is stored; a KDS ticket
dispatches.

🟢 **E2.2 — Idempotent**
Given a `synced` order, when `syncOrderToPlatform` runs again, it returns
success immediately — no duplicate platform call (spec 5.2).

🔴 **E2.3 — Network / 5xx (retryable)**
Order stays `pending`, count = attempt n/MAX; retried on next pass.

🔴 **E2.4 — 4xx or unknown (non-retryable)**
Order marked `failed` immediately — appears in Sync Queue for manual action.

🟠 **E2.5 — Not paid**
`status !== 'paid'` → `{ success: false, 'Order must be paid before syncing' }`
— drafts can never sync.

🟠 **E2.6 — Missing order**
Unknown orderId → `error: 'Order not found'`, no platform call.

## R3 — Offline orders never call a platform

**Rule.** An order with `platform === OFFLINE` (or undefined) is marked
`synced` immediately — `platformOrderId = orderId`, no network activity
(spec §5.8).

**Evidence.** `OrderSyncService.syncOrderToPlatform` offline fast-path.

🟢 **E3.1 — Offline order completes**
Given an offline-platform order, when sync runs, then it is marked synced
instantly and a KDS ticket still dispatches.

📴 **E3.2 — Online sale while disconnected**
Given an online-platform sale with no connectivity, when the sync attempt
fails, then the order stays `pending`; the background loop and/or Sync Queue
retry it when the network returns.

## R4 — Draft completion vs order creation

**Rule.** If the order carries a `platformOrderId` (a platform draft created
at checkout — `native_draft` platforms), sync **completes** that draft via
`completeOrder()`; otherwise it creates a new order via `createOrder()`
(`remote_cart` platforms). Prevents duplicate orders on the platform.

**Evidence.** `OrderSyncService.syncOrderToPlatform`, spec `sync.md` Context.

🟢 **E4.1 — native_draft (Shopify/Wix/Commercefull)**
Draft ID present → `completeOrder(platformOrderId, paymentMethod)` → synced.

🟢 **E4.2 — remote_cart (WooCommerce/Magento/…)**
No draft → `createOrder()` with mapped line items → synced.

🟠 **E4.3 — Platform ID mapping**
Line items send `item.originalId ?? productId` / raw variant IDs via
`toPlatformProductId`/`toPlatformVariantId` — the platform sees its own IDs,
not POS-prefixed ones.

## R5 — Background retry loop

**Rule.** `backgroundSyncService.start(300000)` in `App.tsx` syncs every 5 min.
Consecutive failures exponentially back off (`base × 2ⁿ`, cap 15 min); any
success resets the interval. The service pauses while the app is backgrounded
and triggers a sync on foreground.

**Evidence.** `features/orders-sync/services/sync/BackgroundSyncService.ts`, `App.tsx`.

📱 **E5.1 — App backgrounded**
Timer keeps running but sync work is skipped; on `AppState → 'active'` an
immediate sync runs and the loop reschedules.

🟠 **E5.2 — Persistent failure**
Each failing pass doubles the delay up to 15 min; toast notifications warn
("Orders Synced" / "Sync Failed" / "Sync Error" up to 3 consecutive errors).

📱 **E5.3 — App restart**
Retry counts are KV-persisted (`sync:retries:<orderId>`) → survive restart;
`sync_status` in SQLite is
the durable state; `failed` orders stay failed (no auto-reset).

## R6 — Sync Queue management

**Rule.** `SyncQueueScreen` (manager+, More → Sync Queue) lists pending +
failed orders with counts (total / pending / failed). Per order: **Retry**
(always) and **Discard** (failed only). "Retry All" re-queues everything.

**Evidence.** `features/orders-sync/screens/SyncQueueScreen.tsx`, `features/orders-sync/hooks/useSyncQueue.ts`,
`OrderSyncService.{retrySingleOrder,discardFailedOrder}`, spec `sync.md §2`.

🟢 **E6.1 — Retry one**
`retrySingleOrder` resets the counter to 0 and `sync_status` to `pending`,
then runs `syncOrderToPlatform` — a full fresh set of attempts (spec 6.4).

🟢 **E6.2 — Retry all**
`syncAllPendingOrders` iterates `getUnsyncedOrders`; result alert
"Synced: X, Failed: Y".

🟢 **E6.3 — Discard (failed only)**
Destructive confirm → `updateStatus('cancelled')` +
`updateSyncError('failed','Manually discarded by user')` → leaves the queue.

🔴 **E6.4 — Discard guard**
`discardFailedOrder` refuses non-`failed` orders (logs + returns `false`) —
the UI only shows Discard on failed cards.

📴 **E6.5 — Queue load failure**
`loadQueue` throws → `loadError` is set → the screen renders a distinct
"Couldn't load the sync queue — pull down to retry" state (was: silently
rendered "All synced!").

## R7 — Order History day navigation & scoping

**Rule.** `OrderHistoryScreen` browses orders by day offset. **Cashiers**
are locked to today (`dayOffset` can't navigate) and see **only their own
orders** (`cashierFilter = user.id`). Managers/admins see all cashiers and
any past/future day.

**Evidence.** `features/orders-sync/hooks/useOrderHistory.ts`, `features/orders-sync/utils/orderHistory.utils.ts`,
`OrderRepository.findByDateRange`.

🟢 **E7.1 — Cashier today**
Prev/Next buttons hidden; list = today's orders where `cashier_id = user.id`.

🟢 **E7.2 — Manager browses**
Free day navigation; all cashiers' orders.

🔴 **E7.3 — Resync from history**
Each order card offers Resync → same `syncOrderToPlatform` path; success
refreshes the list.

🔴 **E7.4 — Admin delete**
`isAdmin` only; destructive confirm → `orderRepository.delete` (CASCADE
removes `order_items`).

## R8 — Receipt reprint & shifts

**Rule.** From Order History a receipt can be reprinted (ReceiptModal →
`printerService.printReceipt`) and shifts can be opened/closed with a
daily report (`useDailyReport` → `DailyReportService`).

**Evidence.** `features/orders-sync/screens/{ReceiptModal,ReceiptTemplate,ShiftModal,ReportModal}.tsx`,
`features/orders-sync/hooks/useDailyReport.ts`.

🟢 **E8.1 — Reprint**
Any listed order → Receipt preview modal → Print → thermal printer.

🟢 **E8.2 — Shift lifecycle**
Open Shift (opening cash) → badge shows "Shift Open" → Close Shift
(closing cash) → daily report modal can print.

🟠 **E8.3 — Reprint without printer**
Print attempt fails → alert; order data unaffected.

## R9 — Multi-register propagation

**Rule.** On **client** registers, `useOrders` subscribes to
`syncEventBus` `order:created / order:updated / order:paid` events and
refreshes the list — so orders taken on the server register appear live.

**Evidence.** `features/orders-sync/hooks/useOrders.ts`, `features/multi-register/services/sync/{SyncEventBus,SyncPoller}.ts`,
`instoreApiConfig.isClient`.

🟢 **E9.1 — Server takes order, client sees it**
Client register's order list refreshes on each event — no manual reload.

🟠 **E9.2 — Server register**
`isClient === false` → no subscription (server owns the data; no need to
listen to itself).

## R10 — Post-payment auto-sync

**Rule.** `CheckoutProvider.syncAllPendingOrders` runs after checkout and
for each unsynced order calls `orderSyncService.syncOrderToPlatform` —
fire-and-forget; failures simply leave `sync_status` for the queue.

**Evidence.** `features/checkout/contexts/CheckoutProvider.tsx:133-141`, spec `sync.md §7`.

🟢 **E10.1 — Happy path**
Payment succeeds → order syncs within seconds → `unsyncedOrdersCount` drops
→ sync banner clears on the sale screen.

🔴 **E10.2 — Post-payment failure**
Order stays `pending` → "N unsynced" banner on sale + Sync Queue card;
background loop keeps retrying.

## Open Questions

**Q1 — Cashier resync/delete role gating.** The Sync Queue Discard button
gated by UI (`isFailed`), but is `SyncQueueScreen` itself manager-only? Route
registration sits in `MoreNavigator` — access depends on menu capability
gating, not an explicit in-screen role check.

**Q2 — Sync of `cancelled` orders.** A discarded order is `cancelled` with
`sync_status='failed'` — it leaves the queue, but if anything later re-reads
`getUnsyncedOrders` does a cancelled order still count? (`findUnsynced`
filters status + sync_status — verify.)

**Q3 — Shift data platform scope.** Are `DailyReportService` shift records
platform-synced or purely local (in which case multi-register shifts diverge)?

## Potential Coverage Gaps

~~⚠️ **PG1 — In-memory retry counts.**~~ **RESOLVED** — retry counts persist
in KV (`sync:retries:<orderId>`); exhaustion survives restarts.

~~⚠️ **PG2 — Silent queue load failure.**~~ **RESOLVED** — see E6.5.

⚠️ **PG3 — Cashier sees own-orders filter, but delete is admin-only.** A
manager (non-admin, non-cashier) sees all orders but cannot delete — the
role check is `isAdmin`, not `isManager`; confirm intended.

⚠️ **PG4 — Notification spam.** Every background pass with failures shows a
toast; on a flaky network that's a notification per interval (capped at 3
consecutive for errors only — the failed-orders toast fires every pass).

⚠️ **PG5 — Reprint needs real printer.** Receipt reprint calls
`printerService.printReceipt` directly — no offline/queue fallback; a
disconnected printer just errors.

## Test Coverage Mapping

| Example  | Behaviour                  | Coverage                                                                         |
| -------- | -------------------------- | -------------------------------------------------------------------------------- |
| E2.3/2.4 | retryable vs non-retryable | Not found for `OrderSyncService` directly                                        |
| E5.x     | backoff loop               | `features/orders-sync/services/sync/BackgroundSyncService.notifications.test.ts` |
| E6.x     | queue actions              | spec `sync.md §2` mirrors screen logic                                           |
| E9.x     | event bus refresh          | Not found                                                                        |

## Feature Context Summary

**Feature**: Orders, Sync & Offline
**Responsibility**: Persist every paid order locally, sync to the platform
(retryable queue), and let managers monitor/resync/discard — plus order
history, receipt reprint, shifts, and multi-register live updates.

**Core rules**

- R1 Local-first persistence — sync is a second step.
- R2 Retryable (5xx/network) → `pending`; non-retryable → `failed`.
- R3 Offline orders → instant `synced`, no API.
- R4 `platformOrderId` → completeOrder; else createOrder.
- R5 Background loop 5min, backoff ×2→15min, pause/resume on app state.
- R6 Sync Queue: Retry / Retry All / Discard (failed only).
- R7 Cashier = today + own orders; manager/admin = all days/all cashiers.
- R9 Client registers live-refresh via syncEventBus.

**Primary happy path**: pay → order saved pending → completeOrder/createOrder
→ synced + KDS ticket → banner clears.

**Critical unhappy paths**: sync failure → pending queue → background retry →
manual Retry/Discard; offline order → instant synced; not-paid → rejected.

**Offline behaviour**: orders never lost (SQLite-first); offline platform
self-syncs; online failures queue and retry automatically on reconnect.

**Lifecycle**: background sync pauses in background, syncs on foreground;
retry counters persist in KV (DB `sync_status` is durable).

**Dependencies**: `shared/utils/db.ts`, `OrderServiceFactory`, `platformIds`,
`MAX_SYNC_RETRIES`, KDS factory, `syncEventBus`/WebSocket, auth role.
