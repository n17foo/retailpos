# Fiscal Bug And Security Review

Date: 2026-11-19  
Reviewed revision: `909c2ee` (`main`)  
Status: findings documented; application code not modified

## Scope And Method

This is a focused review of the newly merged fiscal module and its checkout,
return, order-history, database, receipt, and shift-close integrations. Secret
storage, authentication/approval, LAN configuration, and Electron security
boundaries were also sampled for context. This is not a whole-repository
security audit, penetration test, dependency vulnerability scan, or fiscal
certification.

Findings below describe this register repository. The separate in-store server
repository was unavailable; no claim is made about its validation, transactions,
fiscal adapters, or recovery behavior. Authority requests were mocked, not sent
to AEAT or fiskaly. No real credentials or merchant data were used.

Severity: P1 = high-priority financial integrity, security, or fiscal processing
defect when the affected feature is enabled; P2 = medium-priority correctness or
input-handling defect. Severity is not a CVSS rating. All findings remain open.

## Findings

### F01 - P1 - Ledger verification accepts metadata tampering and tail deletion

Category: security / financial integrity  
Evidence: `features/fiscal/services/OfflineFiscalService.ts:120-148,261-275`

`verifyChain()` checks only `prev_hash` and the hash of `payload_json`. It does
not compare the immutable fields inside that JSON with the relational columns
that `mapRow()` actually returns, check sequence continuity, or compare the
last surviving record with `fiscal_chain_state`.

Reproduced against in-memory SQLite:

1. Finalize a sale, then run
   `UPDATE fiscal_records SET number = 'FORGED', order_id = 'other-order'`.
2. `getRecord('other-order')` returns number `FORGED`, while `verifyChain()`
   returns `{ ok: true, checked: 1 }`.
3. In a fresh two-sale chain, delete the record with `seq = 2`, leaving the
   chain head untouched. Verification again returns `{ ok: true, checked: 1 }`.

Impact: an actor with database-write access, or an accidental write bug, can
alter invoice identity/linkage or remove the latest financial event without
the advertised verifier detecting it. This does not require recomputing hashes.
It is not a demonstrated remote database-write exploit.

Recommendation: validate every duplicated ledger field against its hashed
payload, enforce contiguous sequence numbers, and reconcile the verified tail
with the stored head, including the empty-ledger case. A separately protected
checkpoint/signature is still needed against coordinated ledger-and-head
rewrites; an unkeyed local chain alone cannot prevent those.

### F02 - P1 - A return overwrites the original sale's invoice identity

Category: financial correctness  
Evidence: `features/fiscal/services/OfflineFiscalService.ts:96-106,224-231`

`registerReturn()` passes the original `orderId` into `allocateRecord()`.
The allocator updates the order's `fiscal_record_id` and `fiscal_number` for
every record with an order ID, not just sale finalization.

Reproduced: finalize a sale, record its number and record ID, then register a
return. Both order fields now identify the return record. `getRecord(orderId)`
still selects the sale, so the two read paths disagree.

Impact: order-history reprints use the correction number as if it were the
original sales invoice. Multiple partial returns replace that identity
repeatedly.

Recommendation: retain the original sale linkage permanently. Link corrections
through their own return/void records; a void may update the order's fiscal
status without replacing the original invoice identity.

### F03 - P1 - Authority work can be lost permanently after ledger commit

Category: durability / fiscal processing  
Evidence: `features/fiscal/services/OfflineFiscalService.ts:53-58,64-74,245-258`;
`features/fiscal/services/authorities/EsVerifactuAdapter.ts:22-29,48-51`

The fiscal record commits before `adapter.onRecord()` creates the transmission.
Any adapter exception is swallowed, with no durable task to retry. Subsequent
sale finalization returns the existing record before invoking the adapter.

Reproduced: enable ES transmit mode with an empty NIF, then finalize a paid
sale. The order becomes `fiscalized`, but there are no transmission rows.
Configure the NIF and retry finalization: there are still no transmission rows.
A crash between allocation and enqueue has the same durability gap.

