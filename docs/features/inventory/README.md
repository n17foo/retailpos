# Inventory

## Purpose

Manager/admin view of live stock levels across the active platform's
catalogue, with per-item adjustment (increment/decrement or absolute set),
low/out-of-stock filtering, reorder-point integration, barcode-label printing,
and scan-driven stock counting. Platform reads/writes go through
`InventoryServiceFactory` per-platform adapters; offline platform uses
`OfflineInventoryService` against SQLite.

## Scope

### Included

- `InventoryScreen` — searchable/filterable stock list (`all|low|out` tabs),
  inline quantity edit, summary footer.
- `useInventory` — `getInventory(productIds)` + `updateInventory(updates)` +
  `adjustInventory(productId, ±n)`.
- Per-platform adapters (`shared/utils/*` — 9 platforms +
  `OfflineInventoryService`, `CompositeInventoryService`).
- `RetryingInventoryService` + `PendingInventoryStore` — factory-applied
  decorator: failed online writes persist to KV and replay on the next
  successful inventory call (rules.md R8).
- Reorder-point config (`ReorderPointConfigScreen`, driven by
  `procurementService.getAllReorderConfigs`) and "Create PO" hand-off.
- `BarcodeLabelScreen` — print barcode labels for items.
- `useInventoryScanner` + `features/inventory/utils/inventoryScanner.utils.ts` — scan→item match
  during stock counting.

### Excluded

- Selling/stock gating at sale time — `features/catalogue/utils/sellability.ts` (sale feature;
  `isVariantSellable` reads `inventoryQuantity`/`isAvailable`).
- Purchase orders, vendors, stock-takes, transfers — **procurement** feature
  (this screen links into it).
- Catalogue content (names/prices) — product services (sale catalogue).

## Entry Points

- **Inventory tab** — `app/navigation/MainTabNavigator.tsx` (role-gated:
  admin+manager only; cashiers never see it — `shared/utils/roleAccess.ts`).
- **Inventory → Reorder config** — `ReorderPointConfigScreen`.
- **Inventory → Create PO** — navigates to More → PurchaseOrders.
- **Inventory → Barcode labels** — `BarcodeLabelScreen`.
- **Scan** — scanner input matches items via `findInventoryScanMatch`.

## Feature Flow

```
Open Inventory tab → load product list → getInventory(productIds) (one call)
   → merge with reorderConfigs keyed {productId}-{variantId}
   → InventoryItemCard rows (qty, sku, reorder point)

Filter: search text  +  tab all|low|out (reorder point drives "low")

Adjust: edit row → updateInventory([{productId, variantId, quantity, adjustment}])
   → adapter pushes to platform (or local DB on OFFLINE)
   → InventoryUpdateResult {successful, failed, errors[]}

Low stock → "Create PO" → More→PurchaseOrders (procurement feature)
```

## Implementation Map

| Layer    | Responsibility                                      | Implementation                                                                                                                                                                                |
| -------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Screens  | List, filters, edit, reorder cfg, labels            | `features/inventory/screens/InventoryScreen.tsx`, `features/inventory/screens/{InventoryItemCard,InventoryFilterTabs,InventorySummaryFooter,ReorderPointConfigScreen,BarcodeLabelScreen}.tsx` |
| Hooks    | Platform access, scan match                         | `features/inventory/hooks/{useInventory,useInventoryScanner}.ts`                                                                                                                              |
| Services | Factory + 9 platform adapters + offline + composite | `features/inventory/services/{InventoryServiceFactory,InventoryServiceInterface,platforms/*}`                                                                                                 |
| Services | Reorder config read                                 | `features/procurement/services/ProcurementService.getAllReorderConfigs`                                                                                                                       |
| Libs     | Scan matching                                       | `features/inventory/utils/inventoryScanner.utils.ts`                                                                                                                                          |
| Libs     | Tab role gating                                     | `shared/utils/roleAccess.ts` (`canAccessTab`)                                                                                                                                                 |
| Locales  | Tab/filter/labels                                   | `locales/*`                                                                                                                                                                                   |

## State Ownership

| State                     | Owner                     | Persistence      | Reset condition  |
| ------------------------- | ------------------------- | ---------------- | ---------------- |
| Inventory levels          | Platform service / SQLite | Platform + local | Refresh/re-mount |
| Reorder configs           | `ProcurementRepository`   | SQLite           | User edit        |
| Filter/search/editing row | `InventoryScreen` local   | None             | Unmount          |
| Scan buffer               | `useInventoryScanner`     | None             | Instance         |

## Dependencies

- `shared/utils/roleAccess.ts` — tab hidden from cashiers.
- `features/catalogue/services/product` — product list provides names/SKUs the stock rows render.
- `features/procurement/services` — reorder configs + Create-PO hand-off.
- `features/inventory/utils/inventoryScanner.utils.ts` — barcode→item resolution.
- Platform credentials/connectivity for online adapters.

## Side Effects

- Platform API writes on every adjustment (or SQLite write offline).
- Navigation to procurement PurchaseOrders.
- Barcode-label printing via printer service.
- Error alerts + logger entries on partial/total update failure.
