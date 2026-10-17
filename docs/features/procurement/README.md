# Procurement (POs, Vendors, Stock-Takes, Transfers)

## Purpose

Local-first stock-replenishment domain. Purchase orders, vendors, inventory
counts, vendor returns, and transfer orders all live in SQLite and work on
any platform — the only platform-coupled step is pushing stock adjustments on
receiving/finalising, through `InventoryServiceFactory` and gated by the
platform's `inventory` capability.

## Scope

### Included

- **Purchase orders** — `draft → ordered → partially_received → received |
cancelled`; `receivePO` increments received qty, pushes adjustments to the
  platform, notifies on full receipt.
- **Vendors** — supplier records (`VendorService`).
- **Inventory counts** — stock-take sessions: start with expected qtys,
  record counted qtys, finalise → variance adjustments pushed to platform.
- **Transfer orders** — `draft → in_transit → received | cancelled`.
- **Vendor returns** — `pending → confirmed | cancelled`.
- **Reorder points** — per product+variant config feeding the Inventory
  screen's "low" filter and PO suggestions.
- Screens: `ProcurementScreen` hub, `PurchaseOrdersScreen`, `VendorsScreen`,
  `InventoryCountScreen`, `TransferOrdersScreen`, `VendorReturnsScreen`.

### Excluded

- The Inventory screen itself (stock view/adjust) — **inventory** feature.
- Sale-time stock gating — `utils/sellability.ts` (sale feature).
- Vendor financials — no invoicing/payments exist.

## Entry Points

- **More → Procurement** — hub screen to all sub-screens.
- **Inventory → Create PO** — deep-links into PurchaseOrders with a suggested
  qty.
- **Capability** — screens always available; only the platform stock push on
  receive/finalise is gated by `inventory` capability (`not_recommended` →
  local-only adjustments).

## Feature Flow

```
Purchase order:
  createPO (draft) → submitPO (ordered, ordered_at stamp)
     → receivePO(lines, platform) → increment received_qty
        → push adjustments via InventoryServiceFactory (capability-gated)
        → all received? 'received' : 'partially_received'
        → audit 'purchase_order:received' + notification on full receipt
  cancelPO — only from draft|ordered

Stock-take:
  startCount (snapshot expected_qty) → updateCountedQty per line
     → finaliseCount → variance = counted − expected per line
        → adjustments pushed to platform → status 'completed'
     → or 'discarded'

Transfers / vendor returns: status transitions only (local records).
```

## Implementation Map

| Layer        | Responsibility                      | Implementation                                                                                                                                 |
| ------------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Screens      | Hub + 5 workflows                   | `screens/procurement/{ProcurementScreen,PurchaseOrdersScreen,VendorsScreen,InventoryCountScreen,TransferOrdersScreen,VendorReturnsScreen}.tsx` |
| Services     | PO/receive/reorder, vendors, counts | `services/procurement/{ProcurementService,VendorService,InventoryCountService}.ts`                                                             |
| Repositories | All procurement tables              | `repositories/ProcurementRepository.ts`                                                                                                        |
| Services     | Stock push on receive/finalise      | `services/inventory/InventoryServiceFactory`                                                                                                   |
| Libs         | Capability check                    | `utils/platformCapabilities.ts` (`inventory`)                                                                                                  |
| Services     | Audit + notify                      | `services/audit`, `services/notifications`                                                                                                     |

## State Ownership

| State                     | Owner                   | Persistence | Reset condition     |
| ------------------------- | ----------------------- | ----------- | ------------------- |
| POs + items               | `ProcurementRepository` | SQLite      | status lifecycle    |
| Vendors                   | `ProcurementRepository` | SQLite      | user edit           |
| Count sessions            | `ProcurementRepository` | SQLite      | completed/discarded |
| Transfers, vendor returns | `ProcurementRepository` | SQLite      | status lifecycle    |
| Reorder configs           | `ProcurementRepository` | SQLite      | user edit           |

## Dependencies

- `utils/platformCapabilities.ts` — `inventory` capability gates the platform
  push, nothing else.
- `services/inventory` — `updateInventory(adjustment:true)` on receive.
- `services/audit` — receiving events audited.
- `services/notifications` — "Purchase Order Received" toast.
- SQLite tables: `vendors`, `purchase_orders`, `purchase_order_items`,
  `inventory_counts`, `inventory_count_items`, `transfer_orders`,
  vendor-return + reorder-config tables.

## Side Effects

- Platform stock adjustments on receivePO/finaliseCount (online only).
- Audit events; notification on full PO receipt.
- All entities persist locally — survive restart mid-workflow.