Impact: the drainer cannot retry work that was never inserted, so the sale can
remain permanently absent from authority submissions despite being marked
fiscalized.

Recommendation: atomically persist a unique authority-work intent with the
ledger record. Build/submit its payload through a retryable worker, or perform
payload construction and outbox insertion inside the allocation transaction.
Make repair/idempotent finalization detect missing work without duplicating it.

### F04 - P1 - Strict checkout is not enforced and failed fiscalization has no recovery queue

Category: checkout / durability  
Evidence: `features/checkout/services/CheckoutService.ts:259-286,325-344,375-391`;
`features/checkout/hooks/useCheckout.ts:363-414`;
`features/checkout/hooks/useInterruptionRecovery.ts:35-86`;
`features/multi-register/services/offline/PendingOrderStore.ts:155-210`

`fiscalStrictMode` is declared and persisted but is not read by any runtime
enforcement code. Checkout records payment, catches fiscalization failure,
clears the basket, and returns success. The UI can then print a receipt with
the UUID fallback. There is no durable fiscal-finalization retry queue or
startup scan for paid-but-unfiscalized orders; the transmission drainer only
handles records that already have outbox rows.

Static trace: a client checkout during a LAN outage can queue its payment
locally, fail the fiscal API call, and still complete successfully regardless
of the strict setting. Standalone unsupported-jurisdiction failures are also
reduced to checkout warnings. A repository-wide search found no consumers of
`fiscalStrictMode` beyond its config declaration/mapping.

Impact: strict deployments can issue unfiscalized receipts, and a crash or
temporary failure after payment can strand a paid sale without a fiscal record.
Order upload/platform-sync recovery does not explicitly repair that state.
The separate server might add safeguards, but this client does not enforce
the promised policy.

Recommendation: preflight fiscal readiness before taking tender, enforce the
strict policy on all tender paths, and durably queue finalization/reconciliation
after confirmed payment. Never undo the recorded payment or ask the customer
to pay again merely because fiscal work failed.

### F05 - P1 - The TSE transport never completes the signing transaction

Category: fiscal processing  
Evidence: `features/fiscal/services/transports/FiskalyTseTransport.ts:24-51`;
`features/fiscal/services/authorities/DeTseAdapter.ts:18-20`;
`features/fiscal/services/FiscalTransmissionDrainer.ts:76-82`

The only transaction request sends `state: 'ACTIVE'`. There is no subsequent
`FINISHED` request, signature validation, or receipt-artifact construction.
Any HTTP-success response is returned to the drainer, which marks the work
sent. Payment and VAT classifications are also hardcoded to cash and normal
VAT even when the sale records a different tender/tax treatment.

Reproduced with mocked fetch: one authentication request and one `ACTIVE`
request exhaust the entire submission flow; an `{"state":"ACTIVE"}` response
is accepted as success. No finishing request occurs.

Impact: a transaction is treated as signed/submitted without reaching its
completed signing state. DE checkout returns before the outbox is processed,
and this adapter never returns a signature/QR for the receipt.

Recommendation: implement and validate the vendor's complete transaction
lifecycle, including revisions, stable client identity, actual payment/VAT
breakdowns, completed-state/signature checks, and receipt artifacts. Enforce
the configured strict/fallback policy at tender close.

### F06 - P1 - AEAT business rejections are marked successfully sent

Category: fiscal processing / data loss  
Evidence: `features/fiscal/services/transports/AeatVerifactuTransport.ts:50-61`;
`features/fiscal/services/FiscalTransmissionDrainer.ts:76-82`

The transport checks only HTTP status and returns the response body without
interpreting SOAP faults or per-record submission results. The drainer marks
any resolved submission as `sent`.

Reproduced with mocked fetch: an HTTP 200 body containing
`<EstadoEnvio>Incorrecto</EstadoEnvio>` resolves successfully. The drainer's
success branch consequently has no way to distinguish rejection from
acceptance.

Impact: rejected invoices disappear from retry processing and receive a
misleading `fiscal:transmitted` audit event.

