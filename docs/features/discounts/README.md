# Discounts (Coupons)

## Purpose

Validate a discount code against the platform or the local discount table and
apply the resulting amount to the basket. Validation returns a cent-accurate
`discountAmount` plus rule metadata (type, min purchase, usage limits,
expiry). Only Shopify has a real platform adapter today; offline mode uses
`LocalDiscountService` over the `discounts` table.

## Scope

### Included

- `DiscountServiceFactory` + adapters — `ShopifyDiscountService`,
  `LocalDiscountService`, `BaseDiscountService` (9-platform factory shape,
  most platforms unresolved → base/local).
- `validateDiscountCode(code, subtotal)` → `DiscountValidationResult`:
  validity, `discountType: fixed|percentage`, cent `discountAmount`,
  `minimumPurchase`, `maximumDiscount`, `expiresAt`, `usageLimit/usageCount`.
- Local rule evaluation + `incrementUsageCount`.
- Basket application — `BasketService.applyDiscount(code)` →
  `basket.discountCode`/`discountAmount` (recomputed in totals).
- Loyalty/store-credit plumbing — `BasketPanel` synthesises
  `LOYALTY_<amt>`/`CREDIT_<amt>` pseudo-codes through the same path
  (deferred redesign — documented as observed coupling).

### Excluded

- Loyalty/store-credit ledgers — **customers** feature.
- Tender settlement — sale/checkout.
- Discount administration UI — no management screen found (codes are
  platform-managed or seeded in the discounts table).

## Entry Points

- **Checkout/discount input** — apply code → validate → basket updated.
- **Loyalty/credit redemption buttons** — pseudo-code path in `BasketPanel`.

## Feature Flow

```
Enter code → validateDiscountCode(code, subtotal)
   ├─ platform adapter (Shopify) → platform validates → amount
   └─ OFFLINE → LocalDiscountService
        → findByCode → validateDiscountRules (active, dates,
          minPurchase, usageLimit) → incrementUsageCount → result
→ BasketService.applyDiscount(code) → basket.discountCode/Amount
→ checkout carries discount into order + sync payload
```

## Implementation Map

| Layer        | Responsibility            | Implementation                                                                                                                                                             |
| ------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Services     | Validation + factory      | `services/discount/{DiscountServiceInterface,DiscountServiceFactory,BaseDiscountService,LocalDiscountService}.ts`, `services/discount/platforms/ShopifyDiscountService.ts` |
| Services     | Basket application        | `services/basket/BasketService.ts` (`applyDiscount`), `contexts/BasketActionsProvider.tsx`                                                                                 |
| Components   | Code entry + pseudo-codes | `components/CheckoutModal.tsx`, `screens/sale/BasketPanel.tsx`                                                                                                             |
| Repositories | Local discount table      | `repositories/DiscountRepository.ts`                                                                                                                                       |
| Libs         | Capability gating         | `utils/platformCapabilities.ts` (`discounts` key)                                                                                                                          |

## State Ownership

| State                  | Owner             | Persistence | Reset condition        |
| ---------------------- | ----------------- | ----------- | ---------------------- |
| Discount codes (local) | `discounts` table | SQLite      | Admin edit             |
| Applied code/amount    | Basket row        | SQLite      | Order completion/clear |
| usageCount             | `discounts` table | SQLite      | Never (monotonic)      |

## Side Effects

- `usageCount` increments on each successful local validation.
- Basket totals recompute with `discountAmount`.
- Discount flows into order + platform sync payload (`discounts` field).
- Audit/logging on validation.
