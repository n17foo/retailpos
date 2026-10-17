# Inventory — Rules

## R1 — Cashiers cannot reach inventory

**Rule.** The Inventory tab is admin+manager only — `canAccessTab('cashier',
'Inventory')` → `false`; the tab is absent from a cashier's navigation.

**Evidence.** `utils/roleAccess.ts` TAB_ACCESS, `navigation/MainTabNavigator`.

🟢 **E1.1** — cashier session → no Inventory tab, no deep-link route listed in
their More menu.

## R2 — Stock loads as one bulk read, merged with reorder config

**Rule.** The screen loads the product list, then calls
`getInventory(productIds)` once, then merges `getAllReorderConfigs()` keyed
`{productId}-{variantId}` — each row shows quantity + reorder point + suggested
reorder qty.

**Evidence.** `screens/InventoryScreen.tsx:50-75`,
`hooks/useInventory.ts`, `services/procurement`.

🟢 **E2.1** — items render quantity, sku, reorderPoint, reorderQty,
defaultVendorId.

🔴 **E2.2 — Load failure** — hook sets `error`; screen surfaces the failure
(via `useInventory` error state), list stays empty.

## R3 — Adjustments are relative or absolute; results are per-item

**Rule.** `updateInventory([{productId, variantId?, quantity, adjustment?}])`:
`adjustment:true` → quantity is a ±delta; absent/false → absolute set.
`InventoryUpdateResult` returns `{successful, failed, errors[]}` — partial
success is normal.

**Evidence.** `services/inventory/InventoryServiceInterface.ts`,
`hooks/useInventory.ts:45-68`.

🟢 **E3.1 — Increment** — `adjustInventory(id, +2, variantId)` → update row
`{adjustment:true, quantity:2}`.

🟠 **E3.2 — Partial failure** — some items push, some fail →
`"N inventory updates failed"` error while the rest applied. No rollback —
but the failed subset is persisted by `RetryingInventoryService` and replayed
automatically on the next successful inventory read/write.

🔴 **E3.3 — Total failure** — service throws → error surfaced, all updates are
queued for retry (`PendingInventoryStore`, KV `inventory:pendingUpdates`).

## R4 — Filters are client-side on loaded data

**Rule.** `filter: 'all'|'low'|'out'` + free-text search filter the already-
loaded list; "low" is derived from each row's reorder point, "out" is qty 0.

**Evidence.** `screens/InventoryScreen.tsx:33,104-113`.

🟢 **E4.1** — qty ≤ reorderPoint → appears under "low"; qty 0 under "out".

🟠 **E4.2 — No reorder point configured** — item can't be classified "low" —
falls out of the low-stock view entirely (PG2).

## R5 — Offline inventory lives in SQLite

**Rule.** `OFFLINE` platform → `OfflineInventoryService` reads/writes the
local product/inventory tables — identical interface. `CompositeInventoryService`
can aggregate.

**Evidence.** `services/inventory/platforms/{Offline,Composite}InventoryService.ts`.

📴 **E5.1 — Offline platform adjustments** — persist locally; never leave the
device.

🟠 **E5.2 — Online platform, no connectivity** — adapter calls fail → per-item
errors in `InventoryUpdateResult`; the failed updates are persisted to
`inventory:pendingUpdates` and replayed by `RetryingInventoryService` when a
subsequent inventory call succeeds (see R8).

## R6 — Low stock hands off to procurement

**Rule.** "Create PO" on a low item navigates to More→PurchaseOrders with the
suggested qty — purchase-order creation itself is procurement's job.

**Evidence.** `screens/InventoryScreen.tsx` `handleCreatePO`.

🟢 **E6.1** — tap Create PO → navigate + alert naming product and suggested qty.

## R7 — Scanning matches SKU before productId

**Rule.** `findInventoryScanMatch(barcode, items)` → first item with
`sku === barcode` **or** `productId === barcode`; `null` when no match.

**Evidence.** `utils/inventoryScanner.utils.ts` (X-R2), `hooks/useInventoryScanner.ts`.

🟢 **E7.1** — barcode hits an item's SKU → row resolves for counting.

