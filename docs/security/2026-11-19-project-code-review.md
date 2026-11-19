# Project Review - Feature By Feature

Date: 2026-11-19  
Revision: `909c2ee` (`main`)  
Status: all findings fixed — P1 commits `3ad321f`, `b913539`, `632ed86`, `4f54bbb`, `157e7fb`, `b055ee0`, `9343a50`, `4f90d42`; P2 commits `9579b1e`, `ca2654b`, `d10c85e`, `d82e255`, `e995039`, `bf0b760`, `53ae296`

## Findings And Priorities

This project-wide review adds 18 findings to the 12 in the
[fiscal review](2026-11-19-fiscal-code-review.md): 30 documented findings
across the two reports. Reproductions demonstrate existing defects, not fixes.

Highest-priority work:

1. Stop production fallback to simulated payments and stop reporting Square
   nonce collection as a completed charge: PAY-01 and PAY-02.
2. Preserve unknown payment outcomes through crashes and retries: CHK-01.
3. Make customer-credit/loyalty operations atomic and idempotent: CUS-01 through
   CUS-05.
4. Correct exchange order construction and procurement validation: RET-01 and
   PRO-01.
5. Address fiscal integrity/submission findings in the companion report before
   treating the module as production-ready.

P1 means high-priority financial integrity, security, or transaction correctness
impact when the affected path is used. P2 means medium-priority correctness,
privacy, or reliability impact. These are engineering priorities, not CVSS
scores. No unauthenticated remote exploit is claimed.

## Scope And Review Setup

Every feature directory received a review pass over its main entry points,
service/repository boundaries, or relevant integration paths. Depth varies:
core financial paths received targeted reproductions; other areas received
static sampling and execution of their existing tests. This is not a claim
that every file or every platform adapter was inspected line by line.

For each feature, this report records:

- The implementation paths inspected and confirmed findings.
- Whether validation used real in-memory SQLite, mocked external boundaries,
  or static tracing.
- The next checks needed before closing that feature's review.

No live payment, refund, authority, email, or merchant API requests were made.
No real credentials or merchant data were used. The separate in-store server,
physical peripherals, native provider SDK execution, packaged Electron app,
and actual merchant configurations were unavailable for end-to-end validation.
No dependency advisory scan or legal certification assessment was performed.

## Feature Coverage

