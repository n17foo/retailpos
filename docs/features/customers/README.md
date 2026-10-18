# Customers (Search, Profile, Loyalty & Store Credit)

## Purpose

Attach platform or local customers to a sale, browse their profile
(purchase history, loyalty points, store credit), and manage the two
customer money ledgers: **loyalty points** and **store credit** — both
append-only SQLite ledgers with audit logging. Online platforms provide
customer search via adapters; `LocalCustomerService` backs offline mode.

## Scope

### Included

- `CustomersScreen` — searchable customer list (platform adapters).
- `useCustomerSearch` — 300ms-debounced, paginated platform search;
  `isAvailable` gates on platform capability.
- `CustomerProfileScreen` — purchase history, loyalty balance, store-credit
  balance, editable local fields (name/phone/notes/segment), issue loyalty
  points, issue store credit.
- Basket attach — customer badge in `BasketPanel` → `setCustomer(email,name)`;
  `customer-required` blocker opens the picker modal.
- `LoyaltyService` — points ledger (earn/redeem/adjust with reason).
- `StoreCreditService` — issue/redeem/expire/balance in **cents**, append-only
  entries, clamped redemption, audit events.

### Excluded

- Coupon/discount validation — **discounts** feature.
- Sale-time application of loyalty/credit as tender — checkout
  (plumbing retained; redesign deferred).
- Customer creation on platforms — POS consumes; does not push new customers
  upstream (interface exposes search only).

## Entry Points

- **More → Customers** — list → `CustomerProfile` (by email).
- **Sale → customer badge/selector** — `BasketPanel` customer modal; the
  `customer-required` blocker auto-opens it.
- **Checkout tender** — loyalty/store-credit tender paths consume the ledgers
  (checkout feature).
- **Profile actions** — adjust loyalty ±, issue credit.

## Feature Flow

```
Sale → customer icon → useCustomerSearch (300ms debounce, page-by-page)
   → tap customer → setCustomer(email, name) → basket.customerEmail
   → 'customer-required' blocker clears

More → Customers → row → CustomerProfileScreen(email)
   → useCustomerProfile → customer + orderHistory + loyaltyBalance
     + storeCreditDollars
   → adjust loyalty: delta + reason → loyaltyService.adjust → ledger+audit
   → issue credit: amount + reason → storeCreditService.issue → ledger+audit

Checkout tender (store_credit):
   redeem(email, requestedCents) → min(requested, balance)
   → appendEntry('redeem', -cents) → audit 'store_credit:redeemed'
```

## Implementation Map

| Layer        | Responsibility                                | Implementation                                                                                                        |
| ------------ | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Screens      | List + profile                                | `features/customers/screens/{CustomersScreen,CustomerProfileScreen}.tsx`                                              |
| Components   | Sale attach UI                                | `features/basket/components/BasketPanel.tsx` (customer modal, badge)                                                  |
| Hooks        | Search debounce/pagination, profile aggregate | `features/customers/hooks/{useCustomerSearch,useCustomerProfile}.ts`                                                  |
| Services     | Search adapters + factory                     | `features/customers/services/customer/{CustomerServiceFactory,LocalCustomerService,platforms/*}`                      |
| Services     | Ledgers                                       | `features/customers/services/loyalty/LoyaltyService.ts`, `features/customers/services/customer/StoreCreditService.ts` |
| Repositories | Ledger entries, local customers               | `features/customers/repositories/*` (store-credit entries, local customer table)                                      |
| Libs         | Capability gating                             | `shared/utils/platformCapabilities.ts` (`customers` key)                                                              |

## State Ownership

| State               | Owner                          | Persistence                  | Reset condition       |
| ------------------- | ------------------------------ | ---------------------------- | --------------------- |
| Search results/page | `useCustomerSearch`            | None                         | `clear()` / new query |
| Attached customer   | Basket (persisted)             | SQLite basket row            | Sale completion/clear |
| Loyalty balance     | `LoyaltyService`               | SQLite ledger (append-only)  | Never — derived       |
| Store credit        | `StoreCreditService`           | SQLite entries (append-only) | Never — derived       |
| Profile fields      | `CustomerProfileScreen` → repo | SQLite                       | User edit             |

## Dependencies

- `platformCapabilities.customers` — `isAvailable` gates search UI.
- `shared/services/audit` — `store_credit:redeemed` and ledger mutations audited.
- `shared/utils/money.ts` — credit ledger is cents-based.
- Basket context — `setCustomer` lives there.

## Side Effects

- Platform customer-search API calls (debounced).
- Append-only ledger rows + audit events on loyalty/credit mutations.
- Basket mutation (`customerEmail`, `customerName`) persisted.
- Redemption clamps silently to available balance — the charged amount can be
  less than requested.
