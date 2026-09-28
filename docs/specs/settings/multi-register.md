# Multi-Register (Local API) – EARS Requirements

> **System**: RetailPOS – Multi-Register Local API
> **Actor**: Manager, Admin, System
> **Date**: 2026-04-13
> **Source**: `services/instoreapi/InstoreApiConfig.ts`, `services/instoreapi/InstoreApiServer.ts`, `services/instoreapi/InstoreApiTransport.ts`, `services/instoreapi/InstoreApiDiscovery.ts`, `services/instoreapi/sync/SyncEventBus.ts`, `services/instoreapi/sync/SyncPoller.ts`, `services/clients/instoreapi/InstoreApiClient.ts`, `screens/settings/InstoreApiSettingsTab.tsx`

---

## Context

The multi-register feature allows multiple POS devices on the same LAN to share data without an internet connection. One device acts as the **server** (hosts the HTTP API and is the single source of truth for all data), and other devices act as **clients** (thin interfaces — they read all data from the server and write all transactions back to the server). A third mode, **standalone**, is the default — no networking, fully self-contained.

### Intended Design

In `client` mode a register is a **dummy interface**:

- Products, categories, tax profiles, and inventory come from the server
- Orders created on a client register are written to the server's SQLite, not the client's
- The client's local SQLite is not used for business data — it is only used for local config and session state
- The server is the single source of truth; all reporting and sync to the e-commerce platform happens from the server

### Current Implementation State

The architecture is a lightweight HTTP server running inside the React Native app. Because React Native cannot run a traditional Node.js HTTP server, `InstoreApiTransport` binds the listener via `react-native-http-bridge` on native builds and forwards each request (method, path with query, headers, raw body) to `InstoreApiServer.handleRequest()`, which owns the route logic. On web/standalone builds the transport is a no-op.

**What is implemented:**

- Route logic for order, product, category, tax profile, return, user, snapshot, and sync-event endpoints
- `InstoreApiClient` HTTP client and `InstoreApiTransport` HTTP listener
- `SyncEventBus` + `SyncPoller` for real-time event propagation
- `InstoreApiDiscovery` for subnet scanning
- Secure configuration persistence
- Commercefull webhook forwarding with signed raw-body verification

**What is not yet implemented (gaps):**

- Shift API routes and repository support
- Encrypted transport or mutual TLS inside the app
- Per-register credentials, revocation, and scoped route authorization

### Production Network Requirement

The LAN transport is plaintext HTTP. HMAC request signing keeps the shared secret off the wire and prevents replay, but it does not encrypt traffic — a passive network observer can still read business data. Production multi-register deployments must run on a trusted, isolated register VLAN or inside an encrypted overlay such as WireGuard or Tailscale. Do not expose the register port to guest Wi-Fi or untrusted LAN clients.

### Modes

| Mode         | Description                                                        |
| ------------ | ------------------------------------------------------------------ |
| `standalone` | Single register, no networking. All data is local SQLite. Default. |
| `server`     | This device hosts the API. Other registers connect to it.          |
| `client`     | This device connects to a server register over the LAN.            |

### Architecture (Intended — client is a thin interface)

```
Server register                          Client register(s) — thin interface
─────────────────────────────────────    ─────────────────────────────────────
InstoreApiServer (route logic)             InstoreApiClient (HTTP fetch)
  ├── GET  /api/health                     ├── testConnection()
  ├── GET  /api/orders[/:id]               ├── getOrders() / getOrder()
  ├── GET  /api/orders/unsynced            ├── getUnsyncedOrders()
  ├── GET  /api/products[/:id]             ├── getProducts() / getProduct()
  ├── GET  /api/tax-profiles               ├── getTaxProfiles()
  ├── GET  /api/returns[/order/:id]        ├── getReturns() / getReturnsByOrder()
  ├── GET  /api/session                    ├── getSyncEvents(since)
  ├── GET  /api/sync/events                ├── createOrder()
  ├── POST /api/orders                     ├── updateOrderStatus()
  ├── PUT  /api/orders/:id/status          ├── updateOrderPayment()
  ├── PUT  /api/orders/:id/payment         ├── createReturn()
  └── POST /api/returns                    └── verifyPin()

SQLite (single source of truth)          No local SQLite for business data
  └── orders, products, returns,           └── local config + session only
      inventory, users, tax profiles

SyncEventBus (in-process)                SyncEventBus (in-process)
  └── stores recent events for polling     └── receives events from server
                                         SyncPoller (polls /api/sync/events every 3s)
```

### Sync Event Types

