# Multi-Register (Instore API)

## Purpose

Several registers share one database over the LAN. The **in-store server is
a separate project** running on a dedicated always-on host — it owns the
authoritative store database and serves the HTTP API on port 8787 (ADR-018).
Every POS register — Android, iOS, and desktop alike — runs as a **client**
(or `standalone`); the POS app never opens a listening socket. Discovery
finds the server on the subnet, HMAC request signing authenticates every
call, and a WebSocket/sync layer pushes order/product events so client
registers see each other's work in real time. `standalone` mode = single
register, no networking.

## Scope

### Included

- `InstoreApiConfig` — `mode: standalone|client`, serverAddress, port
  (default 8787), `registerId`, `registerName`, `sharedSecret` (stored via
  `ProtectedValueStore`; issued by the server operator).
- `InstoreApiServer` / `requestSigning` — the in-repo reference for the
  **protocol contract** the dedicated server implements: route table
  (orders, products, returns, users/PIN verify, categories, tax-profiles,
  sync events, snapshot, commercefull webhook), `x-instore-signature`
  HMAC-SHA256 over `method\npath\ntimestamp\nnonce\nsha256(body)`, nonce
  replay cache, verify-pin brute-force guard. These server-side pieces are
  being extracted into the separate server project (ADR-018).
- `InstoreApiDiscovery` — subnet scan for `/api/health` responders
  (no mDNS dependency).
- `InstoreApiTransport` — client-side signed HTTP calls to the server.
- `websocket/` + `sync/` — `StoreApiWebSocket`, `StoreApiConnectionManager`,
  `SnapshotService`, `SyncEventBus`, `SyncPoller` — real-time events
  (`order:created|updated|paid`, …) to clients.
- `payment/` — `InstoreApiPaymentService` + `PaymentIntentClient` — PED
  payment orchestration via `/api/payment/*` (payments feature).
- `InstoreApiSettingsTab` — mode/secret/register config UI.

### Excluded

- Order sync _to the platform_ — orders-sync feature (this is register↔server,
  not POS↔ecommerce).
- The payment provider itself — payments feature; this is the transport.

## Entry Points

- **Settings → Instore API tab** — pick mode (`standalone`/`client`),
  enter the shared secret issued by the server operator, name the register,
  set server address/port.
- **Discovery** — client registers scan the subnet for `/api/health`.
- **App start** — `App.tsx` starts/stops `storeApiConnectionManager` and
  `syncPoller` based on mode.

## Feature Flow

```
In-store server (separate project, dedicated host):
  HTTP :8787 → routes serve the authoritative store DB
    + auth on every route except /api/health + /api/webhooks/commercefull
  websocket broadcasts domain events to registers

Client register (mode=client — the only networked register mode):
  Discovery.scanSubnet → list of {address, registerId, registerName}
    → configure serverAddress:port + sharedSecret
    → every call: signRequest(secret, method, path, body)
       → server verifies HMAC + timestamp window + nonce uniqueness
    → data mutations POST to server (orders, returns, categories, products)
    → reads via transport (orders, products, snapshot)
    → realtime via websocket/SyncPoller → syncEventBus → UI refreshes
```

## Implementation Map

| Layer    | Responsibility                                | Implementation                                                                                                                   |
| -------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Services | Config, server, discovery, transport, signing | `features/multi-register/services/{InstoreApiConfig,InstoreApiServer,InstoreApiDiscovery,InstoreApiTransport,requestSigning}.ts` |
| Services | Realtime                                      | `features/multi-register/services/{websocket,sync}/`                                                                             |
| Services | PED payments                                  | `features/multi-register/services/payment/`                                                                                      |
| Screens  | Settings tab                                  | `features/settings/screens/InstoreApiSettingsTab.tsx`                                                                            |
| App      | Lifecycle start/stop                          | `App.tsx`                                                                                                                        |

## State Ownership

| State                    | Owner                       | Persistence                | Reset condition  |
| ------------------------ | --------------------------- | -------------------------- | ---------------- |
| Mode + settings + secret | `InstoreApiConfig`          | `ProtectedValueStore` (KV) | User edit        |
| Nonce replay cache       | in-store server             | Memory                     | Expiry / restart |
| Socket connection        | `StoreApiConnectionManager` | None                       | Reconnect        |
| Authoritative data       | in-store server             | Server's database          | —                |

## Dependencies

- `ProtectedValueStore` — shared secret storage.
- `shared/utils/crypto.ts` — `sha256Hex` for signing (hand-rolled SHA-256).
- The dedicated in-store server (separate project) — all client operations
  depend on it being reachable on the LAN.

## Side Effects

- Every client mutation hits the server's database (the authoritative
  store).
- WebSocket events broadcast to clients → UI re-fetches.
- The shared secret is issued by the server operator and entered on each
  register out-of-band.
- PIN-verify calls go to the server (brute-force guarded) — client-side auth
  depends on LAN.
