# Basket

## Purpose

Manages the active register cart: line items, quantity adjustments (clamped to tracked stock), line-level and order-level notes, customer attachment, checkout blocker validation, loyalty/store-credit basket adjustments, and crash-safe SQLite persistence across restarts.

## Scope

### Included

- `BasketPanel` (split-screen right column or phone bottom sheet) and `BasketBar` (sticky phone bottom bar).
- `BasketBlockers` — inline validation chips (`customer-required`, `variant-required`, `unsynced-orders`) gating checkout.
- `BasketStateProvider` and `BasketActionsProvider` contexts.
- `useAddToBasket` (unified sellability and stock-clamped add path) and `useLoyaltyBasket` (customer loyalty/store-credit balances and redemptions).
- `BasketService`, `BasketServiceFactory`, and `BasketRepository` (SQLite persistence in `baskets`).

### Excluded

- Catalogue browsing, category drill-down, and variant picker UI — `catalogue` feature.
- Draft order creation, payment tendering, split payments, and `SaleScreen` shell — `checkout` feature.
- Barcode/camera scanning — `scanning` feature.

## Entry Points

- `BasketPanel` mounted in `SaleScreen` (`features/checkout/screens/SaleScreen.tsx`).
- `BasketBar` mounted in stacked (phone) layout on `SaleScreen`.
- `useAddToBasket.addUnit` invoked from product tiles, `VariantPicker`, search results, and barcode scans.

## Implementation Map

| Layer        | Responsibility                          | Implementation                                                                                   |
| ------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Components   | Basket list, sticky bar, blocker banner | `features/basket/components/{BasketPanel,BasketBar,BasketBlockers}.tsx`                          |
| Contexts     | Read state & mutation actions           | `features/basket/contexts/{BasketStateProvider,BasketActionsProvider}.tsx`                       |
| Hooks        | Sellability-gated add & loyalty/credit  | `features/basket/hooks/{useAddToBasket,useLoyaltyBasket}.ts`                                     |
| Services     | Cart CRUD, totals, DI container         | `features/basket/services/{BasketService,BasketServiceFactory,BasketServiceInterface,basket}.ts` |
| Repositories | SQLite `baskets` persistence            | `features/basket/repositories/BasketRepository.ts`                                               |

## State Ownership

| State                             | Owner              | Persistence                     | Reset condition            |
| --------------------------------- | ------------------ | ------------------------------- | -------------------------- |
| Basket + items + note + saleMode  | `BasketRepository` | SQLite `baskets` (`items_json`) | Order completion / clear   |
| Selected line / note editor       | `BasketPanel`      | Memory                          | Line deselect / unmount    |
| Loyalty & store credit redemption | `useLoyaltyBasket` | SQLite ledgers                  | Sale completion / reversal |

## Dependencies

- `features/catalogue` — `isVariantSellable`, `clampToAvailable`, `UnifiedProduct`.
- `features/customers` — `CustomerSearchModal`, `loyaltyService`, `storeCreditService`.
- `features/discounts` — `discountServiceFactory`.
- `shared/utils/money.ts` — integer-cent arithmetic (`multiplyMoney`, `addMoney`, `sumMoney`, `formatMoney`).