| Feature             | Reviewed Paths                                                                                                  | Findings                           | Remaining Validation                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Authentication      | Auth service, PIN/biometric providers, permission resolution, approval, screen gates, session/navigation wiring | No additional confirmed finding    | Native biometric identity, live server authorization, mid-session role revocation                               |
| Basket              | JSON persistence, add/clear, customer state, action provider                                                    | BAS-01, BAS-02                     | High-rate scanning, price/discount changes, tax-inclusive scenarios                                             |
| Catalogue           | Offline CRUD/filtering, composite aggregation, product repository, scan resolution                              | CAT-01                             | All remote adapters, cursor pagination, cross-platform identity                                                 |
| Checkout            | Tender/split hooks, durable payment boundary, interruption recovery                                             | CHK-01; fiscal F04                 | Kill/restart at every tender boundary; provider-specific unknown outcomes                                       |
| Customers           | Store-credit and loyalty services, local ledgers, expiry                                                        | CUS-01 through CUS-05              | Server ledger guarantees, expiry allocation after partial spend, customer identity normalization                |
| Discounts           | Local validation/usage service and repository; basket integration                                               | No additional confirmed finding    | Usage-limit races, cart changes after validation, adapter-specific rules; no adjacent discount test files found |
| Fiscal              | Ledger, adapters, transports, checkout/refund/shift integration                                                 | Companion report F01-F12           | Authority schema validation, signed checkpoints, real vendor acceptance                                         |
| Hardware            | Electron/native printer paths, display socket, HTTP KDS                                                         | HARD-01                            | Physical printers, ESC/POS models, drawer controls, reconnect behavior                                          |
| Inventory           | Offline variant storage, pending queue, retry decorator                                                         | INV-01, INV-02                     | Platform-specific delta idempotency and stale absolute writes                                                   |
| Multi-register      | Config/signing, pending order upload, WebSocket and PED paths                                                   | CHK-01 also affects PED            | Separate server review; LAN faults, multi-device replay and reconciliation                                      |
| Onboarding          | Progress persistence, provider, root navigation/setup flow                                                      | No additional confirmed finding    | Restart during each step, failed credential writes, migrations of existing installs                             |
| Orders-sync         | Claims, platform creation/reference lookup, retry/quarantine, history                                           | Fiscal linkage findings also apply | Remote lost-response behavior for every adapter; overlapping sync on standalone                                 |
| Payments            | Factory/facade, Square, sampled Adyen/Tap, PED mapping                                                          | PAY-01, PAY-02; CHK-01             | Real SDK contracts, real charge/refund/void reconciliation                                                      |
| Platform clients    | Base HTTP/auth, WooCommerce, token lifecycle, protected storage, webhook receiver, tax resolution               | No additional confirmed finding    | All eight remote adapters and token issuers; response/body timeouts and endpoint policy                         |
| Procurement         | PO receive/lifecycle/repository; stock-count service                                                            | PRO-01                             | Partial commits, concurrent receive, stock-count changes during trading                                         |
| Reporting           | Date-range queries, aggregation, split payment breakdown, CSV                                                   | No additional confirmed finding    | Store timezone/DST, refunds vs gross/net definition, server report parity                                       |
| Returns             | Return validation/service, exchange session/service/screen                                                      | RET-01; fiscal F02/F07-F09         | Partial-refund failures, actual monetary settlement, compensation with fiscal records                           |
| Scanning            | Shared HID detector, sale scanner lookup/dedup, exact-variant resolution                                        | BAS-01 affects scan additions      | Real HID timing, focus/checkout-modal behavior, long-running concurrent scans                                   |
| Settings            | Tab composer/screen, role-gated credentials, config persistence                                                 | No additional confirmed finding    | Custom permission overrides on mounted tabs, failed saves, credential rotation                                  |
| Shared/app/Electron | SQLite startup, generic sync queue, secrets backends, IPC/CSP sampling                                          | SHR-01, SYS-01; HARD-01            | Packaged shell, native storage failures, live transport and deployment hardening                                |

“No additional confirmed finding” means no new defect was established in the
paths sampled; it is not a clean bill of health for the entire feature.

## Authentication

Inspected `features/authentication/services/auth/`,
`services/permissions/`, `components/PermissionGate.tsx`, `AuthProvider`,
and navigation guards. Active-user checks, deny-wins permission overrides,
admin-only ceilings, and PIN limiting exist in the sampled paths.

No additional confirmed finding. Follow up with authorization changes while
privileged screens remain mounted, native biometric enrollment, and the
server's independent authorization checks. UI navigation guards are not
evidence of server-side authorization.

## Basket

### BAS-01 - P1 - Parallel basket changes overwrite each other

Status: **fixed** in `157e7fb`

Evidence: `features/basket/services/BasketService.ts:33-57,161-178,224-248`;
`features/basket/repositories/BasketRepository.ts:42-79`.

Each mutation reads the JSON basket, edits its own copy, then replaces the
whole stored document without serialization/version checking.

Reproduced on real SQLite: initialize one basket and run two distinct
`addItem()` calls using `Promise.all`. Both resolve, but the final basket has
only one item. Sale-scanner callbacks can overlap these asynchronous writes.

Impact: a scanned/added item can silently disappear before checkout, producing
an incorrect sale. Serialize mutations per basket or use atomic line storage
and optimistic version checks. Test concurrent add/add and add/remove.

### BAS-02 - P2 - Basket clear retains the previous customer's identity and note

Status: **fixed** in `9579b1e`

Evidence: `features/basket/repositories/BasketRepository.ts:81-88`;
`features/basket/services/BasketService.ts:64-67,161-167`.

Clear resets items/totals/discounts, but leaves customer email/name and note.
It also leaves the row active, so the next basket lookup reuses it.

Reproduced: set customer and a private note, clear, then get the basket; both
remain. Checkout uses this clear path after a completed payment.

Impact: the next customer's sale can inherit another person's details, receipt
note, or loyalty association. End the basket lifecycle or explicitly reset all
customer/sale-scoped fields; preserve state only for a separately named action.

## Catalogue

### CAT-01 - P2 - Available untracked products are filtered out as out of stock

Status: **fixed** in `ca2654b`

Evidence:
`features/catalogue/services/product/platforms/OfflineProductService.ts:65-96`.