| Event               | Trigger              |
| ------------------- | -------------------- |
| `order:created`     | New order persisted  |
| `order:updated`     | Order status changed |
| `order:paid`        | Payment completed    |
| `inventory:updated` | Stock level changed  |
| `product:updated`   | Product modified     |
| `shift:opened`      | Shift started        |
| `shift:closed`      | Shift ended          |
| `user:updated`      | User account changed |
| `return:created`    | Return recorded      |
| `config:updated`    | POS config changed   |

### Authentication

Requests are authenticated with an HMAC-SHA256 signature (`services/instoreapi/requestSigning.ts`). The client sends `x-instore-register`, `x-instore-timestamp`, `x-instore-nonce`, and `x-instore-signature` headers; the signature covers `METHOD \n PATH?QUERY \n TIMESTAMP \n NONCE \n sha256(rawBody)`. The server verifies the signature with the shared secret, rejects timestamps outside a ±5-minute window, and rejects reused nonces via an in-memory replay cache. The shared secret itself is never transmitted, and the legacy `x-shared-secret` header is not accepted.

Two routes are exempt: `GET /api/health` (unauthenticated by design so clients can discover the server before holding the secret — it exposes presence only) and `POST /api/webhooks/commercefull` (authenticated by the Commercefull HMAC signature instead).

If no shared secret is configured when the server starts, one is generated (`instore-<32 hex>`) and shown in Settings → Instore API. All registers must run a version that signs requests — mixed-version deployments cannot authenticate.

---

## 1. Ubiquitous Requirements

**1.1** `InstoreApiConfig`, `InstoreApiServer`, `InstoreApiClient`, `InstoreApiDiscovery`, `SyncEventBus`, and `SyncPoller` shall each be singletons.

**1.2** The default mode shall be `standalone` — no networking is active unless explicitly configured.

**1.3** All settings shall be persisted through `ProtectedValueStore` (secure storage first, KV key `'instoreapi.settings'`) and loaded via `instoreApiConfig.load()` at app startup — the shared secret never sits in plaintext SQLite on platforms with secure storage.

**1.4** When `sharedSecret` is non-empty, every request to the server shall carry valid `x-instore-timestamp`, `x-instore-nonce`, and `x-instore-signature` headers (HMAC-SHA256 of the canonical payload), and the server shall reject requests with a missing, malformed, stale, replayed, or mismatched signature with HTTP 401.

**1.5** Every request shall include `x-instore-register` in the signature headers so the server can attribute the request to a register.

**1.6** `SyncPoller` shall only run in `client` mode — it shall refuse to start in `standalone` or `server` mode.

---

## 2. Event-Driven Requirements

### 2.1 Configuration

**2.1.1** When `instoreApiConfig.load()` is called, the system shall read the persisted settings from `keyValueRepository`, merge with defaults (`mode: 'standalone'`, `port: 8787`, `registerName: 'Register 1'`), and return the merged settings.

**2.1.2** When `instoreApiConfig.save(updates)` is called, the system shall merge the updates into the current settings and persist the result to `keyValueRepository`.

**2.1.3** When `InstoreApiSettingsTab` saves in `server` mode, the system shall call `instoreApiServer.start()`.

**2.1.4** When `InstoreApiSettingsTab` saves in `client` or `standalone` mode, the system shall call `instoreApiServer.stop()`.

### 2.2 Server — Lifecycle

**2.2.1** When `instoreApiServer.start()` is called and `instoreApiConfig.isServer` is `true`, the system shall set `running = true` and log the port.

**2.2.2** When `instoreApiServer.start()` is called and `instoreApiConfig.isServer` is `false`, the system shall log a warning and not start.

**2.2.3** When `instoreApiServer.stop()` is called, the system shall set `running = false`.

### 2.3 Server — Request Handling

**2.3.1** When `instoreApiServer.handleRequest(method, path, body, headers)` is called and `running` is `false`, the system shall return `{ status: 503, body: { error: 'Server not running' } }`.

**2.3.2** When the request is not an exempt route (`/api/health`, `/api/webhooks/commercefull`) and its signature headers are missing, malformed, stale (±5 min), replayed, or computed with the wrong secret, the system shall return `{ status: 401, body: { error: 'Unauthorized' } }`. The legacy `x-shared-secret` header shall be ignored.

**2.3.3** When a matching route is found, the system shall call the route handler and return its response.

**2.3.4** When no matching route is found, the system shall return `{ status: 404, body: { error: 'Not found' } }`.

**2.3.5** When a route handler throws, the system shall catch the error and return `{ status: 500, body: { error: 'Internal server error' } }`.

### 2.4 Server — Routes

**2.4.1** `GET /api/health` — returns `{ ok: true, registerId, registerName, timestamp }`.