Recommendation: parse the actual SOAP response and individual record statuses;
mark sent only on confirmed acceptance. Persist actionable rejection details
and distinguish accepted duplicates, retryable failures, and permanent errors.

### F07 - P1 - Return records omit the actual refunded amounts

Category: financial correctness  
Evidence: `features/fiscal/services/OfflineFiscalService.ts:96-106`;
`features/fiscal/services/authorities/EsVerifactuAdapter.ts:80-87`;
`features/returns/services/refunds/RefundService.ts:217-235`

Fiscal return registration receives only IDs and never loads the return row,
refunded quantity, tax, or amount. The immutable payload therefore contains no
financial correction. The ES content mapper substitutes zero for all missing
amounts; the TSE transport likewise defaults a missing order total to zero.

Reproduced: the return payload after a 120.00 sale has no `order` amounts.
Even an arbitrary return ID is accepted by this internal service; it does not
resolve the referenced return row. The normal return workflow's own validation
does not fill the missing fiscal payload.

Impact: real refunds do not create an accurate immutable monetary correction;
authority requests derived from those records carry zero amounts.

Recommendation: load and validate the persisted return, verify its association
with the original fiscal sale, snapshot the actual refund/tax breakdown and
original fiscal reference, and make registration idempotent per return ID.

### F08 - P1 - ES voids and shift closures are serialized as sales-invoice records

Category: fiscal processing  
Evidence: `features/fiscal/services/authorities/EsVerifactuAdapter.ts:22-29,80-87`;
`features/fiscal/services/authorities/verifactu.ts:97-126`;
`features/fiscal/services/OfflineFiscalService.ts:109-112`

Every transmitted record goes through `buildAltaXml()`, regardless of its type.
Voids become `RegistroFacturacionAlta` with `TipoFactura=AN` instead of a
cancellation record. A `z_report` has no order amounts, so it becomes a new
`F1` invoice with zero totals.

Reproduced: sale -> void -> shift close queues an alta document containing
`<TipoFactura>AN</TipoFactura>` for the void and another containing
`<TipoFactura>F1</TipoFactura><...>` / `<ImporteTotal>0.00</ImporteTotal>`
for the closure.

Impact: internal closure events are submitted as invoices, and cancellation
events use the wrong authority-document path.

Recommendation: dispatch by event type and implement separate, schema-validated
sale/rectification/cancellation builders. Do not submit internal Z reports as
sales invoices. Validate fixtures against the authority schemas before enabling
this integration for merchants.

### F09 - P2 - Retrying finalization can resurrect a voided sale

Category: financial correctness / idempotency  
Evidence: `features/fiscal/services/OfflineFiscalService.ts:53-64,77-93,224-231`

Idempotency handles only `fiscal_status === 'fiscalized'`. After `voidOrder()`,
the fiscal status is `voided` while the payment status can remain `paid`.
`finalizeSale()` accepts that combination and allocates another sale record.

Reproduced: finalize -> void -> finalize the same paid order. A new invoice
number is allocated and fiscal status changes back to `fiscalized`.

Impact: replay/reconciliation can create another sales invoice without another
sale, undoing the effective void state.

Recommendation: define an explicit fiscal state machine, reject finalization
of voided orders, and enforce one original sale record per order at the
transaction/database boundary rather than relying solely on a pre-read.

### F10 - P2 - SOAP header interpolation permits XML corruption/injection

Category: security / input handling (CWE-91)  
Evidence: `features/fiscal/services/transports/AeatVerifactuTransport.ts:31-46`

`storeName` and `fiscalBusinessTaxId` are interpolated directly into the SOAP
header. Unlike the inner fiscal-document builder, this code does not escape
XML characters.

Reproduced: a legitimate store name `A & B` appears literally as
`<sum1:NombreRazon>A & B</sum1:NombreRazon>`, yielding malformed XML.
Crafted closing tags in a writable setting could alter the envelope structure.

Impact: ordinary merchant names can break submissions; malicious configuration
input can inject XML elements. Exploitation requires influence over merchant
configuration; this is not evidence of unauthenticated remote code execution.