The normal stock filter requires a variant with `inventoryQuantity > 0` and
ignores `trackInventory: false` / `isAvailable: true`.

Reproduced: create an available untracked service with quantity zero.
`getProducts({ includeOutOfStock: true })` returns it, but `getProducts({})`
does not. Use the canonical availability policy, distinguishing untracked stock
from tracked zero stock. Test services and mixed-availability variants.

## Checkout

### CHK-01 - P1 - Unknown payment outcomes can become safely retryable drafts

Status: **fixed** in `b055ee0`

Validation: static trace, not a live double-charge experiment.  
Evidence: `features/checkout/hooks/useCheckout.ts:103-114,125-153,382-503`;
`features/checkout/services/CheckoutService.ts:236-286`;
`features/checkout/hooks/useInterruptionRecovery.ts:114-158`;
`features/multi-register/services/payment/InstoreApiPaymentService.ts:88-126,195-198,291-305`.

The normal card path sets the order to processing, invokes the processor, and
keeps the returned transaction ID only in memory until `completePayment()`
persists it. Recovery interprets a missing ID as proof no charge occurred and
reverts to draft. A crash after processor acceptance but before persistence
violates that assumption. Split charge lines are likewise held in hook state.

Additionally, PED timeouts/exceptions become `success: false`, which checkout
treats as a confirmed failure and immediately reverts to draft. Recovery maps
every non-approved intent to failure, even if its outcome is still unknown.

Impact: retrying can charge again after an earlier successful or still-pending
charge. Persist a stable attempt/idempotency key before the external operation,
save provider identity/intent as soon as available, and model approved,
declined, pending, and unknown separately. Missing local evidence must never
be treated as proof the processor did not charge.

## Customers

### CUS-01 - P1 - Repeated reversal creates extra spendable customer credit

Status: **fixed** in `4f54bbb`

Evidence: `features/customers/services/customer/StoreCreditService.ts:107-120`;
`features/customers/services/loyalty/LoyaltyService.ts:189-201`.

Reversal finds the redemption and appends a positive entry without recording
that the original was already reversed or checking for an existing reversal.

Reproduced for store credit: issue 1000 cents, redeem 200, reverse the same
entry twice; balance becomes 1200 cents. The loyalty implementation has the
same unchecked append pattern (static inspection).

Impact: duplicate callbacks/retries can mint spendable value; an authorized
actor able to repeat this operation can abuse it. Store an explicit original
transaction reference with a unique reversal constraint and atomically enforce
one reversal per redemption, including on the separate server.

### CUS-02 - P1 - Concurrent standalone redemptions overspend store credit

Status: **fixed** in `4f54bbb`

Evidence: `features/customers/services/customer/StoreCreditService.ts:76-93`;
`features/customers/repositories/StoreCreditRepository.ts:30-54`.

Balance checking and ledger debit are separate operations. The local repository
does not condition the debit on an adequate current balance.

Reproduced: against a 1000-cent balance, two parallel 800-cent redemptions both
succeed. The ledger sums to -600 while `getBalanceCents()` clamps the displayed
balance to zero, hiding the overdraft.

Make balance validation and debit one serialized transaction with idempotent
request identity. Do not use a clamped display balance as an integrity check.
This reproduces standalone behavior; server rejection is not validated here.

### CUS-03 - P2 - Retried checkout can award the same order's loyalty twice

Status: **fixed** in `d10c85e`

Evidence: `features/customers/services/loyalty/LoyaltyService.ts:135-146`;
`features/customers/repositories/LoyaltyRepository.ts:117-146`.

Reproduced: call `earnPoints()` twice for the same email/order and 100.00 sale
at 100 cents per point; the balance becomes 200 points instead of 100.
No order/type uniqueness or existing-award check prevents repeat awards.

Impact: reconciliation or retry can inflate customer value. Enforce one earn
event per original sale, with an atomic uniqueness rule and an idempotent
return value. Use explicit corrective transactions for adjustments.

### CUS-04 - P1 - Loyalty ledger and balance updates are not atomic

Status: **fixed** in `4f54bbb`

Evidence: `features/customers/repositories/LoyaltyRepository.ts:88-98,117-146`.

Despite its atomicity comment, `applyTransaction()` commits the ledger insert
and balance update as two independent statements.

