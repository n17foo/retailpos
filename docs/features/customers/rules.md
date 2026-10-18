# Customers — Rules

## R1 — The POS searches customers; it does not create them upstream

**Rule.** `CustomerServiceInterface` exposes `searchCustomers(options)` only —
`PlatformCustomer` records are read models of platform customers (or local
customers on OFFLINE). No create/update push to the platform.

**Evidence.** `features/customers/services/customer/CustomerServiceInterface.ts` ("The POS
consumes customers — it does not create them locally" [upstream]),
`platforms/*`, `LocalCustomerService.ts`.

🟢 **E1.1** — search "smith" → platform adapter returns `PlatformCustomer[]`
with email, name, tags, orderCount, totalSpent.

🟠 **E1.2 — Capability gating** — `isAvailable` false (platform lacks
`customers` capability) → search UI should not offer platform search;
`LocalCustomerService` still serves offline.

## R2 — Search is debounced and paginated

**Rule.** `useCustomerSearch` waits 300ms after the last keystroke, returns
paged results; `loadMore()` appends the next page, `hasMore` tracks it.

**Evidence.** `features/customers/hooks/useCustomerSearch.ts:26-128`.

🟢 **E2.1** — type "mar" → one API call after 300ms idle → first page renders.

🟠 **E2.2 — Rapid typing** — intermediate queries are superseded; only the
final query's page-1 replaces `customers`.

🔴 **E2.3 — Search error** — `'Failed to search customers. Please try again.'`;
existing results stay until `clear()`/new search.

## R3 — Attaching a customer mutates the basket, and a blocker can require it

**Rule.** Selecting a customer calls `setCustomer(email, name||email)` →
`basket.customerEmail`/`customerName`. A `customer-required` blocker (e.g.
loyalty tender without a customer) auto-opens the picker and blocks checkout
until resolved.

**Evidence.** `features/basket/components/BasketPanel.tsx:131-154`, checkout blockers
(checkout doc).

🟢 **E3.1** — pick "Jane" → badge shows name/email; checkout blocker clears.

🔴 **E3.2 — Required but missing** — blocker stays; tapping it opens the modal.

## R4 — Store credit is an append-only cents ledger with clamped redemption

**Rule.** `StoreCreditService.redeem(email, requestedCents)` redeems
`min(requested, balance)` — never overdraws. `redeemedCents <= 0` → throw
`'Insufficient store credit balance'`. Every entry appends
(`issue|redeem|expire`) and audits.

**Evidence.** `features/customers/services/customer/StoreCreditService.ts:73-88`.

🟢 **E4.1 — Partial redemption**
Balance £5, request £8 → charges £5 (clamped); `discountDollars` reflects £5 —
checkout must reconcile the remainder with another tender.

🔴 **E4.2 — Zero/negative balance**
Request with no balance → throws; tender cannot proceed.

🟠 **E4.3 — Silent clamp**
Caller sees `redeemedCents` — must compare with requested; UI should surface
the shortfall rather than assume full coverage.

## R5 — Loyalty points are a separate ledger adjusted with a reason

**Rule.** Loyalty delta + reason required for manual adjustments on the
profile screen; earn/redeem flows run through `LoyaltyService`.

**Evidence.** `features/customers/screens/CustomerProfileScreen.tsx:47-90`,
`features/customers/services/loyalty/LoyaltyService.ts`.

🟢 **E5.1** — manager enters `+50` + "goodwill" → balance updates + audit row.

🟠 **E5.2** — `parseInt(loyaltyDelta)` — non-numeric input → NaN path; verify
input validation rejects it (PG2).

## R6 — Profile is an aggregate read over several stores

**Rule.** `useCustomerProfile(email)` composes customer record + order history

- loyalty balance + store-credit balance — one reloadable unit.

**Evidence.** `features/customers/hooks/useCustomerProfile.ts`,
`features/customers/screens/CustomerProfileScreen.tsx:36`.

🟠 **E6.1** — any leg failing leaves `isLoading`/partial state — observe which
sections render empty vs error (PG3).

## R7 — Local profile fields exist alongside platform identity

**Rule.** Editable fields (name/phone/notes/segment) are local annotations —
platform customer fields (email, totals) come from the platform record.

**Evidence.** `CustomerProfileScreen` header comment.

🟠 **E7.1** — editing notes never reaches the platform — a platform-side view
won't see them (by design; POS-local CRM).

## ❓ Open Questions

- **Q1** — Loyalty earn rules (points per currency unit) — configured where?
  `posConfig.values` or hardcoded in `LoyaltyService`?
- **Q2** — Store credit `expire` — is expiry scheduled anywhere, or only a
  manual/manager action?
- **Q3** — Multi-register: are loyalty/credit ledgers replicated to the server
  register, or per-device only? (instoreapi doc).

## ⚠️ Potential Gaps

- **PG1** — Silent redemption clamp (E4.3): if the tender flow doesn't surface
  the shortfall, the cashier can think full credit was applied.
- **PG2** — `parseInt` NaN on loyalty delta input — validation unknown.
- **PG3** — Aggregate profile: partial leg failure rendering unverified.
- **PG4** — Ledger correctness depends on append-only discipline — a missed
  entry or direct table edit corrupts balances; no reconciliation exists.
- **PG5** — Platform search results have no local cache: offline on an online
  platform → no customer lookup at all (capability `isAvailable` still true —
  calls just fail).
- ~~**PG6**~~ **RESOLVED** — `LoyaltyExpiryJob` was never `start()`ed. Now
  started in `App.tsx` alongside `backgroundSyncService`/`queueManager` and
  stopped on teardown. It runs on foreground transitions via `runIfDue()`
  (persisted `loyalty:lastExpiryRun`, 24h interval) and no-ops when
  `expiryDays` is unset.

## Test Coverage Mapping

| Example             | Coverage                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| R1 factory/adapters | `customerServiceFactory.test.ts`, per-platform `*CustomerService.test.ts` |
| R2 search           | Not found                                                                 |
| R4 redeem clamp     | Not found (StoreCreditService has no dedicated test seen)                 |

## Feature Context Summary

**Feature**: Customers, loyalty & store credit
**Responsibility**: Platform/local customer search → attach to basket; profile
with history; two append-only ledgers (loyalty points, store credit cents)
with audit.

**Core rules**

- R1 Read-only platform customers (no upstream create).
- R2 300ms debounce + pagination.
- R3 Attach mutates basket; `customer-required` blocker enforces it.
- R4 Credit redemption clamps to balance; append-only + audit.
- R5 Loyalty adjusts need delta + reason.
- R6 Profile aggregates customer + history + balances.
- R7 Profile edits are POS-local annotations.

**Primary happy path**: search → attach → checkout with customer;
profile → issue credit → redeem at tender.

**Critical unhappy paths**: insufficient credit → throw or silent clamp;
platform search fails → error message; no customer when required → checkout
blocked.

**Offline**: `LocalCustomerService` + SQLite ledgers work fully offline;
platform search degrades to failure (no cache).

**Gaps**: silent clamp surfacing; NaN guard; ledger reconciliation; no
search-result cache.
