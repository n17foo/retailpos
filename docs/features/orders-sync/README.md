# Orders, Sync & Offline

## Purpose

Every sale is written to the local SQLite database **first** — the till never
loses an order, online or not. Afterwards, paid orders sync to the e-commerce
platform: immediately after payment (best-effort), automatically in the
background with exponential backoff, or manually from the Sync Queue screen.
Managers browse past orders in Order History, reprint receipts, resync
failures, and run shifts/daily reports. In multi-register mode, order events
flow over the LAN so every till sees each other's sales.

## Scope

### Included

- Local order persistence (`orders` + `order_items` tables) — the durable
  record of every sale.
- `OrderSyncService` — the per-order sync lifecycle
  (`pending → synced | pending(retry) | failed`).
- `BackgroundSyncService` — automatic retry loop with exponential backoff.
- `SyncQueueScreen` — manager view of pending/failed orders with
  Retry / Retry All / Discard.
- `OrderHistoryScreen` — day-browsable order list, resync, admin delete,
  receipt reprint, shift open/close, daily report.
- Multi-register sync events (`syncEventBus`) — client registers see server
  orders in real time.

### Excluded

- Taking the order / paying — that's the **checkout** feature.
- The instore-api server/discovery internals — multi-register infrastructure
  (only the order-event surface is covered here).
- Inventory/product sync — separate sync pipelines.

## Entry Points

- **Automatic** — `CheckoutService.completePayment` → sync attempt;
  `backgroundSyncService.start(300000)` in `App.tsx` retries every 5 min.
- **More → Order History** — day browser (cashiers see today+own orders;
  manager/admin see all + any day). Receipt reprint, resync, delete, shifts.
- **More → Sync Queue** — manager view of unsynced/failed orders.
- **Sale screen** — sync status chip + "N unsynced" banner + Sync button in
  `MainMenu`/`BasketPanel`.
- **Multi-register** — `syncEventBus` events refresh order lists on client
  registers when the server register reports `order:created/updated/paid`.

## Feature Flow

```
Payment complete → orders row saved (sync_status='pending')
   │
   ├─ offline platform ──→ marked 'synced' instantly (no API)
   │
   ├─ online platform:
   │     platformOrderId exists → completeOrder() (finish the draft)
   │     else → createOrder() on the platform
   │     success → sync_status='synced' + platformOrderId stored
   │     retryable error (network/5xx) → stays 'pending', retry count++
   │     non-retryable (4xx)/exhausted → 'failed' → needs Sync Queue action
   │
   └─ BackgroundSyncService every 5 min (backoff ×2 up to 15min)
         → syncAllPendingOrders() → same per-order path
         → pauses while app is backgrounded, syncs on foreground

SyncQueueScreen (manager+)
   ├─ Retry one / Retry All → fresh counter (retrySingleOrder resets)
   └─ Discard (failed only) → status 'cancelled', never syncs

OrderHistoryScreen
   ├─ day nav: cashiers see today + own orders only
   ├─ resync one order · admin delete (confirm) · receipt reprint
   └─ shifts: open/close + daily report
```

## Implementation Map

| Layer        | Responsibility                                | Implementation                                                                                                                                                 |
| ------------ | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Screens      | Day browser, queue manager                    | `features/orders-sync/screens/OrderHistoryScreen.tsx`, `features/orders-sync/screens/SyncQueueScreen.tsx` + `features/orders-sync/screens/*`                   |
| Hooks        | Order lists, queue, shifts                    | `features/orders-sync/hooks/useOrders.ts`, `useOrderHistory.ts`, `useSyncQueue.ts`, `useDailyReport.ts`                                                        |
| Contexts     | `unsyncedOrdersCount`, `syncAllPendingOrders` | `features/checkout/contexts/CheckoutProvider.tsx`                                                                                                              |
| Services     | Sync lifecycle                                | `features/orders-sync/services/sync/OrderSyncService.ts`, `BackgroundSyncService.ts`, `BaseSyncService.ts`, `CompositeSyncService.ts`, `SyncServiceFactory.ts` |
| Services     | Multi-register events                         | `features/multi-register/services/sync/{SyncEventBus,SyncPoller}.ts`, `websocket/*`                                                                            |
| Repositories | Order rows, unsynced query                    | `features/orders-sync/repositories/{OrderRepository,OrderItemRepository}.ts`                                                                                   |
| Libs         | Row mapping, day-nav rules, ID mapping        | `features/orders-sync/utils/{orderRow.utils,orderHistory.utils}.ts`, `shared/utils/platformIds.ts`                                                             |
| Locales      | Screen text                                   | `shared/locales/*` order-history / sync keys                                                                                                                   |
| Docs         | EARS specs                                    | EARS specs retired into this doc                                                                                                                               |

## State Ownership

| State                        | Owner                                 | Persistence                   | Reset condition               |
| ---------------------------- | ------------------------------------- | ----------------------------- | ----------------------------- |
| Orders + items               | `OrderRepository`                     | SQLite `orders`/`order_items` | Admin delete (confirm)        |
| `sync_status` + `sync_error` | `OrderRepository`                     | SQLite `orders`               | Retry/discard                 |
| Retry counts                 | `OrderSyncService`                    | KV (`sync:retries:*`)         | Order syncs/discards          |
| Backoff level                | `BackgroundSyncService`               | None                          | Any successful sync / restart |
| `unsyncedOrdersCount`        | `CheckoutProvider`                    | Derived from DB               | After each sync pass          |
| Day offset                   | `useOrderHistory`                     | None                          | Screen remount                |
| Current shift                | `useDailyReport`/`DailyReportService` | DB/service                    | Close shift                   |

## Dependencies

- `shared/utils/db.ts` backbone — every order lives in SQLite first.
- `OrderServiceFactory` — per-platform `createOrder`/`completeOrder`.
- `shared/utils/platformIds.ts` — maps app IDs back to raw platform IDs for sync.
- `MAX_SYNC_RETRIES()` — `posConfig.values.maxSyncRetries` (default 3).
- `kdsServiceFactory` — kitchen-display ticket dispatched on each synced order.
- `syncEventBus` + WebSocket — multi-register live updates (client registers).
- `useAuthContext` — role decides history visibility (cashier = today/own).

## Side Effects

- Platform API calls: `createOrder` or `completeOrder` per paid order.
- `updateSyncSuccess` / `updateSyncError` write `sync_status`, `sync_error`,
  `platform_order_id` to SQLite.
- KDS ticket dispatched on each successful sync.
- Toast notifications on background sync success/failure.
- Sync event bus → client registers refresh their order lists.