Reproduced with real SQLite and an injected `updateBalance()` failure: the
operation rejects but the earn transaction remains committed while the
account balance remains zero. Redemption can produce the inverse accounting
disagreement.

Wrap insert and guarded balance update in one transaction; failure must roll
back both. Add uniqueness/idempotency and reconcile cached balances against
the ledger. Verify actual Expo transaction isolation as well as the test adapter.

### CUS-05 - P1 - Repeated loyalty expiry consumes newly earned points

Status: **fixed** in `4f54bbb`

Evidence: `features/customers/services/loyalty/LoyaltyService.ts:240-289`;
`features/customers/repositories/LoyaltyRepository.ts:180-188`.

The expiry query always selects every old earn transaction. Applying expiry
does not consume, mark, or allocate those old lots, so later passes expire the
same historical award again, limited only by today's balance.

Reproduced: earn 100 points, age that earn by three days with one-day expiry,
run expiry, earn 100 fresh points, and run expiry again. The fresh balance
falls from 100 to zero.

Track remaining/expired amounts per earn lot and make expiry idempotent,
accounting for prior redemption and reversal allocation. Re-running a completed
expiry pass must not change balances.

## Discounts

Inspected `LocalDiscountService`, `DiscountRepository`, and basket application.
Validation and usage counting are separate phases. No additional finding was
promoted without a concrete end-to-end reproduction.

No adjacent discount test files were found. Add focused checks for usage-limit
races, expiry between apply/pay, percentage discounts after quantity changes,
minimum purchase after removal, and platform-local fallback rules.

## Fiscal

The [fiscal report](2026-11-19-fiscal-code-review.md) remains the source for
F01-F12, covering tamper detection, original invoice linkage, durable authority
work, strict mode, TSE completion, AEAT acceptance/type handling, return amounts,
receipt artifacts, and closure semantics. Do not count those findings again
under the consuming features.

## Hardware

### HARD-01 - P2 - Electron receipts ignore supplied fiscal identity and QR

Status: **fixed** in `d82e255`

Evidence: `features/hardware/services/printer/ElectronPrinterService.ts:100-119`;
`features/hardware/services/printer/BasePrinterService.ts:144-208`.

Electron uses the shared receipt buffer, which prints `data.orderId` and never
reads `fiscalNumber` or `fiscalQr`. Only the native unified printer path received
the fiscal formatting changes.

Reproduced: format a receipt with a UUID tail, fiscal invoice number, and QR
URL. The resulting bytes contain the UUID but neither fiscal artifact.
Apply consistent fiscal formatting to every printer path and verify both text
and QR command bytes. No physical printer behavior was tested.

## Inventory

### INV-01 - P2 - Offline inventory merges distinct product variants

Status: **fixed** in `e995039`

Evidence:
`features/inventory/services/platforms/OfflineInventoryService.ts:61-75,82-125`.

Inventory is keyed only by `productId`; `variantId` is stored in the SKU field.
Reproduced: set variant v1 to 10 and v2 to 20 for the same parent; only one
parent entry remains at 20 with SKU `v2`.

Impact: receiving/counting one variant overwrites another's stock. Use a
product/variant composite identity in persistence and reads, and migrate
existing rows explicitly rather than inferring a SKU is a variant ID.

### INV-02 - P1 - Concurrent pending-inventory writes silently lose updates

Status: **fixed** in `9343a50`

Evidence: `features/inventory/services/PendingInventoryStore.ts:16-30,42-71`.

The queue is one JSON value updated with unlocked read-modify-write operations.
Reproduced: two parallel `add()` calls for different products on one platform
both resolve, but queue count is one.

Impact: receiving/counting adjustments can disappear permanently instead of
being replayed. Serialize add/remove together or use individual SQLite outbox
rows with unique IDs and transactional coalescing. Verify enqueue during drain,
not just two simultaneous enqueues.

## Multi-Register

Inspected request signing/configuration, queued order upload, WebSocket
dispatch/reconnect, and PED initiation/recovery. CHK-01 applies to the register's
PED consumer. Fiscal strict/finalization issues also cross this boundary.

The server is separate: local checks cannot establish server authorization,
idempotency, row locking, or fiscal enforcement. Plaintext signed LAN transport
is already documented as a deployment risk, not a newly discovered issue.
Perform the server review and multi-device fault tests before signing this area
off.

