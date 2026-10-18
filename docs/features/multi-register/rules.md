# Multi-Register — Rules

## R1 — Exactly one server; clients never touch SQLite directly

**Rule.** `mode=server` hosts the API + owns the DB and is only selectable on
the desktop (Electron) app — the HTTP listener lives in the Electron main
process, and mobile registers never host; `mode=client` sends every
read/write through signed HTTP to the server; `standalone` (default)
disables networking entirely.

**Evidence.** `features/multi-register/services/InstoreApiConfig.ts`,
`InstoreApiServer.ts`.

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

**Evidence.** `features/multi-register/services/requestSigning.ts`,
`InstoreApiServer.ts:140-160`.

🟢 **E2.1** — tampered body → signature mismatch → rejected before routing.

🔴 **E2.2 — Replay** — captured request re-sent within the window → nonce
already claimed → rejected.

🟠 **E2.3 — Health is unauthenticated** — exposes `registerId/registerName`
to anyone on the LAN (documented trade-off for discovery).

## R3 — Missing secret is auto-generated, not fatal

**Rule.** Server start with empty `sharedSecret` generates one and logs where
to copy it (Settings → Instore API); it persists via `ProtectedValueStore`
(may live in secure storage, not plain KV).

**Evidence.** `InstoreApiServer.ts:85-90`, `InstoreApiConfig` settingsStore.

🟠 **E3.1** — first server boot → secret generated → operator must copy it to
each client manually (no pairing flow).

## R4 — `/api/users/verify-pin` is brute-force guarded

**Rule.** The server has an explicit rate guard on the PIN-verify route —
a client holding the secret still can't try unlimited PINs.

**Evidence.** `InstoreApiServer.ts:46` comment + route handler.

🔴 **E4.1** — repeated wrong PINs from a client → throttled/rejected by the
guard (see authentication doc for the auth side).

## R5 — Route order matters: literals before parameters

**Rule.** `/api/orders/unsynced` is registered before `/api/orders/:id` —
parameter routes would otherwise swallow literal segments.

**Evidence.** `InstoreApiServer.ts:212-214` comment.

🟠 **E5.1** — adding a literal route _after_ a `:param` route silently
shadows it — no test protects the ordering (PG2).

## R6 — Client UIs refresh from the sync event bus, not polling of rows

**Rule.** `syncEventBus` events (`order:created|updated|paid`, …) reach
clients via WebSocket (or `SyncPoller`); `useOrders` and other hooks
re-fetch on events — see orders-sync doc for the consumer side.

**Evidence.** `features/multi-register/services/{sync,websocket}/*`, `features/orders-sync/hooks/useOrders.ts`.

🟢 **E6.1** — server takes a payment → `order:paid` → client order lists
refresh without manual reload.

🟠 **E6.2 — Socket drops** — `StoreApiConnectionManager` reconnects; gap in
events is covered by polling/snapshot fallback (verify interval — PG3).

## R7 — The commercefull webhook is unauthenticated by necessity

**Rule.** `POST /api/webhooks/commercefull` can't be signed with the LAN
secret — it accepts platform webhook traffic directly on the server register.

**Evidence.** `InstoreApiServer.ts:142-146` comment + route.

🟠 **E7.1** — anything on the LAN can POST to it — trust relies on payload
validation inside the handler (verify — Q1).

## ❓ Open Questions

- **Q1** — Webhook payload validation: does the commercefull route verify an
  upstream signature/secret, or accept any POST?
- **Q2** — Client offline tolerance: when the server is unreachable, do
  client registers queue writes, fail the operation, or fall back to a local
  DB? (`InstoreApiOrderRepository` exists — check its failure mode.)
- **Q3** — How is `registerId` assigned/persisted — first-boot UUID, or
  manual?

## ⚠️ Potential Gaps

- **PG1** — Two `mode=server` devices on one LAN → silent split-brain; no
  election/claim mechanism.
- **PG2** — Route-order shadowing is comment-protected, not test-protected.
- **PG3** — Event loss while the socket is down — client views stale until
  reconnect + refetch; is there a snapshot catch-up?
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
**Responsibility**: server/client/standalone modes (server is desktop-only —
the HTTP listener runs in the Electron main process); LAN HTTP API over
shared SQLite; HMAC-signed requests with nonce replay protection; subnet
discovery; websocket + poller event sync; PED payment orchestration
endpoint.

**Core rules**

- R1 One server owns the DB (desktop app only); clients call it.
- R2 Every call signed; replayed nonces rejected; 2 exempt routes.
- R3 Empty secret auto-generates on server start.
- R4 PIN-verify is rate-guarded.
- R5 Literal routes precede parameterized.
- R6 Client freshness via syncEventBus (ws/poller).
- R7 Webhook route is unauthenticated by necessity.

**Primary happy path**: server starts → secret copied → clients scan+connect
→ all registers share orders/products live.

**Critical unhappy paths**: bad signature/nonce → rejected; secret mismatch →
every call fails; server unreachable → client ops fail (queue unknown — Q2).

**Offline**: LAN-only by design; no internet needed. Server down ⇒ clients
can't transact against shared data.

**Gaps**: multi-server split-brain; event-loss catch-up; manual secret
distribution; clock-skew auth failures.
