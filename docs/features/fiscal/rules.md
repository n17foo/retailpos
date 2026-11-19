# Fiscal — Rules

> Companion to `README.md`. Status markers use the repo convention:
> 🟢 enforced today · 🟠 partial · 🔴 gap — the implementation must
> close. The standalone module exists (`features/fiscal/`, schema v15+);
> markers reflect the standalone path, and client-mode/Store-API items
> stay marked until the server side ships.

## R1 — Exactly one fiscal authority per chain

**Rule.** The chain owner allocates `seq`/`number`/`hash` atomically —
Store API in `client` mode, the register's SQLite in `standalone`.
Registers in `client` mode never keep local counters (same rule as
ledgers and order claims: one authority, or duplicates are guaranteed).

**Evidence.** Selector pattern: `getOrderRepository()` in
`features/orders-sync/repositories/OrderRepository.ts`; config
`fiscalChainScope` (`README.md §Config`).

🟢 **E1.1** — standalone register: local chain, no network needed.
🟠 **E1.2** — `fiscalChainScope=register` in multi-register: allowed but
produces N chains — only legal where per-till numbering is accepted (Q2).
🔴 **E1.3** — client keeping a local counter in `store` scope: two tills
sell concurrently → same `seq` on the server chain → chain corrupted.
Forbidden by design (no local allocation path exists).

## R2 — Fiscalization is atomic with payment finalization

**Rule.** `finalizeSale` runs inside the same durable boundary as
`updatePayment` (the bug-4 fix). A sale is either fully fiscalized or
fully unfinalized — never a paid order without a fiscal record nor a
record without a paid order.

**Evidence.** `CheckoutService.completePayment` durable phase;
`fiscal_records` + `fiscal_chain_state` update in one transaction.

🟢 **E2.1** — crash between payment and fiscalize → recovery sees
`fiscal_status='unfinalized'` + `paid` → retries `finalizeSale`, never
re-charges (payment-recovery path from bug 5 is unchanged).
🟢 **E2.2** — fiscalize failing does **not** mark the order `failed`
after a successful charge: `completePayment` returns `success:false` +
`paymentRecorded:true`, stamps `fiscal_status='unfinalized'`, and the
queue drainer runs `reconcileUnfinalizedOrders()` to retry. The charge
is never reversed silently.

## R3 — Fiscalized records are append-only; nothing deletes or edits them

**Rule.** A `fiscalized` order cannot be deleted or have fiscal fields
mutated. Corrections are new chained records (`void`, `return`).
`OfflineOrderRepository.delete` and `CheckoutService.cancelDraftOrder`
refuse fiscalized orders (drafts remain deletable — they never got a
number).

**Evidence.** Guards at the repository boundary; `fiscal_status` CHECK
constraint.

🟢 **E3.1** — draft abandoned → deleted, no fiscal record, no gap
(numbers are allocated only at finalize — the chain has no holes).
🟢 **E3.2** — `PendingOrderStore.flush` local cleanup-delete is legal:
it runs only after the server accepted the row (bug-6 semantics).
🔴 **E3.3** — SQL-level tampering is not prevented locally, only
detectable — that's what R4 is for. On the server, the API surface has
no delete/update route for `fiscal_records`.

## R4 — The hash chain makes tampering detectable

**Rule.** `hash = SHA-256(prev_hash ‖ canonical_payload)`;
`canonical_payload` is the stable-ordered JSON of the fiscal fields
(id, seq, type, order totals, timestamps — via `FiscalCanonicalizer`,
byte-identical client and server). `verifyChain` recomputes and reports
the first divergence.

**Evidence.** `fiscal_records.prev_hash/hash`; `GET /api/fiscal/verify`.

🟢 **E4.1** — row deleted mid-chain → next `prev_hash` dangles → verify
reports the exact gap.
🟢 **E4.2** — amount edited → hash mismatch on that record and every
successor.
🟠 **E4.3** — wholesale re-chaining (recompute all hashes after a
rewrite) defeats the local chain — mitigated where the jurisdiction
requires a signed hash (`FISCAL_SIGNING_KEY`, D5) or by exporting the
chain head to an external anchor (periodic signed export, Q4).