Recommendation: build the entire envelope with a safe XML serializer or escape
all interpolated text consistently, validate tax-ID input, and test both
special-character merchant names and closing-tag payloads.

### F11 - P2 - ES receipt QR artifacts use preproduction and disappear on replay/reprint

Category: receipt correctness  
Evidence: `features/fiscal/services/authorities/verifactu.ts:120-133`;
`features/fiscal/services/authorities/EsVerifactuAdapter.ts:37-45`;
`features/fiscal/services/OfflineFiscalService.ts:53-58,261-275`;
`features/orders-sync/screens/OrderHistoryScreen.tsx:89-108`

The QR builder defaults `production` to false and its caller never supplies
that argument, including production builds. The QR exists only on the first
returned record: idempotent finalization maps a stored row without regenerating
it, and the order-history reprint path supplies no fiscal QR.

Reproduced in ES record mode: initial finalization returns a
`https://prewww2.aeat.es/...` URL; retrying the same finalization returns no QR.
The reprint omission is confirmed by static inspection.

Impact: production receipts point to the test service, while retries/reprints
omit the receipt artifact entirely.

Recommendation: select the authority environment explicitly and consistently,
and derive receipt artifacts from immutable fiscal data on every relevant
read/reprint, not only on the first checkout callback.

### F12 - P2 - Z reports do not freeze totals or lock the standalone period

Category: financial integrity / incomplete close semantics  
Evidence: `features/hardware/services/printer/DailyReportService.ts:90-104,174-235`;
`features/fiscal/services/OfflineFiscalService.ts:109-112`;
`shared/utils/dbSchema.ts:833-912`

`chainZReport()` passes only shift/cashier identity: no totals, order count, or
first/last fiscal sequence. `closeShift()` merely allocates that payload.
Standalone closing subsequently updates key-value shift state separately,
without a persistent fiscal lock. Sales records do not include shift
membership, and there is no standalone locked-period mutation guard.

Static validation: the v15 migration adds no period-lock storage, and the
allocator never reads or sets a lock. The existing close test only checks
that a record with type `z_report` was created.

Impact: the purported immutable Z report cannot reconstruct the day's financial
close, and closing does not enforce the documented frozen-period guarantee.
Because the fiscal record and shift state commit separately, interruption can
also leave a close record while the saved shift is still open.

Recommendation: calculate and persist a complete closure snapshot, associate
sales with their shift, and atomically commit closure plus a durable period
lock. Enforce that lock at mutation boundaries and make repeated close requests
idempotent.

## Validation

- Existing fiscal, schema-migration, and daily-report suites: 5 suites,
  66 tests passed.
- Existing checkout, return service/integration/validation, and interruption
  recovery suites: 5 suites, 34 tests passed.
- Temporary review-only reproduction suite: 9 tests passed, asserting the
  current defective behavior described in F01-F03 and F05-F11. These are
  confirmations of defects, not evidence that the defects are fixed.
- `./node_modules/.bin/tsc --noEmit`: passed, including the reproduction suite.
- An initial targeted run included a nonexistent `RefundService.test.ts` path;
  it was corrected to the actual return suites and the corrected run passed.

The temporary reproduction file was removed after verification so that the
only retained changes are review documentation. For regression work, use the
adjacent real-SQLite test pattern in
`features/fiscal/services/OfflineFiscalService.sqlite.test.ts` and
`FiscalAuthorityFlow.sqlite.test.ts`, and invert the unsafe outcomes described
above into safety assertions. Transport tests should mock `fetch` and verify
business-result parsing as well as request bodies.

## Additional Deployment Caveats

The AEAT transport checks for a configured client certificate but does not
actually attach it or its key to `fetch`. Its default endpoint points directly
to AEAT, so importing credentials alone does not implement mutual TLS.
The source documents a certificate-holding proxy or the separate server as
the supported submission route; this review did not validate either. Require
an explicitly configured, validated transport path before enabling standalone
production submission.

Fiscal specifications in `docs/features/fiscal/` still identify themselves as
draft/pre-implementation and contain target guarantees not enforced here.
Treat them as requirements, not proof of current behavior or certification.
