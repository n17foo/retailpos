# Sale Checkout — Rules

**Parent:** [rules.md](rules.md)
**Files:** `hooks/useCheckout.ts`, `services/checkout/CheckoutService.ts`,
`components/CheckoutModal.tsx`, `screens/sale/TenderBar.tsx`,
`repositories/{OrderRepository,OfflineOrderRepository}.ts`,
`utils/orderStateMapper.ts`, `services/printer/UnifiedPrinterService.ts` |
**Tests:** `CheckoutService.test.ts`

---

## R1 — Tenders are fast paths into one checkout flow

**Rule**
`TenderBar` = `CASH` / `CARD` / `⋯`: cash → cash step (exact/quick amounts +
keyboard entry on pointer); card → terminal/tap-to-pay; `⋯` → method
selector (split, store credit, loyalty). All pre-open a draft (`initialStep`)
so payment is one confirmation away.

**Evidence** — `screens/sale/TenderBar.tsx`, `hooks/useCheckout.ts:380`,
`components/CheckoutModal.tsx`; spec Phase 5.

🟢 **E1.1** — basket £12.50 → CASH → modal on cash step → `£12.50` exact or
quick-tender → paid → receipt.
🟠 **E1.2** — card unavailable (no terminal/mode) → card tender disabled.

## R2 — Draft creation is parallel and resumable; `isDraftPending` guards

**Rule**
`handleStartCheckout` reuses an open `draft|pending` order instead of
duplicating; `isDraftPending = modal open && !currentOrder` disables payment
actions until the draft exists.

**Evidence** — `hooks/useCheckout.ts:78-103,525`, `CheckoutService.startCheckout`.

🟢 **E2.1** — interrupted checkout → resume → same order id, no duplicate.
🔴 **E2.2** — double-tap tender → second call no-ops (existing order reused).

## R3 — Failed payment reverts to draft and stays retryable

**Rule**
`markPaymentProcessing` → failure → `revertToDraft(orderId)` so the order
returns to draft and checkout stays open; cancel goes `cancelOrder`
(unpaid)/`cancelDraftOrder`.

**Evidence** — `hooks/useCheckout.ts:353,359,423,481,487`,
`CheckoutService.revertToDraft:225`.

🔴 **E3.1** — terminal declines → order → `draft` + error in modal → retry.
🔴 **E3.2** — offline terminal path → same revert; order remains local.

## R4 — High-value checkout can demand manager approval

**Rule**
Totals above `posConfig` threshold gate through `ManagerApprovalService`
before payment proceeds.

**Evidence** — `hooks/useCheckout.ts` (threshold via `posConfig`),
`services/permissions/ManagerApprovalService.ts`; spec Phase 5.

## R5 — Split tender must sum to the total (cents-exact)

**Rule**
Split rows (cash/terminal/store-credit/loyalty when a customer is attached)
validate in integer cents via `utils/money.ts`; each line is removable until
the remaining balance is met.

**Evidence** — `CheckoutModal.tsx` split step, `utils/money.ts`.

🟠 **E5.1** — under-tendered → "Complete" disabled; exact sum → enabled.

## R6 — Online platforms compute tax at checkout; offline computes locally

**Rule**
Online (`native_draft`/`remote_cart`) → platform returns authoritative
tax/totals at `startCheckout` (basket shows "tax at checkout"); offline →
`OfflineTaxResolver` + `posConfig` `storeAddress` (D10).

**Evidence** — `CheckoutService`, `useSaleCatalog`/BasketPanel
`taxAtCheckout` flag, `posConfig.storeAddress`.

🟠 **E6.1** — offline + no address → local tax resolver falls back; D10
documents address as the intended destination.

## R7 — Completion prints a receipt and resets the sale

**Rule**
`completePayment` → order `paid` → receipt via `UnifiedPrinterService`
(includes `saleMode`) → post-payment reset → catalogue back to "All
Products". `syncStatus` drives `sync-pending|synced|action-required` chip.

**Evidence** — `useCheckout` success path,
`UnifiedPrinterService` (`ReceiptData.saleMode`), `utils/orderStateMapper.ts`.

📱 **E7.1 — Crash after paid** — order is `paid`+`sync-pending`; sync resumes
via `OrderSyncService` — no duplicate charge on resume.

## ❓ Questions

- **Q1** — `initialStep` for `other`/split: which step should land first
  (method vs split_tender)? Currently method.
- **Q2** — On `remote_cart` platforms, is the remote cart abandoned/cancelled
  if checkout is cancelled? (Service path — confirm.)

## Coverage

`CheckoutService` core → tested; `useCheckout` orchestration + modal → not
found.
