# Order Domain Rules

**Files:** `features/orders-sync/utils/orderRow.utils.ts`, `features/checkout/utils/orderStateMapper.ts`,
`features/orders-sync/utils/orderHistory.utils.ts`
**Tests:** `orderRow.utils.test.ts`, `orderHistory.utils.test.ts`
(orderStateMapper has none) | **Docs:** sales UX spec §2.2
**Parent:** [`rules.md`](rules.md)

---

## O-R1 — `OrderRow + items → OrderWithItems` is a straight field mapping

**Rule**
`rowToOrder` flattens the DB row into the view shape; `sale_mode`,
`sync_status`, `payment_method`, `customer_name`, `cashier_name` map 1:1;
`created_at` → `Date`.

**Evidence** — `features/orders-sync/utils/orderRow.utils.ts`; consumed by `features/orders-sync/hooks/useOrders.ts`
(order-history path).

🟠 **E1.1** — `sale_mode` added in schema v11 flows through unchanged; old
rows → `null`.

## O-R2 — Technical order state maps to a user-facing sale state

**Rule**
`getUserFacingSaleState(items, order, blockers, isProcessing)` precedence:

1. empty basket + no order → `empty`
2. order `failed` → `payment-failed`
3. order `processing` or `isProcessing` → `processing-payment`
4. order `paid` → `synced` | `action-required` (sync failed) | `sync-pending`
5. order `draft`/`pending` → `ready-for-payment`
6. items + blockers → `needs-attention`; items alone → `building`

`getSaleStateInfo` supplies label/colour/bg per state.

**Evidence** — `features/checkout/utils/orderStateMapper.ts`; consumed by `TopBar` (state chip).

🟢 **E2.1** — draft order → top bar shows "Ready" (green).

🟠 **E2.2 — Dead states** — the union includes `preparing-checkout` and `paid`
but the function never returns them (PG1). Their `SaleStateInfo`/
icon entries are unreachable — either dead code or a missing transition.

🔴 **E2.3 — Hardcoded colours** — state colours are literal hex, not theme
tokens (C3).

🟠 **E2.4** — `isProcessing` alone (no order yet) does not yield
`processing-payment` unless an order exists — during draft creation the state
stays `building`/`ready-for-payment`.

## O-R3 — Order-history day navigation is role-gated and local-midnight based

**Rule**
`getDayStart/End(daysOffset)` = device-local midnight boundaries;
`canNavigatePrev`/`canNavigateNext` → **cashiers are locked to today**
(`false` always); non-cashiers go back freely and forward only to `offset<0`
(can't view the future).

**Evidence** — `features/orders-sync/utils/orderHistory.utils.ts`, test; consumed by
`useOrderHistory` → OrderHistory screen.

🟢 **E3.1** — cashier opens OrderHistory → today only, arrows disabled.

🟠 **E3.2 — Timezone/DST** — boundaries use `Date` local time; DST-shifted
midnights and timezone travel move "today" (PG8).

## ❓ Questions

- **O-Q1** — Were `preparing-checkout`/`paid` states dropped during the sale
  redesign, or should `getUserFacingSaleState` produce them (e.g. during
  `startCheckout` before the order becomes `pending`)?
- **O-Q2** — Should state colours move into theme tokens per parent rule R3?

## Coverage

| Example            | Coverage                     |
| ------------------ | ---------------------------- |
| O-R1 mapping       | `orderRow.utils.test.ts`     |
| O-R3 day nav       | `orderHistory.utils.test.ts` |
| O-R2 state mapping | Not found                    |