**2.4.2** `GET /api/orders` — returns all orders, optionally filtered by `status` query param.

**2.4.3** `GET /api/orders/:id` — returns the order row and its items, or 404 if not found.

**2.4.4** `GET /api/orders/unsynced` — returns orders with `status = 'paid'` and `sync_status != 'synced'`.

**2.4.5** `GET /api/products` — returns all products.

**2.4.6** `GET /api/products/:id` — returns a single product, or 404 if not found.

**2.4.7** `GET /api/tax-profiles` — returns all active tax profiles.

**2.4.8** `GET /api/returns` — returns all returns, optionally filtered by `status`.

**2.4.9** `GET /api/returns/order/:orderId` — returns all returns for a specific order.

**2.4.10** `GET /api/sync/events` — returns all events in `SyncEventBus` with `timestamp > since` (from query/body param).

**2.4.11** `POST /api/webhooks/commercefull` — forwards the raw body and headers to `CommercefullWebhookReceiver.handleRequest()`.

**2.4.12** `GET /api/session` — authenticated connection-test route; returns `{ ok: true, registerId, registerName }` only when the request signature is valid. Existence of this route is what makes `testConnection()` meaningful.

**2.4.13** `GET /api/users` — returns `id`, `name`, `role`, `is_active` for all users; PIN hashes and other credential fields are never included.

**2.4.14** `POST /api/users/verify-pin` — verifies a PIN against server-side credentials (used for client-mode login); rate-limited to 10 failures per rolling minute, globally.

**2.4.15** `GET /api/snapshot` — returns a full data snapshot for client-mode initial population.

**2.4.16** `GET /api/categories` — returns all categories.

### 2.5 Client — Connection

**2.5.1** When `instoreApiClient.testConnection()` is called, the system shall call the authenticated `GET /api/session` route on the configured server URL and set `connected = true` on success or `false` on failure — an unauthenticated health probe cannot detect a wrong secret.

**2.5.2** When `instoreApiClient.probeHealth(baseUrl, timeoutMs)` is called, the system shall attempt an unauthenticated `GET /api/health` with a timeout and return the health response or `null` on failure. Discovery probes shall never send the shared secret.

**2.5.3** When any client request fails (non-2xx or network error), the system shall throw an error with the server's error message or a generic message.

### 2.6 Discovery — Subnet Scan

**2.6.1** When `instoreApiDiscovery.scanSubnet(subnetPrefix?, onProgress?)` is called, the system shall scan IPs `{prefix}.1` through `{prefix}.254` on the configured port in batches of 20, calling `probeHealth` on each address with a 2-second timeout.

**2.6.2** When `probeAddress` returns a non-null result, the system shall add the server to the `discovered` list.

**2.6.3** When `onProgress` is provided, the system shall call it after each IP is checked with `(checked, total)` counts.

**2.6.4** When `scanSubnet` is already running, subsequent calls shall return an empty array immediately.

**2.6.5** When `instoreApiDiscovery.connectToServer(server)` is called, the system shall save the server address and port to `instoreApiConfig`, then call `instoreApiClient.testConnection()` and return the result.

### 2.7 Sync Event Bus

**2.7.1** When `syncEventBus.emit(type, payload)` is called, the system shall create a `SyncEvent` with a unique ID, the current `registerId`, `registerName`, and `timestamp`, append it to `recentEvents` (capped at 500), and dispatch it to all registered handlers.

**2.7.2** When `syncEventBus.receive(event)` is called with an event from a different register (`event.registerId !== instoreApiConfig.current.registerId`), the system shall dispatch it to all registered handlers without storing it in `recentEvents`.

**2.7.3** When `syncEventBus.receive(event)` is called with an event from the same register, the system shall silently discard it — no re-dispatch.

**2.7.4** When `syncEventBus.getEventsSince(sinceTimestamp)` is called, the system shall return all `recentEvents` with `timestamp > sinceTimestamp`.

**2.7.5** When a handler throws during dispatch, the system shall catch the error, log it, and continue dispatching to remaining handlers.

### 2.8 Sync Poller

**2.8.1** When `syncPoller.start(intervalMs?)` is called in `client` mode, the system shall begin polling `GET /api/sync/events` at the configured interval (default 3000ms), starting from `Date.now() - 60000` (1 minute back).

**2.8.2** When the poll returns events, the system shall call `syncEventBus.receive(event)` for each and update `lastTimestamp` to the highest event timestamp.

**2.8.3** When the poll throws, the system shall increment `consecutiveErrors` and apply exponential backoff: `min(interval * 2^errors, 30000ms)`. Errors 1–3 are logged as warnings; subsequent errors are silent.

