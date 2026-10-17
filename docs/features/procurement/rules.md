# Procurement — Rules

## R1 — Everything is local-first; the platform only sees stock pushes

**Rule.** All procurement entities are SQLite rows. Platform interaction
happens exactly twice: `receivePO` and `finaliseCount` push
`{adjustment:true}` updates through `InventoryServiceFactory`, gated by the
`inventory` capability — `not_recommended` ⇒ local-only.

**Evidence.** `services/procurement/ProcurementService.ts:99-135`,
`repositories/ProcurementRepository.ts`.

🟢 **E1.1 — Offline platform**
Entire workflow runs; receive writes local stock rows — no API call.

🔴 **E1.2 — `inventory: not_recommended` platform**
Stock adjusts locally; platform never updated → platform stock drifts (by
design per spec, but a real divergence — PG1).

## R2 — PO lifecycle is one-way; cancel only before receiving

**Rule.** `draft → ordered → partially_received → received`; `cancelled` only
from `draft|ordered`. `receivePO` increments `received_qty` per line; status
becomes `received` only when every line's `received_qty ≥ ordered_qty`.

**Evidence.** `ProcurementService.{createPO,submitPO,cancelPO,receivePO}`,
`POStatus` type.

🟢 **E2.1 — Partial receipt**
Receive 5 of 10 → `partially_received`; later receive the rest → `received` +
notification.

🔴 **E2.2 — Cancel a partially-received PO** — rejected; the PO can only
complete.

🟠 **E2.3 — Over-receive a line** — `incrementReceivedQty` doesn't appear to
cap at `ordered_qty` (verify — PG2).

## R3 — Receiving is local-first; failed pushes queue for replay

**Rule.** `receivePO` collects lines with `receiveNow > 0`, increments each
received qty, then sends one batched `updateInventory` of adjustments. A
failed or partially-failed push doesn't abort the receive — the physical
goods arrived regardless — but `RetryingInventoryService` has persisted the
updates to the pending-inventory queue (`inventory:pendingUpdates`, KV) and
the result carries `platformSyncPending:true`; the queue replays on the next
successful inventory call. `finaliseCount` follows the same pattern.

**Evidence.** `ProcurementService.receivePO`, `InventoryCountService.finaliseCount`,
`services/inventory/{RetryingInventoryService,PendingInventoryStore}.ts`.

� **E3.1 — Push fails mid-receive**
Local `received_qty` commits; the platform updates queue and replay later →
`platformSyncPending` flags the transient divergence instead of hiding it.

🟠 **E3.2 — Zero-qty lines ignored** — `receiveNow <= 0` skipped silently.

## R4 — Stock-takes compute variance against a snapshot

**Rule.** `startCount` snapshots `expected_qty` per item; counting records
`counted_qty`; `finaliseCount` computes `variance = counted − expected` per
counted line and pushes adjustments; uncounted lines (`counted_qty IS NULL`)
are excluded; status → `completed`, or `discarded` to abandon.

**Evidence.** `services/procurement/InventoryCountService.ts:46-90`.

🟢 **E4.1 — Counted 8, expected 10** → adjustment −2 pushed.

🟠 **E4.2 — Uncounted lines** — skipped entirely; no zero-filling (missing
lines retain platform stock — is that intended? Q1).

📴 **E4.3 — Discard** — session + counts abandoned; nothing pushed.

## R5 — Reorder points drive the Inventory screen's low-stock view

**Rule.** `setReorderPoint(productId, variantId, {reorder_point, reorder_qty,
default_vendor_id})` — the Inventory screen merges configs keyed
`{productId}-{variantId}`; "low" = qty ≤ reorder_point; Create-PO suggests
`reorder_qty`.

**Evidence.** `ProcurementService.setReorderPoint`,
`screens/InventoryScreen.tsx`.

🟠 **E5.1** — no config → item never shows "low" (see inventory doc PG2).

## R6 — Transfers and vendor returns are local records only

**Rule.** `TransferStatus: draft → in_transit → received | cancelled`;
`VendorReturnStatus: pending → confirmed | cancelled`. No platform
integration observed — receiving a transfer doesn't push stock between
locations (single-location stock anyway).

**Evidence.** `repositories/ProcurementRepository.ts`, screens.

🟠 **E6.1** — a "received" transfer changes nothing at the platform — purely
a bookkeeping record (Q2).

## ❓ Open Questions

- **Q1** — Uncounted lines on finalise: excluded from adjustments — so a shelf
  missed in the count keeps platform stock. Intended?
- **Q2** — Transfer orders move stock between locations — but inventory has
  one location; do transfers adjust quantities at all, or are they purely
  audit/paper records?
- **Q3** — Multi-register: do procurement records replicate via instoreapi,
  or is each register's procurement data isolated?
- **Q4** — `submitPO` stamps `ordered_at`; is there a vendor notification /
  exported PO document (PDF/email), or is ordering also manual outside the
  app?

## ⚠️ Potential Gaps

- **PG1** — Capability-gated push means a `not_recommended` platform drifts
  from POS stock permanently — no reconciliation.
- **PG2** — `incrementReceivedQty` may allow over-receiving a line.
- **PG3 — resolved** — Failed pushes persist to the pending-inventory queue
  and replay (E3.1); `platformSyncPending` surfaces the pending state in
  `ReceiveResult`/`FinaliseResult` and audit metadata. Deltas are
  at-least-once — a lost response can double-apply, same caveat as the
  generic queue.
- **PG4** — No per-line max on PO quantities/costs; a typo'd qty/cost records
  faithfully.
- **PG5** — Counts during trading hours: expected_qty is a start-time
  snapshot; sales between start and finalise inflate variance.

## Test Coverage Mapping

| Example         | Coverage  |
| --------------- | --------- |
| R2/R3 PO flow   | Not found |
| R4 variance     | Not found |
| repository CRUD | Not found |

## Feature Context Summary

**Feature**: Procurement
**Responsibility**: Local-first POs (draft→ordered→partial→received),
vendors, stock-takes with variance adjustments, transfers, vendor returns,
reorder points; platform stock pushed only on receive/finalise.

**Core rules**

- R1 SQLite-first; platform touched only via inventory adjustments.
- R2 One-way PO lifecycle; cancel only pre-receipt; status by full receipt.
- R3 Receive = local increments + one batched push; failure ⇒ queued retry +
  `platformSyncPending`.
- R4 Finalise posts `counted − expected` variances; uncounted excluded.
- R5 Reorder points power low-stock + PO suggestions.
- R6 Transfers/vendor-returns are local bookkeeping only.

**Primary happy path**: low stock → Create PO → order → receive → stock
pushed + status received + notification.

**Critical unhappy paths**: platform push failure post-increment → queued
replay (E3.1); cancel blocked once receiving began; capability-hidden
divergence (PG1).

**Offline**: fully functional — all records + local adjustments persist;
platform push skipped.

**Gaps**: over-receive cap, at-least-once push semantics, snapshot-vs-live-sales
variance skew.