## Onboarding

Inspected setup-progress persistence, onboarding status/provider, and root
navigation. No additional confirmed finding. Follow up on process termination
between admin creation, secure credential writes, progress completion, and
first login; verify failed persistence cannot imply successful setup.

## Orders-Sync

Inspected platform-order reference lookup, claims, retries/quarantine,
background scheduling, and history/fiscal mapping. No separate new finding
was promoted. Fiscal invoice identity and receipt issues remain relevant.

Remote create/complete operations need per-platform lost-response tests.
Standalone claims are a no-op, so also test overlapping manual/background
sync with a slow platform. Do not assume the generic queue or remote reference
search provides end-to-end idempotency.

## Payments

### PAY-01 - P1 - Missing SDKs silently activate simulated payments in production

Status: **fixed** in `3ad321f`

Evidence: `features/payments/services/PaymentServiceFactory.ts:87-94,130-138`;
`features/payments/services/mock/MockPaymentService.ts:66-99`.

Square, Adyen, and Tap initialization use an unconditional mock fallback on
load failure. This bypasses the separate development-only mock-flag policy.

Reproduced with `__DEV__ = false`, standalone runtime, no enabled mock-payment
flag, and an injected Adyen SDK-load error: the factory returns the mock
singleton. Its payment implementation can return simulated success.

Impact: staff can complete an apparent card sale without real payment.
Fail closed on provider load/init errors in production; permit simulation only
through explicit development/demo mode with unmistakable UI and isolated data.
Test both production flags and actual missing-native-module failures.

### PAY-02 - P1 - Square reports nonce collection as successful payment

Status: **fixed** in `3ad321f`

Evidence: `features/payments/services/SquareService.ts:99-136`.

The SDK flow obtains a card nonce, creates a timestamp-based `sq_` ID, and
returns `success: true`. No backend Payments API call charges the nonce.

Reproduced with mocked Square card-entry callbacks: a nonce-only response
produces payment success and no fetch/backend operation. This is independent
of the factory fallback: the Square service itself is the affected path.

Impact: orders become paid without a charge. Implement a backend-mediated,
idempotent charge and return success only after confirmed processor approval
with its real payment ID. Until then disable this provider for real sales.

## Platform Clients

Inspected common auth/HTTP handling, a WooCommerce client, token cache/refresh,
protected-value storage, offline tax resolution, and Commercefull webhook
verification/delivery tracking.

No additional confirmed finding. Remaining work includes each provider's actual
SDK/API contract, token issuer behavior, secure transport/endpoint policy,
redirects, response-body deadlines, and webhook listener side effects.
Credentials being stored securely does not establish that every downstream
transport uses them safely.

## Procurement

### PRO-01 - P1 - Receiving does not validate PO ownership or lifecycle

Status: **fixed** in `4f90d42`

Evidence: `features/procurement/services/ProcurementService.ts:107-153`;
`features/procurement/repositories/ProcurementRepository.ts:282-292`.

The receiver increments supplied item IDs before validating their membership
in the requested PO and never checks whether that PO may still receive.

Reproduced on SQLite: receive against PO A using PO B's line ID; the call
succeeds, B's received quantity changes, and A's does not. Separately, a
cancelled PO can be fully received and its status becomes `received`.
The foreign-line test also demonstrates receiving beyond its ordered quantity.

Impact: erroneous/stale inputs can corrupt another PO and separate local
receipt quantities from the stock adjustments built only from A's items.
Validate PO state, line membership, finite quantities, and an explicit
over-receive policy before writing. Commit validated local receipts atomically
and enqueue stock work durably with an idempotent receipt identity.

## Reporting

Inspected local summary/day/hour/cashier/register aggregation, split-tender
breakdown, client report delegation, and CSV escaping. No additional confirmed
finding. Validate timezone/DST behavior and explicitly define whether displayed
net sales should subtract returns/refunds, then compare the server output.

## Returns And Exchanges

### RET-01 - P1 - Exchange checkout does not use the exchange's replacement items

Status: **fixed** in `632ed86`

Validation: static trace.  
Evidence: `features/returns/screens/ExchangeScreen.tsx:117-136`;
`features/returns/services/exchange/ExchangeService.ts:132-169`;
`features/checkout/services/CheckoutService.ts:37-51,265-278`.