🔴 **E7.2** — no match → `null`; caller decides feedback (no implicit alert).

## R8 — Failed platform writes persist and replay at-least-once

**Rule.** `InventoryServiceFactory` wraps every non-offline service in
`RetryingInventoryService`. On `updateInventory` failure (throw or per-item
errors), the failed updates are written to `PendingInventoryStore`
(KV `inventory:pendingUpdates`). After any successful `getInventory` —
proof of connectivity — queued updates replay oldest-first in the background;
entries that fail again stay queued. Absolute writes coalesce per item
(latest wins); deltas append.

**Evidence.** `services/inventory/RetryingInventoryService.ts`,
`services/inventory/PendingInventoryStore.ts`,
`services/inventory/InventoryServiceFactory.ts` (`wrapForRetry`).

🟢 **E8.1** — adjust while offline → error shown → reconnect → next
`getInventory` replays the queued delta; store entry removed.

🟠 **E8.2** — platform applied write but response lost → delta may apply
twice (at-least-once, no idempotency key on the wire).

## ❓ Open Questions

- **Q1** — ~~Is there an offline-queue for inventory adjustments~~ Resolved:
  `RetryingInventoryService` persists failed writes in
  `inventory:pendingUpdates` and replays them at-least-once on the next
  successful inventory operation.
- **Q2** — `trackInventory` semantics: do untracked products appear in this
  screen at all, and can you edit their "quantity"?
- **Q3** — `BarcodeLabelScreen` — which printer service + label format does it
  target (separate label printer vs receipt printer)?

## ⚠️ Potential Gaps

- **PG1** — ~~Partial update failure leaves divergence with no retry~~ Resolved:
  failed updates are queued (`RetryingInventoryService` +
  `PendingInventoryStore`, KV `inventory:pendingUpdates`) and replayed
  oldest-first on the next successful read/write. Absolute writes coalesce
  (latest wins); deltas may double-apply if the platform applied a write whose
  response was lost — inherent at-least-once caveat, no ETag exists.
- **PG2** — Items without reorder config are invisible to the "low" filter —
  low-stock alerts depend entirely on config coverage.
- **PG3** — ~~No connectivity on online platform → per-item failures; nothing
  queued~~ Resolved with PG1 — failures now persist for replay instead of
  being discarded.
- **PG4** — `adjustInventory` concurrent edits (two registers) race: last
  writer wins; no version/etag in `InventoryUpdate`.
- **PG5** — Stock-take counting via scanner (`useInventoryScanner`) — verify
  whether counts are persisted incrementally or only on session submit;
  app termination mid-count could lose progress.

## Test Coverage Mapping

| Example            | Coverage                                                         |
| ------------------ | ---------------------------------------------------------------- |
| R5 offline adapter | `CommercefullInventoryService.test.ts` exists (platform adapter) |
| R3 update result   | Not found at hook level                                          |
| R7 scan match      | `utils/inventoryScanner.utils.test.ts`                           |

## Feature Context Summary

**Feature**: Inventory management
**Responsibility**: Manager/admin stock view + adjustments per platform,
reorder-point awareness, low/out filtering, scan-assisted counting, PO
hand-off, label printing.

**Core rules**

- R1 Admin/manager only.
- R2 Bulk read + reorder-config merge.
- R3 Relative/absolute updates; per-item results; partial failure possible.
- R4 Client-side filters; "low" needs a reorder point.
- R5 OFFLINE → SQLite adapter; same interface.
- R6 Low stock → Create-PO hand-off to procurement.
- R7 Scan matches SKU first.

**Primary happy path**: open tab → see merged stock+reorder list → adjust a
row → platform updated → low item → Create PO.

**Critical unhappy paths**: partial failure → "N failed" while others applied;
no connectivity → per-item errors; no reorder config → item can't show "low".

**Offline**: full read/write via `OfflineInventoryService`; online-platform
failures queue to `inventory:pendingUpdates` and retry on next success.

**Gaps**: concurrent-register races (no version/etag); retry is at-least-once
so lost-response deltas may double-apply; scan session persistence unclear.