**2.8.4** When `syncPoller.stop()` is called, the system shall clear the scheduled timeout and set `running = false`.

**2.8.5** When `consecutiveErrors` resets to 0 (successful poll), the system shall resume the normal poll interval.

### 2.9 Server — Write Endpoints

All write endpoints validate their payloads before touching repositories — type, bounds, and field allowlists are enforced server-side so a malformed or hostile LAN client cannot write invalid rows.

**2.9.1** `POST /api/orders` — the server shall accept a `CreateOrderInput` body (validating shape, amounts, and the item array), call `orderRepository.create()`, emit `syncEventBus.emit('order:created', order)`, and return the created order row.

**2.9.2** `PUT /api/orders/:id/status` — the server shall accept a `{ status }` body restricted to `pending | processing | paid | synced | failed | cancelled`, call `orderRepository.updateStatus()`, emit `syncEventBus.emit('order:updated', { id, status })`, and return the updated row.

**2.9.3** `PUT /api/orders/:id/payment` — the server shall accept `{ paymentMethod, transactionId }` (bounded strings), call `orderRepository.updatePayment()`, emit `syncEventBus.emit('order:paid', { id })`, and return the updated row.

**2.9.4** `POST /api/returns` — the server shall accept a `CreateReturnInput` body, run `validateReturnRequest` (paid/synced order, per-line quantity caps, cumulative refund ≤ order total), call `returnRepository.create()`, emit `syncEventBus.emit('return:created', returnRow)`, and return the created return ID.

**2.9.5** `POST /api/categories`, `PUT /api/categories/:id`, `DELETE /api/categories/:id` — category write routes with field allowlists and size limits.

**2.9.6** `POST /api/products`, `PUT /api/products/:id`, `DELETE /api/products/:id` — product write routes with field allowlists and size limits.

### 2.10 Client-Mode Repository Injection

Client registers route data access through HTTP repositories selected by the repository factory — when `instoreApiConfig.isClient` is `true`, `OrderRepository` resolves to `InstoreApiOrderRepository` and the return repository resolves to `InstoreApiReturnRepository`, which call `InstoreApiClient` instead of local SQLite (ADR-003).

**2.10.1** When `instoreApiConfig.isClient` is `true`, order creation and payment writes go to the server's `POST /api/orders` and `PUT /api/orders/:id/payment` — the order is written to the server's SQLite, not the client's.

**2.10.2** When `instoreApiConfig.isClient` is `true`, returns are written via `POST /api/returns` and validated server-side as well as locally.

**2.10.3** When `instoreApiConfig.isClient` is `true`, `useProducts` and `useCategories` shall fetch data from `instoreApiClient.getProducts()` and `instoreApiClient.getTaxProfiles()` instead of local SQLite repositories.

---

## 3. State-Driven Requirements

**3.1** While `instoreApiConfig.isServer` is `true`, `instoreApiServer.start()` is valid and `SyncPoller` shall not run.

**3.2** While `instoreApiConfig.isClient` is `true`, `SyncPoller` shall run and `InstoreApiServer` shall not be started.

**3.3** While `instoreApiConfig.isStandalone` is `true`, neither `InstoreApiServer` nor `SyncPoller` shall be active.

**3.4** While `instoreApiServer.isRunning` is `false`, all `handleRequest` calls shall return 503.

**3.5** While `instoreApiDiscovery.isScanning` is `true`, subsequent `scanSubnet` calls shall return an empty array immediately.

**3.6** While `instoreApiClient.isConnected` is `false`, client data-fetch methods will throw on network failure — callers must handle errors gracefully.

---

## 4. Known Gaps

**4.1** **No shift API** — `InstoreApiServer` has no `/api/shifts*` routes and there is no `ShiftRepository`, so client-mode shift management is non-functional.

**4.2** **No basket sharing** — the basket is local to each register. A customer's in-progress order on one register cannot be transferred to another register via the local API.

**4.3** **Subnet scan is hardcoded to `192.168.1.x`** — the default prefix is `192.168.1`. Networks using `10.x.x.x` or `172.16.x.x` require the caller to pass the correct `subnetPrefix`. There is no automatic subnet detection.

**4.4** **No mDNS/Bonjour** — discovery relies on brute-force subnet scanning (254 probes). On larger networks this is slow. The code comments note mDNS as a future improvement.

**4.5** **SyncEventBus events are not acted upon** — `SyncPoller` delivers events to `SyncEventBus`, but no service currently subscribes to `syncEventBus.on(type, handler)` to update local state (e.g. refresh product cache when `product:updated` arrives). The event infrastructure is in place but the consumer side is not wired.

