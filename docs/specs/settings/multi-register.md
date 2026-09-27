# Multi-Register (Local API) – EARS Requirements

> **System**: RetailPOS – Multi-Register Local API
> **Actor**: Manager, Admin, System
> **Date**: 2026-04-13
> **Source**: `services/localapi/LocalApiConfig.ts`, `services/localapi/LocalApiServer.ts`, `services/localapi/LocalApiDiscovery.ts`, `services/localapi/sync/SyncEventBus.ts`, `services/localapi/sync/SyncEventTypes.ts`, `services/localapi/sync/SyncPoller.ts`, `services/clients/localapi/LocalApiClient.ts`, `screens/settings/LocalApiSettingsTab.tsx`

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

The architecture is a lightweight HTTP server running inside the React Native app. Because React Native cannot run a traditional Node.js HTTP server, `LocalApiServer` provides the **route logic layer** only — the actual transport binding (HTTP listener) is expected to be provided by a native module or Electron IPC in the main process.

**What is implemented:**

- Route logic for all read endpoints (orders, products, tax profiles, returns, sync events)
- `LocalApiClient` HTTP client for all read operations
- `SyncEventBus` + `SyncPoller` for real-time event propagation
- `LocalApiDiscovery` for subnet scanning
- Configuration persistence

**What is not yet implemented (gaps):**

- Write endpoints on the server (POST orders, PUT order status, POST returns)
- Client-side service overrides that route writes to the server instead of local SQLite
- HTTP transport layer (actual listener)
- SyncEventBus consumer handlers

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
LocalApiServer (route logic)             LocalApiClient (HTTP fetch)
  ├── GET  /api/health                     ├── testConnection()
  ├── GET  /api/orders[/:id]               ├── getOrders() / getOrder()
  ├── GET  /api/orders/unsynced            ├── getUnsyncedOrders()
  ├── GET  /api/products[/:id]             ├── getProducts() / getProduct()
  ├── GET  /api/tax-profiles               ├── getTaxProfiles()
  ├── GET  /api/returns[/order/:id]        ├── getReturns() / getReturnsByOrder()
  ├── GET  /api/sync/events                ├── getSyncEvents(since)
  │                                        │
  ├── POST /api/orders          ← GAP      ├── createOrder()          ← GAP
  ├── PUT  /api/orders/:id      ← GAP      ├── updateOrderStatus()    ← GAP
  └── POST /api/returns         ← GAP      └── createReturn()         ← GAP

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

All requests include `x-shared-secret` header. The server validates this against `localApiConfig.current.sharedSecret`. If the secret is empty, authentication is skipped.

---

## 1. Ubiquitous Requirements

**1.1** `LocalApiConfig`, `LocalApiServer`, `LocalApiClient`, `LocalApiDiscovery`, `SyncEventBus`, and `SyncPoller` shall each be singletons.

**1.2** The default mode shall be `standalone` — no networking is active unless explicitly configured.

**1.3** All settings shall be persisted to `keyValueRepository` under the key `'localapi.settings'` and loaded via `localApiConfig.load()` at app startup.

**1.4** When `sharedSecret` is non-empty, every request to the server shall include `x-shared-secret` in the request headers, and the server shall reject requests with a mismatched or missing secret with HTTP 401.

**1.5** Every request shall include `X-Register-Id` in the request headers so the server can identify which register made the request.

**1.6** `SyncPoller` shall only run in `client` mode — it shall refuse to start in `standalone` or `server` mode.

---

## 2. Event-Driven Requirements

### 2.1 Configuration

**2.1.1** When `localApiConfig.load()` is called, the system shall read the persisted settings from `keyValueRepository`, merge with defaults (`mode: 'standalone'`, `port: 8787`, `registerName: 'Register 1'`), and return the merged settings.

**2.1.2** When `localApiConfig.save(updates)` is called, the system shall merge the updates into the current settings and persist the result to `keyValueRepository`.

**2.1.3** When `LocalApiSettingsTab` saves in `server` mode, the system shall call `localApiServer.start()`.

**2.1.4** When `LocalApiSettingsTab` saves in `client` or `standalone` mode, the system shall call `localApiServer.stop()`.

### 2.2 Server — Lifecycle