## R5 — Sequential numbering, no gaps from abandoned drafts

**Rule.** `number = {fiscalInvoicePrefix}-{fiscalSeries}-{seq:06d}`
allocated at finalize only. Drafts, interrupted baskets, and unpaid
orders never consume a number — fiscal law forbids gaps and forbids
reusing them.

**Evidence.** Allocation inside the finalize tx; `UNIQUE(chain_id, seq)`.

🟢 **E5.1** — basket abandoned pre-payment → no number consumed.
🟠 **E5.2** — crash _inside_ the finalize tx → rolled back, number not
consumed (atomicity covers it). A crash between allocate-commit and
order-update is impossible by construction (same tx).
🟢 **E5.3** — receipt reprint shows `fiscal_number` — never
`order.id.slice(-8)` once fiscalized. The shared ESC/POS buffer prints
`data.fiscalNumber ?? data.orderId` on every printer path, including
Electron, plus the fiscal QR when supplied (`fiscalQr`).

## R6 — Multi-register: the server chains; registers display

**Rule.** Client registers call `POST /api/fiscal/finalize`; the server
returns `{number, seq, hash}`. The order row carries `fiscal_record_id`
when synced so reports can join order ↔ fiscal record. Register
attribution stays on `orders.register_id` — the chain is per-store but
each record knows its origin till.

**Evidence.** `pkg/store/fiscal.go` routes; `OrderRow.fiscal_record_id`.

🟢 **E6.1** — two tills finalize simultaneously → server serializes in
one tx each → seq 100, 101, no dup.
🟢 **E6.2** — till A voids till B's sale → allowed (manager flow), the
`void` record attributes register A, original keeps register B.

## R7 — Degraded mode: strict blocks, lenient defers

**Rule.** `fiscalStrictMode=true` → a client register cannot finalize a
paid sale while the Store API is unreachable (extends the degraded
banner/cash-only gate). `false` → finalize locally as `unfinalized`,
print "fiscalization pending", and the recovery flush calls
`finalize` — server backfills `fiscal_number`.

**Evidence.** `storeApiHealthService` degraded signal;
`PendingOrderStore` flush path; `fiscal.status='unfinalized'` state.

🟢 **E7.1** — strict: no provisional artifacts exist; nothing to
reconcile — the compliant choice where provisional receipts are illegal.
🟠 **E7.2** — lenient: the printed receipt was provisional; a
reprint-after-sync flow must exist or the paper trail diverges from the
ledger (jurisdiction-dependent — e.g. DE's fallback is a second TSE,
not a provisional receipt).

## R8 — Shift close chains a Z-record and locks the period

**Rule.** `closeShift` writes a `z_report` fiscal record (totals, order
count, first/last seq) and sets `shifts.locked_at`. Locked-shift orders
reject edits; corrections go through `return`/`void` records on top.

**Evidence.** `fiscalShiftLock` config; `shifts.locked_at`;
`DailyReportService` Z-report prints the z-record number.

🟢 **E8.1** — Z-report reprint = re-read the chained record → identical
output guaranteed (the record is immutable).
🟢 **E8.2** — `closeShift` snapshots the period totals into the
immutable `z_report` payload, marks the shift closed, and
`allocateRecord` rejects new fiscal records stamped to a closed period
or a different shift's window. `closeShift` is idempotent — a repeat
call returns the existing z-record.

## R9 — Audit log: operational vs fiscal

**Rule.** `AuditLogService` stays the operational trail (drawer, auth,
settings). The fiscal chain **is** the tamper-evident ledger for money
events — fiscal actions still emit audit events (`fiscal:finalized`,
`fiscal:voided`, `fiscal:return`, `fiscal:shift_closed`) but the legal
proof lives in `fiscal_records`, not the KV audit log.