**4.6** **One shared secret authorizes all routes** — requests are HMAC-signed (the secret is never transmitted and replays are rejected), but any register holding the secret can invoke every route, and the protocol has no per-register identity, scoping, revocation, or rotation. Per-register credentials and encrypted transport (TLS/overlay) remain architectural work.

---

## 5. Component Traceability

| Requirement (summary)                     | Component / Service                                  | Source File                                       |
| ----------------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| Mode: standalone / server / client        | `InstoreApiConfig`                                   | `services/instoreapi/InstoreApiConfig.ts`         |
| Settings persisted to KV store            | `InstoreApiConfig.save` / `load`                     | `services/instoreapi/InstoreApiConfig.ts`         |
| `baseUrl` computed from mode              | `InstoreApiConfig.baseUrl`                           | `services/instoreapi/InstoreApiConfig.ts`         |
| Server start/stop                         | `InstoreApiServer.start` / `stop`                    | `services/instoreapi/InstoreApiServer.ts`         |
| Route matching with `:param` segments     | `InstoreApiServer.matchPath`                         | `services/instoreapi/InstoreApiServer.ts`         |
| 401 on bad/missing/replayed signature     | `InstoreApiServer.handleRequest`                     | `services/instoreapi/InstoreApiServer.ts`         |
| HMAC sign/verify helpers                  | `signRequest` / `verifySignedRequest`                | `services/instoreapi/requestSigning.ts`           |
| HTTP listener binding                     | `InstoreApiTransport` (`react-native-http-bridge`)   | `services/instoreapi/InstoreApiTransport.ts`      |
| 503 when not running                      | `InstoreApiServer.handleRequest`                     | `services/instoreapi/InstoreApiServer.ts`         |
| All GET routes registered                 | `InstoreApiServer.registerRoutes`                    | `services/instoreapi/InstoreApiServer.ts`         |
| Commercefull webhook forwarding           | `InstoreApiServer` POST `/api/webhooks/commercefull` | `services/instoreapi/InstoreApiServer.ts`         |
| Subnet scan in batches of 20              | `InstoreApiDiscovery.scanSubnet`                     | `services/instoreapi/InstoreApiDiscovery.ts`      |
| 2-second probe timeout                    | `InstoreApiDiscovery.probeAddress`                   | `services/instoreapi/InstoreApiDiscovery.ts`      |
| `connectToServer` saves config + tests    | `InstoreApiDiscovery.connectToServer`                | `services/instoreapi/InstoreApiDiscovery.ts`      |
| `testConnection` → `GET /api/session`     | `InstoreApiClient.testConnection`                    | `services/clients/instoreapi/InstoreApiClient.ts` |
| Signed request headers on all requests    | `InstoreApiClient.buildSignedHeaders`                | `services/instoreapi/requestSigning.ts`           |
| `getSyncEvents(since)`                    | `InstoreApiClient.getSyncEvents`                     | `services/clients/instoreapi/InstoreApiClient.ts` |
| Event stored in `recentEvents` (cap 500)  | `SyncEventBus.emit`                                  | `services/instoreapi/sync/SyncEventBus.ts`        |
| Own-register events not re-dispatched     | `SyncEventBus.receive`                               | `services/instoreapi/sync/SyncEventBus.ts`        |
| `getEventsSince(ts)` for polling endpoint | `SyncEventBus.getEventsSince`                        | `services/instoreapi/sync/SyncEventBus.ts`        |
| Handler errors caught, dispatch continues | `SyncEventBus.dispatch`                              | `services/instoreapi/sync/SyncEventBus.ts`        |
| Poll every 3s, starts 1 min back          | `SyncPoller.start`                                   | `services/instoreapi/sync/SyncPoller.ts`          |
| Exponential backoff on poll errors        | `SyncPoller.schedulePoll`                            | `services/instoreapi/sync/SyncPoller.ts`          |
| Max backoff 30s                           | `SyncPoller.MAX_BACKOFF_MS`                          | `services/instoreapi/sync/SyncPoller.ts`          |
| Client-mode only guard                    | `SyncPoller.start`                                   | `services/instoreapi/sync/SyncPoller.ts`          |
| Settings UI: mode / port / secret / name  | `InstoreApiSettingsTab`                              | `screens/settings/InstoreApiSettingsTab.tsx`      |
| Scan network button with progress         | `InstoreApiSettingsTab.handleScan`                   | `screens/settings/InstoreApiSettingsTab.tsx`      |
| Select discovered server → auto-connect   | `InstoreApiSettingsTab.handleSelectServer`           | `screens/settings/InstoreApiSettingsTab.tsx`      |
