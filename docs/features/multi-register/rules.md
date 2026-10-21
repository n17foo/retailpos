# Multi-Register — Rules

## R1 — Exactly one server; clients never touch SQLite directly

**Rule.** Exactly one in-store server — a separate project on a dedicated
host — owns the authoritative database and the API (ADR-018). Registers run
`mode=client`, sending every read/write through signed HTTP, or
`standalone` (default), which disables networking entirely. No register
ever hosts the API.

**Evidence.** `features/multi-register/services/InstoreApiConfig.ts`,
`features/platform-clients/services/clients/instoreapi/InstoreApiClient.ts`;
ADR-018.

🟢 **E1.1** — client `createOrder` → `POST /api/orders` on the server → the
server's repositories write the row; all registers read the same data.

🟠 **E1.2 — Two servers on one LAN** — nothing in discovery prevents it;
clients pick whichever they scanned/configured → split-brain data (PG1).

## R2 — Every request is HMAC-signed; two routes are exempt

**Rule.** `x-instore-signature` = HMAC-SHA256 of
`METHOD\npath+query\ntimestamp\nnonce\nsha256(body)` under `sharedSecret`.
Server rejects bad signatures, stale timestamps, and **replayed nonces**
(in-memory cache `${registerId}:${nonce}` → expiry). Exempt:
`GET /api/health` (discovery needs it) and `POST /api/webhooks/commercefull`
(external caller can't share our secret).

**Evidence.** `features/multi-register/services/requestSigning.ts` (client
side); verification is the server's job — part of the protocol contract in
this doc, implemented by the server project (ADR-018).

🟢 **E2.1** — tampered body → signature mismatch → rejected before routing.

🔴 **E2.2 — Replay** — captured request re-sent within the window → nonce
already claimed → rejected.

🟠 **E2.3 — Health is unauthenticated** — exposes `registerId/registerName`
to anyone on the LAN (documented trade-off for discovery).

## R3 — Missing secret is auto-generated, not fatal

**Rule.** The server generates/owns `sharedSecret`; the operator copies it
to each register (Settings → Instore API), where it persists via
`ProtectedValueStore` (may live in secure storage, not plain KV).

**Evidence.** `InstoreApiConfig` settingsStore.

🟠 **E3.1** — first server boot → secret generated → operator must copy it to
each client manually (no pairing flow).

## R4 — `/api/users/verify-pin` is brute-force guarded

**Rule.** The server has an explicit rate guard on the PIN-verify route —
a client holding the secret still can't try unlimited PINs.

**Evidence.** Protocol contract — `/api/users/verify-pin` route, implemented
by the server project (ADR-018).

🔴 **E4.1** — repeated wrong PINs from a client → throttled/rejected by the
guard (see authentication doc for the auth side).

## R5 — Route order matters: literals before parameters

**Rule.** `/api/orders/unsynced` is registered before `/api/orders/:id` —
parameter routes would otherwise swallow literal segments.

**Evidence.** Protocol contract — server route table ordering (ADR-018).

🟠 **E5.1** — adding a literal route _after_ a `:param` route silently
shadows it — no test protects the ordering (PG2).

## R6 — Client UIs refresh from the sync event bus, not polling of rows

**Rule.** `syncEventBus` events (`order:created|updated|paid`, …) reach
clients via WebSocket (or `SyncPoller`); `useOrders` and other hooks
re-fetch on events — see orders-sync doc for the consumer side. The bus
dedupes by event id, so double delivery (poller + WS outbox replay) never
double-applies.

**Evidence.** `features/multi-register/services/{sync,websocket}/*`, `features/orders-sync/hooks/useOrders.ts`.

🟢 **E6.1** — a register takes a payment → server broadcasts `order:paid` →
other client order lists refresh without manual reload.

🟠 **E6.2 — Socket drops** — `StoreApiConnectionManager` reconnects; events
are durable in the server-side device outbox (dedupe key `sync:<eventId>`)
and replay on reconnect; `SyncPoller` covers any residual gap.

## R7 — Platform-order upload is claimed atomically

**Rule.** In multi-POS + online-platform deployments, a register must win
`PUT /api/orders/{id}/sync/claim` before pushing the order to the platform.
The server applies a single conditional update (paid, not synced, no fresh
`syncing` claim); losing registers get 409 and skip. Claims expire after
10 min so a crashed register doesn't wedge the order; `PUT /api/orders/{id}/sync`
records the outcome (`synced` + platform id, or `failed`/`pending` + error).

**Evidence.** `features/orders-sync/repositories/{OrderRepository,InstoreApiOrderRepository,OfflineOrderRepository}.ts`
(`claimSync`), `features/orders-sync/services/OrderSyncService.ts`; server:
`ClaimOrderSync` + `PUT /api/orders/{id}/sync`.

🔴 **E7.1 — Two registers race one order** — second claim → 409 → no
duplicate platform order.

## R8 — LAN outage degrades the register; it never swaps modes

**Rule.** A client register keeps `mode=client` through an outage —
`StoreApiHealthService` flips online/degraded (session probe + WS state).
While degraded: order writes queue in local SQLite (`sync_status='pending_upload'`

- `pending_ops`, FIFO flush on recovery); catalogue/tax/user reads serve
  from read-through caches; card tender drops to cash-only; store-credit
  redemption fails closed; loyalty earn queues locally. Pending rows merge
  into order reads so history stays consistent. Mode never flips to
  `standalone` — that would split-brain the store (empty local catalogue,
  local-only ledgers, orders that never reach the server).

**Evidence.** `features/multi-register/services/StoreApiHealthService.ts`,
`features/multi-register/services/offline/{PendingOrderStore,ServerDataCache,isStoreApiUnavailable}.ts`,
`features/orders-sync/repositories/InstoreApiOrderRepository.ts`,
`features/orders-sync/repositories/InstoreApiOrderRepository.degraded.test.ts`.

🟢 **E8.1 — Cash sale mid-outage** — order queues locally, appears in order
history immediately, uploads on recovery with its original `createdAt`/
`paidAt` so reports attribute it to when it happened.

🟠 **E8.2 — Register crashes mid-flush** — idempotent `POST /api/orders`
(same order id returns the existing row) makes re-upload safe.

🟠 **E8.3 — Store-credit redemption while degraded** — rejected; there is
no safe offline equivalent for spendable balances.

🟠 **E8.4 — Independent queues** — during a partition each register only
sees its own pending sales; the server reconciles on recovery via register
attribution + idempotent create.

## R9 — Server-side ledgers are signed and atomic

**Rule.** Loyalty/store-credit ledgers live on the server in client mode
(single balance across registers). Transactions are signed deltas — loyalty
`earn` positive / `redeem` negative / `expire` negative; store-credit
`issue` positive / `redeem`/`expire`/`reversal` negative. The server
validates sign-by-type and rejects overdraws atomically with HTTP 409 —
two registers cannot spend the same credit.

**Evidence.** `features/customers/repositories/{InstoreApiLoyaltyRepository,InstoreApiStoreCreditRepository}.ts`,
`features/discounts/` server-backed discount service; server: `pkg/store/ledgers.go`.

🔴 **E9.1 — Concurrent redemptions** — the ledger update and balance check
run in one transaction; the loser gets 409.

🟠 **E9.2 — Sign/type mismatch** — e.g. positive `redeem` → 400 before it
can mint credit.

## R10 — The commercefull webhook is unauthenticated by necessity

**Rule.** `POST /api/webhooks/commercefull` can't be signed with the LAN
secret — it accepts platform webhook traffic directly on the server.

**Evidence.** Protocol contract — webhook route exemption (ADR-018).

🟠 **E7.1** — anything on the LAN can POST to it — trust relies on payload
validation inside the handler (verify — Q1).

## ❓ Open Questions

- **Q1** — Webhook payload validation: does the commercefull route verify an
  upstream signature/secret, or accept any POST?
- ~~**Q2** — Client offline tolerance~~ — **resolved (R8)**: client registers
  queue order writes in local SQLite and flush on recovery; they do not
  fail over to a local database and never swap to `standalone`.
- **Q3** — How is `registerId` assigned/persisted — first-boot UUID, or
  manual?

## ⚠️ Potential Gaps

- **PG1** — Two server instances on one LAN → silent split-brain; no
  election/claim mechanism.
- **PG2** — Route-order shadowing is comment-protected, not test-protected.
- ~~**PG3** — Event loss while the socket is down~~ — resolved: server-side
  durable device outboxes replay missed events on reconnect (`dedupe_key`
  `sync:<eventId>`), `SyncPoller` covers residuals, and `SnapshotService`
  applies `/api/snapshot` state on demand.
- **PG4** — Secret distribution is manual copy-paste — a leaked secret
  compromises every route except health/webhook.
- **PG5** — Timestamp window + device clock skew — a client with a wrong
  clock gets every request rejected (symptom looks like auth failure).

## Test Coverage Mapping

| Example              | Coverage                                                  |
| -------------------- | --------------------------------------------------------- |
| R2 signing/verify    | `features/multi-register/services/requestSigning.test.ts` |
| R4 brute-force guard | Not found                                                 |
| R5 route ordering    | Not found                                                 |

## Feature Context Summary

**Feature**: Multi-register (Instore API)
**Responsibility**: client/standalone register modes against a dedicated
in-store server (separate project, ADR-018); LAN HTTP API protocol contract;
HMAC-signed requests with nonce replay protection; subnet discovery;
websocket + poller event sync; PED payment orchestration endpoint.

**Core rules**

- R1 One dedicated server owns the DB; client registers call it.
- R2 Every call signed; replayed nonces rejected; 2 exempt routes.
- R3 Empty secret auto-generates on server start.
- R4 PIN-verify is rate-guarded.
- R5 Literal routes precede parameterized.
- R6 Client freshness via syncEventBus (ws outbox replay + poller; deduped).
- R7 Platform upload requires an atomic server claim (`sync/claim`).
- R8 LAN outage ⇒ degraded mode — queued sales + caches, never mode-swap.
- R9 Ledgers are server-side, signed, atomic (overdraw → 409).
- R10 Webhook route is unauthenticated by necessity.

**Primary happy path**: server starts → secret copied → clients scan+connect
→ all registers share orders/products live.

**Critical unhappy paths**: bad signature/nonce → rejected; secret mismatch →
every call fails; server unreachable → degraded mode: cash sales queue
locally and flush on recovery, catalogue/auth serve from cache, ledger
redemption fails closed (R8).

**Offline**: LAN-only by design; no internet needed. Server down ⇒ clients
keep selling cash orders via the local pending queue; shared/server
operations (ledgers, PED, KDS) are unavailable until recovery.

**Gaps**: multi-server split-brain; manual secret
distribution; clock-skew auth failures; partitioned registers hold
independent pending queues until recovery (R8-E8.4).