**Evidence.** New `AuditAction` values; two-trail separation.

🟠 **E9.1** — audit `clear()` stays possible for the operational log
(space management); it cannot erase fiscal proof because it doesn't hold
any.

## R10 — Authority work happens in adapters, after the chain record

**Rule.** `finalizeSale` always produces the same artifact (number +
chain record). Jurisdiction-specific obligations — AEAT registro + QR
(ES), corrispettivi route (IT), TSE signing (DE), closure/archive
records (FR), record-keeping only (UK/IE/NL/BE/`generic`) — live in
`FiscalAuthorityAdapter` implementations selected by
`fiscalJurisdiction`, never inside the chain logic. Authority submission
results land in `fiscal_transmissions`, not on the record itself
(except returned identifiers like the TSE signature). `generic` maps to
`NullAuthorityAdapter`, which performs **no** authority actions — a
plain chain, no transmissions, no receipt extras.

**Evidence.** `authorities/` adapters in the service tree;
`fiscal_transmissions` outbox.

🟢 **E10.1** — UK merchant → `UkAuthorityAdapter` is a no-op; chain +
sequential VAT number already satisfies the legal minimum. IE/NL/BE
(retail) → `RecordOnlyAuthorityAdapter`, the same profile — IE's only
extra legal wrinkle is the 6-year electronic record retention, which the
chain already exceeds.
🟢 **E10.2** — ES record-only mode → `EsVerifactuAdapter` builds the
registro XML, verifies the _previous_ record's hash at generate time
(RRSIF obligation for non-verifiable systems) and emits `registros de
evento`; VERI\*FACTU mode adds AEAT submission via the outbox.
🟠 **E10.3** — DE adapter asks the cloud TSE to sign at finalize — a
slow TSE response delays tender close; bound it with a timeout, and the
BMF-sanctioned fallback is a _second_ TSE (e.g. local USB), not an
unsigned sale.
🔴 **E10.4** — IT cannot be satisfied in code alone — the adapter wraps
an approved Soluzione Software / RT device integration (Q-IT); shipping
IT without that partner is a compliance gap, not a bug.
🟠 **E10.5** — FR needs no runtime calls at all (`FrNf525Adapter` only
records closures/archives), but the **product** must pass the LNE/NF525
audit before FR merchants can legally run it — compliance is a process
gate on the release, not a code path.

## Open questions

- **Q1** — PrestaShop invoicing: does PS9 allow suppressing its own
  invoice for externally-invoiced orders, or does an in-store sale
  synced up create a second legal invoice? Check
  `order.invoice_number`/`order_invoice` handling before wiring D1.
- **Q-IT** — Italy route: approved Soluzione Software partner
  (MF1/PEM spec v1.1) vs certified RT-device bridge vs AdE web
  procedure? The adapter contract is designed for either.
- **Q-DE** — which BSI-certified cloud TSE (fiskaly SIGN DE,
  fiskaltrust, Swissbit…), and do we stock a local USB TSE as the BMF
  fallback for cloud outage?
- **Q-BE** — BE is record-only for retail, but horeca/catering merchants
  over €25k food turnover need **GKS 2.0** (certified till + FDM black
  box, LAN-connected). Scope decision: is a horeca merchant running
  RetailPOS in Belgium in or out?
- **Q-FR** — LNE vs Infocert NF525 for the product audit; schedule it so
  the audited code matches the released build, and budget for annual
  follow-up audits.
- **Q-ES** — VERI\*FACTU (transmit) vs record-only per merchant —
  record-only adds previous-hash verification + `registros de evento`;
  which do we default to for ES onboarding?
- **Q4** — external anchoring: export/print the daily chain head hash on
  the Z-report? Cheap tamper amplification for `generic` mode.
- **Q5** — retention/export formats: UK MTD digital-records scope
  (VAT returns are per-return, out of scope for per-sale), ES SII,
  and jurisdiction archive exports — in this module or reporting?