**2.2.1** When `localApiServer.start()` is called and `localApiConfig.isServer` is `true`, the system shall set `running = true` and log the port.

**2.2.2** When `localApiServer.start()` is called and `localApiConfig.isServer` is `false`, the system shall log a warning and not start.

**2.2.3** When `localApiServer.stop()` is called, the system shall set `running = false`.

### 2.3 Server — Request Handling

**2.3.1** When `localApiServer.handleRequest(method, path, body, headers)` is called and `running` is `false`, the system shall return `{ status: 503, body: { error: 'Server not running' } }`.

**2.3.2** When `sharedSecret` is set and the request's `x-shared-secret` header does not match, the system shall return `{ status: 401, body: { error: 'Unauthorized' } }`.

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

### 2.5 Client — Connection

**2.5.1** When `localApiClient.testConnection()` is called, the system shall call `GET /api/health` on the configured server URL and set `connected = true` on success or `false` on failure.

**2.5.2** When `localApiClient.probeHealth(baseUrl, secret, timeoutMs)` is called, the system shall attempt `GET /api/health` with a timeout and return the health response or `null` on failure.

**2.5.3** When any client request fails (non-2xx or network error), the system shall throw an error with the server's error message or a generic message.

### 2.6 Discovery — Subnet Scan

**2.6.1** When `localApiDiscovery.scanSubnet(subnetPrefix?, onProgress?)` is called, the system shall scan IPs `{prefix}.1` through `{prefix}.254` on the configured port in batches of 20, calling `probeHealth` on each address with a 2-second timeout.

**2.6.2** When `probeAddress` returns a non-null result, the system shall add the server to the `discovered` list.

**2.6.3** When `onProgress` is provided, the system shall call it after each IP is checked with `(checked, total)` counts.

**2.6.4** When `scanSubnet` is already running, subsequent calls shall return an empty array immediately.

**2.6.5** When `localApiDiscovery.connectToServer(server)` is called, the system shall save the server address and port to `localApiConfig`, then call `localApiClient.testConnection()` and return the result.

### 2.7 Sync Event Bus

**2.7.1** When `syncEventBus.emit(type, payload)` is called, the system shall create a `SyncEvent` with a unique ID, the current `registerId`, `registerName`, and `timestamp`, append it to `recentEvents` (capped at 500), and dispatch it to all registered handlers.

**2.7.2** When `syncEventBus.receive(event)` is called with an event from a different register (`event.registerId !== localApiConfig.current.registerId`), the system shall dispatch it to all registered handlers without storing it in `recentEvents`.

**2.7.3** When `syncEventBus.receive(event)` is called with an event from the same register, the system shall silently discard it — no re-dispatch.

**2.7.4** When `syncEventBus.getEventsSince(sinceTimestamp)` is called, the system shall return all `recentEvents` with `timestamp > sinceTimestamp`.

**2.7.5** When a handler throws during dispatch, the system shall catch the error, log it, and continue dispatching to remaining handlers.

### 2.8 Sync Poller

**2.8.1** When `syncPoller.start(intervalMs?)` is called in `client` mode, the system shall begin polling `GET /api/sync/events` at the configured interval (default 3000ms), starting from `Date.now() - 60000` (1 minute back).

**2.8.2** When the poll returns events, the system shall call `syncEventBus.receive(event)` for each and update `lastTimestamp` to the highest event timestamp.

**2.8.3** When the poll throws, the system shall increment `consecutiveErrors` and apply exponential backoff: `min(interval * 2^errors, 30000ms)`. Errors 1–3 are logged as warnings; subsequent errors are silent.

**2.8.4** When `syncPoller.stop()` is called, the system shall clear the scheduled timeout and set `running = false`.

**2.8.5** When `consecutiveErrors` resets to 0 (successful poll), the system shall resume the normal poll interval.

### 2.9 Intended — Write Endpoints (not yet implemented)

The following requirements describe the intended behaviour once write endpoints are added. They are included here to guide implementation.

**2.9.1** `POST /api/orders` — the server shall accept a `CreateOrderInput` body, call `orderRepository.create()`, emit `syncEventBus.emit('order:created', order)`, and return the created order row.

