# Returns, Refunds & Exchanges — Rules

## R1 — Only paid orders can be returned

**Rule.** `validateReturnRequest` rejects unless `orderStatus` is `paid` (or
`synced`): `'Order must be paid before processing a return'`.

**Evidence.** `features/returns/services/refunds/returnValidation.ts`.

🔴 **E1.1** — draft/pending/processing order → validation error, no return row.

## R2 — Return quantities are capped per line by what remains returnable

**Rule.** Quantities must be positive integers ≤ `orderItem.qty − prior
pending/completed/approved returns` for that line. `pending` rows reserve
quantity so concurrent returns can't double-submit; the reservation releases
when the row is rejected or deleted. Cumulative refund amount ≤ order total.
≤200 lines per request.

**Evidence.** `features/returns/services/refunds/returnValidation.ts` (`MAX_RETURN_LINES`,
`COUNTED_RETURN_STATUSES`).

🔴 **E2.1 — Double-return** — 2 of 3 already returned → requesting 2 more fails
(only 1 remains).

🔴 **E2.2 — Over-refund** — refund amounts summing past order total → error.

🟠 **E2.3 — Pending reserves, rejected frees** — a pending return holds its
quantity against the line; rejection releases it. A row stuck in `pending`
(e.g. crash between insert and status update) blocks the line until cleaned
up — conservative by design.

🟠 **E2.4 — Concurrent returns serialise** — validate-then-write runs under a
per-order keyed lock (`withKeyedLock`) in both `ReturnService.processReturn`
and the LAN `POST /api/returns` route, so two in-flight requests can't both
validate against the same remaining quantity.

## R3 — Returns record locally first; platform refund is optional

**Rule.** `processReturn` writes `returns` rows then, if `issueRefund`, calls
the platform's refund adapter (or `OfflineRefundService`). `restock` flags
restore inventory. Rows transition pending → approved/rejected → completed.

**Evidence.** `features/returns/services/refunds/RefundService.ts:154-215`, `platforms/*`.

🟢 **E3.1 — Local + push**
Validate → rows → adapter refund → `platformRefundId` stored → completed.

🟠 **E3.2 — Platform refund fails** — return rows persist with
`refund_status='failed'` (or `'pending'` on a timeout/unknown outcome) and
`refund_id` as the durable intent; the call reports `success:false` with the
returns still recorded. `retryFailedRefund()` resumes the monetary leg — it
is idempotent per refund id.

📴 **E3.3 — Offline** — `OfflineRefundService` records the refund locally; no
upstream call.

## R4 — Exchange = return credit vs new basket, settled by net payment

**Rule.** `ExchangeService.createSession(originalOrderId, returnItems)` →
`returnCredit`; `newItems` → `newItemsTotal`; `netDue = new − credit`
(negative ⇒ store owes customer); `payments[]` reduce `remainingDue`.
Confirm requires the `exchange:process` permission evaluated against the
approving user's id (manager approval flows supply the approver's PIN), then
writes returns (linked to the exchange) + creates the new order from the
session's items via `CheckoutService` + audits `exchange:completed`. A
negative remaining due settles as a refund of the return credit — never as
a marked-paid order with no tender.

**Evidence.** `features/returns/services/exchange/ExchangeService.ts` (`calcTotals`, confirm).

🟢 **E4.1 — Even swap** — netDue 0 → confirm with no payment → new order +
returns recorded.

🟢 **E4.2 — Customer owes** — new items cost more → collect payments until
`remainingDue ≤ 0` → confirm.

🟢 **E4.3 — Store owes** — netDue negative → the confirm path routes the
return credit through `RefundService.processRefund` (per-line caps apply);
the new order is never marked paid without real tender.

� **E4.4 — Partial confirm failure** — new-order creation/payment fails after
returns written → the created return records are deleted as compensation
(saga-style; `returnRepo.delete`), so the original order isn't left
half-exchanged. Return→order _link_ failures are non-fatal.

## R5 — Server-side validation applies to LAN clients too

