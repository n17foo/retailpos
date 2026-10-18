# Discounts — Rules

## R1 — Validation answers "valid + how much" in cents

**Rule.** `DiscountValidationResult` carries `valid`, `discountAmount`
(**cents**), `discountType: fixed|percentage`, `discountValue`, plus rule
metadata (`minimumPurchase`, `maximumDiscount`, `expiresAt`, `usageLimit`,
`usageCount`). `error` explains invalid codes.

**Evidence.** `features/discounts/services/DiscountServiceInterface.ts`.

🟢 **E1.1** — valid 10% code on £20 subtotal → `discountAmount` 200 (cents).

🔴 **E1.2 — Unknown code** → `valid:false`, `'Invalid discount code'`.

## R2 — Local validation enforces rules and counts usage

**Rule.** `LocalDiscountService`: code must exist, be active/in-date, meet
`minimumPurchase`, stay under `usageLimit`; success increments
`usageCount` in the same flow.

**Evidence.** `features/discounts/services/LocalDiscountService.ts:25-47`,
`features/discounts/repositories/DiscountRepository.ts`.

🔴 **E2.1 — Exhausted code** — `usageCount >= usageLimit` → invalid result.

🟠 **E2.2 — Usage increments on validation, not on completed sale** —
a validated-then-abandoned checkout still consumed a use (PG1).

## R3 — Application is basket-level, not per-line

**Rule.** `BasketService.applyDiscount(code)` sets
`basket.discountCode`/`discountAmount` on the whole basket; the order +
sync payload carries it as `discounts: [{code, amount, type:'fixed_amount'}]`.

**Evidence.** `features/basket/services/BasketService.ts:70`,
`OrderSyncService.basketItemsToLineItems`/`platformOrder.discounts`.

🟠 **E3.1** — synced discount is always mapped as `fixed_amount` — a
percentage discount loses its type upstream (observed mapping — Q1).

## R4 — Loyalty/store-credit ride the discount path as pseudo-codes

**Rule.** `BasketPanel` calls `applyDiscount('LOYALTY_<amt>')` /
`applyDiscount('CREDIT_<amt>')` for ledger redemptions — observed coupling,
not an intended contract (discount/loyalty redesign is deferred).

**Evidence.** `features/basket/components/BasketPanel.tsx:422,443`.

🟠 **E4.1** — `LOYALTY_5.00` must resolve through `BasketService.applyDiscount`
— check whether these pseudo-codes bypass validation or hit the discount
table (PG2/Q2).

## R5 — Platform coverage is thin

**Rule.** Only `ShopifyDiscountService` exists in `platforms/`; other
platforms fall back to base/local behaviour — the `discounts` capability in
the matrix claims more than the adapters deliver.

**Evidence.** `shared/utils/` (single adapter),
`DiscountServiceFactory.ts`.

🔴 **E5.1** — on a platform whose matrix says `discounts: supported` but has
no adapter → falls back to local/base validation or fails — mismatch risk
(PG3).

## ❓ Open Questions

- **Q1** — Should synced `discounts[].type` preserve `percentage` vs forcing
  `fixed_amount`?
- **Q2** — How do `LOYALTY_*`/`CREDIT_*` pseudo-codes resolve in
  `BasketService.applyDiscount` — special-cased, or do they need matching rows
  in the discounts table?
- **Q3** — Who seeds the local `discounts` table on offline platforms?

## ⚠️ Potential Gaps

- **PG1** — `usageCount` increments at validation time — abandoned checkouts
  burn code uses (fraud/accuracy edge).
- **PG2** — Pseudo-code redemption path unverified end-to-end.
- **PG3** — Capability matrix claims vs single real adapter.
- **PG4** — No discount-management UI found — codes can't be administered in
  the app; offline codes must be seeded externally.
- **PG5** — `maximumDiscount` cap on percentage codes — enforcement site
  unverified (adapter vs basket totals).

## Test Coverage Mapping

| Example               | Coverage                                      |
| --------------------- | --------------------------------------------- |
| R2 local rules        | Not found (no LocalDiscountService test seen) |
| R3 basket application | `BasketService` tests cover totals partially  |

## Feature Context Summary

**Feature**: Discounts (coupons)
**Responsibility**: Code validation (platform adapter or local table) → cent
discountAmount → basket-level application → order/sync payload.

**Core rules**

- R1 Validation returns valid + cents amount + rule metadata.
- R2 Local: exist/active/minPurchase/usageLimit; success increments usage.
- R3 Basket-level application; sync maps to `fixed_amount`.
- R4 Loyalty/credit redemption shares the path via pseudo-codes (deferred
  redesign).
- R5 One real adapter (Shopify); matrix coverage exceeds implementations.

**Primary happy path**: code → valid → basket discounted → order + sync
carry it.

**Critical unhappy paths**: invalid/expired/exhausted → error; unsupported
platform → fallback/failure.

**Offline**: `LocalDiscountService` over `discounts` table — full validation
offline.

**Gaps**: usage consumed on validate not complete; pseudo-code path
unverified; no admin UI for codes.