**2.9.2** `PUT /api/orders/:id/status` — the server shall accept a `{ status }` body, call `orderRepository.updateStatus()`, emit `syncEventBus.emit('order:updated', { id, status })`, and return the updated row.

**2.9.3** `PUT /api/orders/:id/payment` — the server shall accept `{ paymentMethod, transactionId }`, call `orderRepository.updatePayment()`, emit `syncEventBus.emit('order:paid', { id })`, and return the updated row.

**2.9.4** `POST /api/returns` — the server shall accept a `CreateReturnInput` body, call `returnRepository.create()`, emit `syncEventBus.emit('return:created', returnRow)`, and return the created return ID.

### 2.10 Intended — Client-Mode Service Overrides (not yet implemented)

**2.10.1** When `localApiConfig.isClient` is `true`, `CheckoutService.startCheckout()` shall call `localApiClient.createOrder(input)` instead of `orderRepository.create()` — the order is written to the server's SQLite, not the client's.

**2.10.2** When `localApiConfig.isClient` is `true`, `CheckoutService.completePayment()` shall call `localApiClient.updateOrderPayment(orderId, paymentMethod, transactionId)` instead of `orderRepository.updatePayment()`.

**2.10.3** When `localApiConfig.isClient` is `true`, `RefundService.processReturn()` shall call `localApiClient.createReturn(input)` instead of `returnRepository.create()`.

**2.10.4** When `localApiConfig.isClient` is `true`, `useProducts` and `useCategories` shall fetch data from `localApiClient.getProducts()` and `localApiClient.getTaxProfiles()` instead of local SQLite repositories.

---

## 3. State-Driven Requirements

**3.1** While `localApiConfig.isServer` is `true`, `localApiServer.start()` is valid and `SyncPoller` shall not run.

**3.2** While `localApiConfig.isClient` is `true`, `SyncPoller` shall run and `LocalApiServer` shall not be started.

**3.3** While `localApiConfig.isStandalone` is `true`, neither `LocalApiServer` nor `SyncPoller` shall be active.

**3.4** While `localApiServer.isRunning` is `false`, all `handleRequest` calls shall return 503.

**3.5** While `localApiDiscovery.isScanning` is `true`, subsequent `scanSubnet` calls shall return an empty array immediately.

**3.6** While `localApiClient.isConnected` is `false`, client data-fetch methods will throw on network failure — callers must handle errors gracefully.

---

## 4. Known Gaps

**4.1** **No transport layer** — `LocalApiServer` provides route logic only. There is no actual HTTP listener in the current codebase. A native module (e.g. `react-native-http-bridge`) or Electron IPC handler in the main process must call `localApiServer.handleRequest()` for the server to be reachable by other devices. Without this, `server` mode is non-functional on mobile/tablet.

**4.2** **No write endpoints** — the server exposes only `GET` routes. The intended design requires client registers to write orders and returns to the server. The following endpoints need to be added to `LocalApiServer` and `LocalApiClient`:

- `POST /api/orders` — create a new order on the server
- `PUT /api/orders/:id/status` — update order status (processing, paid, cancelled)
- `PUT /api/orders/:id/payment` — record payment (completes the order)
- `POST /api/returns` — record a return on the server

**4.3** **No client-side service overrides** — when a register is in `client` mode, `CheckoutService`, `BasketService`, and `RefundService` still write to local SQLite. They need to detect `localApiConfig.isClient` and route writes through `LocalApiClient` instead. This is the core wiring needed to make client registers truly thin.

**4.4** **No basket sharing** — the basket is local to each register. A customer's in-progress order on one register cannot be transferred to another register via the local API.

**4.5** **Subnet scan is hardcoded to `192.168.1.x`** — the default prefix is `192.168.1`. Networks using `10.x.x.x` or `172.16.x.x` require the caller to pass the correct `subnetPrefix`. There is no automatic subnet detection.

**4.6** **No mDNS/Bonjour** — discovery relies on brute-force subnet scanning (254 probes). On larger networks this is slow. The code comments note mDNS as a future improvement.

**4.7** **SyncEventBus events are not acted upon** — `SyncPoller` delivers events to `SyncEventBus`, but no service currently subscribes to `syncEventBus.on(type, handler)` to update local state (e.g. refresh product cache when `product:updated` arrives). The event infrastructure is in place but the consumer side is not wired.