**Rule.** Validation lives in the service layer (`validateReturnRequest`),
explicitly to guard against "the UI or LAN clients" — multi-register posts go
through the same checks.

**Evidence.** `returnValidation.ts` header comment.

🟢 **E5.1** — a client register POSTing a bogus return hits the same
validation errors a local cashier would.

## R6 — Refund records carry source and status

**Rule.** `RefundRecord{source: 'ecommerce'|'payment_terminal', status:
'pending'|'completed'|'failed'}` — money movement provenance is tracked per
refund.

**Evidence.** `features/returns/services/refunds/RefundService.ts` `RefundRecord`.

🟠 **E6.1** — terminal-source refunds exist independent of returns — the
service supports standalone payment refunds (e.g. `refundTransaction`).

## ❓ Open Questions

- ~~**Q1**~~ Resolved — negative `netDue` settles through
  `RefundService.processRefund` as a refund of the return credit (E4.3);
  the exchange cannot produce a paid order with no tender.
- **Q2** — `pending` returns: who approves (manager approval flow via
  `PermissionService`/`ManagerApprovalService`)? Screens don't obviously show
  an approval step.
- **Q3** — `restock` on OFFLINE — does it bump `OfflineInventoryService`
  quantities?

## ⚠️ Potential Gaps

- ~~**PG1**~~ **RESOLVED** — the refund leg is durable: `returns.refund_status`
  - `returns.refund_id` (schema v17) record the intent before the provider
    call; a failure leaves a retryable `pending`/`failed` state that
    `retryFailedRefund()` resumes, and `processReturn` reports
    `success:false` until the refund is done.
- ~~**PG2**~~ **RESOLVED** — negative `netDue` (store owes) settles via
  `RefundService.processRefund` (E4.3, Q1).
- **PG3 — resolved** — Exchange confirm runs a compensating saga (E4.4): on
  new-order/payment failure the created return rows are deleted; link failure
  is non-fatal. Residual: a mid-confirm crash can still orphan rows — no
  write-ahead recovery.
- **PG4 — resolved** — `pending` returns now reserve quantity (E2.3) and
  validate-then-write is serialised per order (E2.4), closing the
  double-return race.
- ~~**PG5**~~ **RESOLVED** — refund amounts are bound to what each line was
  actually paid: `returnValidation` computes a per-line refundable cap from
  `price` + `tax_rate` with the order-level discount allocated across lines,
  minus prior refunds. `processRefund` re-validates against the cap and
  routes every refund type (including payment-terminal refunds) through the
  provider's real refund call.

## Test Coverage Mapping

| Example          | Coverage                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| R1/R2 validation | `features/returns/services/refunds/returnValidation.test.ts` (incl. per-line cap + discount allocation) |
| R3 return flow   | `RefundService.integration.test.ts` (incl. durable-refund retry), `ReturnService.test.ts`               |
| R4 exchange      | `features/returns/services/exchange/ExchangeService.test.ts` (permission, tender settlement)            |

## Feature Context Summary

**Feature**: Returns, refunds, exchanges
**Responsibility**: Validated returns against paid orders (local-first,
optional platform refund + restock), standalone refunds, and exchange sessions
that net out credit vs new items and produce a new order.

**Core rules**

- R1 Paid-only returns.
- R2 Per-line returnable caps + cumulative ≤ order total + ≤200 lines.
- R3 Local rows first, optional platform refund, restock flag.
- R4 Exchange: netDue = new − credit; payments settle; confirm writes both
  sides.
- R5 Same validation for LAN clients.
- R6 Refunds track source + status.

**Primary happy path**: paid order → select lines → validate → return rows →
platform refund → completed.

**Critical unhappy paths**: unpaid order rejected; over-quantity/over-amount
rejected; platform refund failure leaves a durable retryable refund intent
(E3.2); exchange partial-confirm compensated by saga (E4.4).

**Offline**: `OfflineRefundService` records locally; platform push skipped.

**Gaps**: a mid-confirm crash can still orphan exchange writes; a stuck
`pending` row blocks its line until cleaned up.
