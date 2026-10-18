# Multi-Register (Instore API)

## Purpose

Several registers share one local database over the LAN. The **server** role
runs only on the desktop (Electron) app — or a dedicated store-api host —
which owns the SQLite data and hosts the HTTP API on port 8787 (the listener
lives in the Electron main process; requests reach the renderer over IPC).
Android/iOS registers always run as **clients** — they never open a
listening socket. Discovery finds servers on the subnet, HMAC request
signing authenticates every call, and a WebSocket/sync layer pushes
order/product events so client registers see each other's work in real
time. `standalone` mode = single register, no networking.

## Scope

### Included

- `InstoreApiConfig` — `mode: standalone|server|client`, serverAddress, port
  (default 8787), `registerId`, `registerName`, `sharedSecret` (auto-generated
  on server start if absent; stored via `ProtectedValueStore`).
- `InstoreApiServer` — route table + handlers over local repositories/services
  (orders, products, returns, users/PIN verify, categories, tax-profiles,
  sync events, snapshot, commercefull webhook).
- `InstoreApiDiscovery` — subnet scan for `/api/health` responders
  (no mDNS dependency).
- `InstoreApiTransport` — server-side transport: binds `InstoreApiServer` to
  the Electron main-process HTTP listener over IPC (`instore-server-start`
  / `instore-server-request` / `instore-server-respond`). Throws on
  non-Electron platforms — server mode is desktop-only.
- `requestSigning` — `x-instore-signature` HMAC-SHA256 over
  `method\npath\ntimestamp\nnonce\nsha256(body)`; nonce replay cache;
  verify-pin brute-force guard.
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

- **Settings → Instore API tab** — pick mode, generate/copy shared secret,
  name the register, set server address/port. The `server` option is only
  shown on the desktop app; mobile registers offer `standalone`/`client`.
- **Discovery** — client registers scan the subnet for `/api/health`.
- **App start** — `App.tsx` starts/stops `instoreApiServer`,
  `storeApiConnectionManager`, `syncPoller` based on mode.

## Feature Flow

```
Desktop app (mode=server):
  InstoreApiTransport.start(port)
    → Electron main process binds HTTP :8787, forwards requests via IPC
    → InstoreApiServer routes serve local repos
      + auth on every route except /api/health + /api/webhooks/commercefull
  websocket broadcasts domain events

Client register (mode=client — the only networked mode on Android/iOS):
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
| Nonce replay cache       | `InstoreApiServer`          | Memory                     | Expiry / restart |
| Socket connection        | `StoreApiConnectionManager` | None                       | Reconnect        |
| Server route state       | repositories (shared DB)    | SQLite                     | —                |

## Dependencies

- `ProtectedValueStore` — shared secret storage.
- `shared/utils/crypto.ts` — `sha256Hex` for signing (hand-rolled SHA-256).
- Repositories/services on the server register — routes are thin wrappers.
- LAN connectivity for all client operations.

## Side Effects

- HTTP server bound to port 8787 on the server device — hosted by the Electron
  main process on desktop; Android/iOS registers are client-only.
- Every client mutation hits server SQLite (the authoritative store).
- WebSocket events broadcast to clients → UI re-fetches.
- Auto-generated shared secret logged once for operator to copy.
- PIN-verify calls go to the server (brute-force guarded) — client-side auth
  depends on LAN.