**4.8** **No authentication beyond shared secret** — there is no per-register certificate, token rotation, or TLS. The shared secret is transmitted in plain HTTP headers. This is acceptable for a trusted LAN but not for untrusted networks.

---

## 5. Component Traceability

| Requirement (summary)                     | Component / Service                                | Source File                                   |
| ----------------------------------------- | -------------------------------------------------- | --------------------------------------------- |
| Mode: standalone / server / client        | `LocalApiConfig`                                   | `services/localapi/LocalApiConfig.ts`         |
| Settings persisted to KV store            | `LocalApiConfig.save` / `load`                     | `services/localapi/LocalApiConfig.ts`         |
| `baseUrl` computed from mode              | `LocalApiConfig.baseUrl`                           | `services/localapi/LocalApiConfig.ts`         |
| Server start/stop                         | `LocalApiServer.start` / `stop`                    | `services/localapi/LocalApiServer.ts`         |
| Route matching with `:param` segments     | `LocalApiServer.matchPath`                         | `services/localapi/LocalApiServer.ts`         |
| 401 on bad shared secret                  | `LocalApiServer.handleRequest`                     | `services/localapi/LocalApiServer.ts`         |
| 503 when not running                      | `LocalApiServer.handleRequest`                     | `services/localapi/LocalApiServer.ts`         |
| All GET routes registered                 | `LocalApiServer.registerRoutes`                    | `services/localapi/LocalApiServer.ts`         |
| Commercefull webhook forwarding           | `LocalApiServer` POST `/api/webhooks/commercefull` | `services/localapi/LocalApiServer.ts`         |
| Subnet scan in batches of 20              | `LocalApiDiscovery.scanSubnet`                     | `services/localapi/LocalApiDiscovery.ts`      |
| 2-second probe timeout                    | `LocalApiDiscovery.probeAddress`                   | `services/localapi/LocalApiDiscovery.ts`      |
| `connectToServer` saves config + tests    | `LocalApiDiscovery.connectToServer`                | `services/localapi/LocalApiDiscovery.ts`      |
| `testConnection` → `GET /api/health`      | `LocalApiClient.testConnection`                    | `services/clients/localapi/LocalApiClient.ts` |
| `X-Register-Id` header on all requests    | `LocalApiClient.headers`                           | `services/clients/localapi/LocalApiClient.ts` |
| `getSyncEvents(since)`                    | `LocalApiClient.getSyncEvents`                     | `services/clients/localapi/LocalApiClient.ts` |
| Event stored in `recentEvents` (cap 500)  | `SyncEventBus.emit`                                | `services/localapi/sync/SyncEventBus.ts`      |
| Own-register events not re-dispatched     | `SyncEventBus.receive`                             | `services/localapi/sync/SyncEventBus.ts`      |
| `getEventsSince(ts)` for polling endpoint | `SyncEventBus.getEventsSince`                      | `services/localapi/sync/SyncEventBus.ts`      |
| Handler errors caught, dispatch continues | `SyncEventBus.dispatch`                            | `services/localapi/sync/SyncEventBus.ts`      |
| Poll every 3s, starts 1 min back          | `SyncPoller.start`                                 | `services/localapi/sync/SyncPoller.ts`        |
| Exponential backoff on poll errors        | `SyncPoller.schedulePoll`                          | `services/localapi/sync/SyncPoller.ts`        |
| Max backoff 30s                           | `SyncPoller.MAX_BACKOFF_MS`                        | `services/localapi/sync/SyncPoller.ts`        |
| Client-mode only guard                    | `SyncPoller.start`                                 | `services/localapi/sync/SyncPoller.ts`        |
| Settings UI: mode / port / secret / name  | `LocalApiSettingsTab`                              | `screens/settings/LocalApiSettingsTab.tsx`    |
| Scan network button with progress         | `LocalApiSettingsTab.handleScan`                   | `screens/settings/LocalApiSettingsTab.tsx`    |
| Select discovered server → auto-connect   | `LocalApiSettingsTab.handleSelectServer`           | `screens/settings/LocalApiSettingsTab.tsx`    |