The exchange screen stores replacement items only in `session.newItems`.
Confirmation invokes the normal `startCheckout()` without supplying those
items or copying them into the basket, so checkout reads the unrelated live
sales basket. The return leg has already been recorded.

Moreover, exchange payment lines represent the net top-up after return credit,
whereas `completePayment()` validates them against the new order's full total.
The return credit is not represented as settlement of that full order.

Impact: normal empty-basket exchanges fail; a nonempty sales basket can create
the wrong replacement order, and nonzero-credit exchanges can fail settlement
validation. Build checkout from an explicit immutable exchange item snapshot,
represent return credit in the settlement model, and define compensation that
does not erase already-chained fiscal corrections. Test with an empty basket,
an unrelated basket, equal-value swaps, top-ups, and money owed to the customer.

## Scanning

Inspected HID burst detection, sale-scan deduplication, loaded/local/platform
barcode resolution, and exact-variant selection. No separate new finding.
BAS-01 is directly relevant because independent scan callbacks can overlap
basket writes. Validate with real scanner timing and modal/focus behavior.

## Settings

Inspected the settings composer/screen and credential-tab role checks alongside
protected-value persistence. No additional confirmed finding. Follow up on
custom permission revocation while tabs remain mounted, failed secure-storage
writes, partial saves, and effective credential/provider rotation.

## Shared Infrastructure, App, And Electron

### SHR-01 - P2 - Concurrent generic queue drains send the same request twice

Status: **fixed** in `bf0b760`

Evidence: `shared/hooks/useSyncStore.ts:71-98`;
`shared/services/queue/QueueManager.ts:19-56`.

`processQueue()` sets `isProcessing` but does not return when another drain
is running. Foreground, connectivity, timer, and manual triggers can overlap.

Reproduced: put one request in the queue and call `processQueue()` twice before
either fetch resolves; two fetches occur for the same queued entry.

Impact depends on the queued endpoint's own idempotency; a client request-ID
header is not proof it deduplicates. Enforce a single active drain and test
overlapping triggers, enqueue during drain, and failure/retry ordering.
This review did not establish a real monetary endpoint using this generic
queue, so it does not claim an observed duplicate charge from SHR-01.

### SYS-01 - P2 - SQLite is exposed before migration/readiness completes

Status: **fixed** in `53ae296`

Validation: static asynchronous control-flow trace.  
Evidence: `shared/utils/db.ts:66-85,105-117`.

`dbInstance` is published immediately after opening, before awaited safety
pragmas, integrity checks, and schema migration complete. Later proxy calls use
that instance directly instead of waiting for the initialization promise.

Reproduction design: pause `initializeSchema()`, start a first proxy operation,
then issue a second operation after the open callback has published the
instance. The second reaches the database before the paused migration finishes.
This schedule was identified statically, not executed in the reproduction suite.

Impact: concurrent startup services can query missing/old tables or write
while migrations are incomplete. Publish the ready instance only after
initialization succeeds, or make every public operation await one readiness
promise. Add a paused-migration regression test with multiple startup callers.

Electron IPC/CSP/secrets were sampled, not tested in a packaged shell. The
existing deployment and hardening documentation remains required.

## Validation And Handoff

- Full existing Jest suite: 264 suites, 917 tests passed.
- Temporary project-review reproductions: 2 suites, 16 tests passed. They
  assert unsafe behavior for BAS-01/02, CAT-01, CUS-01 through CUS-05, HARD-01,
  INV-01/02, PAY-01/02, PRO-01, and SHR-01.
- TypeScript: `./node_modules/.bin/tsc --noEmit` passed with both reproduction
  suites present.
- CHK-01, RET-01, and SYS-01 are static findings, not live end-to-end experiments.
- Earlier fiscal validation is recorded separately in the fiscal report.

Temporary tests used the repository's in-memory `node:sqlite` adapter and
mocked fetch/SDK boundaries. They were removed after recording results so only
documentation changes remain. The SQLite helper does not establish native
Expo concurrency behavior; native crash/isolation tests remain necessary.

For remediation, create adjacent regression tests asserting the safe opposite
of each reproduction, preserve these stable finding IDs, and record a fix
revision plus the exact successful check before marking a finding closed.
Do not close a feature merely because existing tests pass: the 917-test suite
passed before these additional defects were reproduced.
