# Returns, Refunds & Exchanges — Rules

## R1 — Only paid orders can be returned

**Rule.** `validateReturnRequest` rejects unless `orderStatus` is `paid` (or
`synced`): `'Order must be paid before processing a return'`.

**Evidence.** `services/refunds/returnValidation.ts`.

🔴 **E1.1** — draft/pending/processing order → validation error, no return row.

## R2 — Return quantities are capped per line by what remains returnable

**Rule.** Quantities must be positive integers ≤ `orderItem.qty − prior
pending/completed/approved returns` for that line. `pending` rows reserve
quantity so concurrent returns can't double-submit; the reservation releases
when the row is rejected or deleted. Cumulative refund amount ≤ order total.
≤200 lines per request.

**Evidence.** `services/refunds/returnValidation.ts` (`MAX_RETURN_LINES`,
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

**Evidence.** `services/refunds/RefundService.ts:154-215`, `platforms/*`.

🟢 **E3.1 — Local + push**
Validate → rows → adapter refund → `platformRefundId` stored → completed.

🟠 **E3.2 — Platform refund fails** — return rows exist; check whether status
stays pre-completed or the whole call errors (verify PG1).

📴 **E3.3 — Offline** — `OfflineRefundService` records the refund locally; no
upstream call.

## R4 — Exchange = return credit vs new basket, settled by net payment

**Rule.** `ExchangeService.createSession(originalOrderId, returnItems)` →
`returnCredit`; `newItems` → `newItemsTotal`; `netDue = new − credit`
(negative ⇒ store owes customer); `payments[]` reduce `remainingDue`.
Confirm writes returns (linked to the exchange) + creates the new order via
`CheckoutService` + audits `exchange:completed`.

**Evidence.** `services/exchange/ExchangeService.ts` (`calcTotals`, confirm).

🟢 **E4.1 — Even swap** — netDue 0 → confirm with no payment → new order +
returns recorded.

🟢 **E4.2 — Customer owes** — new items cost more → collect payments until
`remainingDue ≤ 0` → confirm.

🟠 **E4.3 — Store owes** — netDue negative → the flow must issue a refund/
credit (verify how negative remaining is settled — PG2/Q1).

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

**Evidence.** `services/refunds/RefundService.ts` `RefundRecord`.

🟠 **E6.1** — terminal-source refunds exist independent of returns — the
service supports standalone payment refunds (e.g. `refundTransaction`).

## ❓ Open Questions

- **Q1** — Negative `netDue` settlement: cash back / store credit / platform
  refund — which path does the exchange flow take when the store owes the
  customer?
- **Q2** — `pending` returns: who approves (manager approval flow via
  `PermissionService`/`ManagerApprovalService`)? Screens don't obviously show
  an approval step.
- **Q3** — `restock` on OFFLINE — does it bump `OfflineInventoryService`
  quantities?

## ⚠️ Potential Gaps

- **PG1** — Platform-refund failure after local rows are written: unclear
  whether the whole `processReturn` rolls back or leaves `pending` rows with
  a half-done refund.
- **PG2** — Negative `netDue` (store owes) settlement path unverified.
- **PG3 — resolved** — Exchange confirm runs a compensating saga (E4.4): on
  new-order/payment failure the created return rows are deleted; link failure
  is non-fatal. Residual: a mid-confirm crash can still orphan rows — no
  write-ahead recovery.
- **PG4 — resolved** — `pending` returns now reserve quantity (E2.3) and
  validate-then-write is serialised per order (E2.4), closing the
  double-return race.
- **PG5** — Refund amount per line is caller-supplied (`refundAmount` in the
  request) — validation caps the total but per-line pricing fidelity (did the
  line actually sell for that?) isn't obviously enforced.

## Test Coverage Mapping

| Example          | Coverage                                                     |
| ---------------- | ------------------------------------------------------------ |
| R1/R2 validation | `services/refunds/returnValidation.test.ts`                  |
| R3 return flow   | `RefundService.integration.test.ts`, `ReturnService.test.ts` |
| R4 exchange      | Not found for ExchangeService                                |

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
rejected; platform refund failure leaves partial state (PG1); exchange
partial-confirm compensated by saga (E4.4).

**Offline**: `OfflineRefundService` records locally; platform push skipped.

**Gaps**: per-line price fidelity unverified; a mid-confirm crash can still
orphan exchange writes; a stuck `pending` row blocks its line until cleaned up.
