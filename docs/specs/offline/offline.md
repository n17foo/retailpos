# Offline & Multi-Register – EARS Requirements

> **System**: RetailPOS – Offline Operation & Multi-Register Data Flow
> **Actor**: Cashier, Manager, Admin, System
> **Date**: 2026-04-13
> **Source**: `services/instoreapi/InstoreApiConfig.ts`, `services/instoreapi/InstoreApiServer.ts`, `services/instoreapi/InstoreApiDiscovery.ts`, `services/instoreapi/sync/SyncEventBus.ts`, `services/instoreapi/sync/SyncPoller.ts`, `services/clients/instoreapi/InstoreApiClient.ts`, `repositories/OrderRepository.ts`, `repositories/ReturnRepository.ts`, `repositories/InstoreApiOrderRepository.ts`, `repositories/InstoreApiReturnRepository.ts`, `services/checkout/CheckoutService.ts`, `services/refunds/RefundService.ts`, `services/basket/BasketServiceFactory.ts`, `App.tsx`

---

## Context

The POS operates in one of three modes. The mode determines where data is read from and written to:

| Mode         | Data source            | Data writes            | Networking                  |
| ------------ | ---------------------- | ---------------------- | --------------------------- |
| `standalone` | Local SQLite           | Local SQLite           | None                        |
| `server`     | Local SQLite           | Local SQLite           | Hosts HTTP API for clients  |
| `client`     | Server register (HTTP) | Server register (HTTP) | Connects to server over LAN |

**Standalone** is the default — a single register, fully self-contained. This is also the "POS offline" mode: no internet required, all data lives in SQLite on the device.

**Server** mode turns the register into the single source of truth. It hosts a local HTTP API that client registers connect to. All business data (products, categories, orders, returns) lives in the server's SQLite.

**Client** mode makes the register a **thin interface**. It has no local business data — it reads everything from the server and writes everything back to the server. The client's local SQLite is only used for config and session state.

### Architecture: Repository Abstraction Pattern

The mode routing decision is made at the **repository layer**, not the service layer. Services (`CheckoutService`, `RefundService`) have no knowledge of the current mode — they only call repository interface methods.

```
OrderRepository (interface in OrderRepository.ts)
  ├── OfflineOrderRepository  — SQLite, standalone/server mode
  └── InstoreApiOrderRepository — HTTP to server, client mode

ReturnRepository (interface in ReturnRepository.ts)
  ├── OfflineReturnRepository  — SQLite, standalone/server mode
  └── InstoreApiReturnRepository — HTTP to server, client mode

getOrderRepository()  → checks instoreApiConfig.isClient, returns right implementation
getReturnRepository() → same pattern

BasketServiceFactory.buildContainer()
  → calls getOrderRepository() and getReturnRepository()
  → injects results into CheckoutService, OrderSyncService, RefundService
```

### Repository Naming Convention

| Interface          | SQLite implementation     | Client implementation        |
| ------------------ | ------------------------- | ---------------------------- |
| `OrderRepository`  | `OfflineOrderRepository`  | `InstoreApiOrderRepository`  |
| `ReturnRepository` | `OfflineReturnRepository` | `InstoreApiReturnRepository` |

The interface takes the plain name. The SQLite class is prefixed `Offline`. The HTTP class is prefixed `InstoreApi`. No `I`-prefix on interfaces.

### What changes per mode

| Operation                     | Standalone / Server                          | Client                                                          |
| ----------------------------- | -------------------------------------------- | --------------------------------------------------------------- |
| Load products (Offline tab)   | `offlineProductService` → SQLite             | `offlineProductService` → SQLite (server manages its own data)  |
| Load categories (Offline tab) | `offlineCategoryService` → SQLite            | `offlineCategoryService` → SQLite (server manages its own data) |
| Load products (Order screen)  | `ProductServiceFactory` → platform or SQLite | `ProductServiceFactory` → platform or SQLite                    |
| Create order                  | `OrderRepository.createWithItems()` → SQLite | `InstoreApiOrderRepository.createWithItems()` → HTTP            |
| Complete payment              | `OrderRepository.updatePayment()` → SQLite   | `InstoreApiOrderRepository.updatePayment()` → HTTP              |
| Create return                 | `ReturnRepository.create()` → SQLite         | `InstoreApiReturnRepository.create()` → HTTP                    |
| Load order history            | `OrderRepository.findByDateRange()` → SQLite | `InstoreApiOrderRepository.findByDateRange()` → HTTP            |

### useOfflineProducts and useOfflineCategories

These hooks are for the **server/standalone register** to manage its own product and category data via the Offline tab. They always use `offlineProductService` and `offlineCategoryService` (local SQLite) regardless of mode.

Client registers do not manage products directly. They read products through the normal `useProducts` hook which goes through `ProductServiceFactory`.

---

## 1. Ubiquitous Requirements

**1.1** `instoreApiConfig.load()` shall be called at app startup before any data operation. The loaded mode determines all subsequent routing decisions.

**1.2** In `standalone` and `server` modes, all business data reads and writes shall go directly to local SQLite repositories — no HTTP calls are made for business data.

**1.3** In `client` mode, all business data reads and writes shall go through `InstoreApiClient` — local SQLite repositories are not used for business data.

**1.4** The mode routing decision shall be made at the **repository layer** via `BasketServiceFactory` — UI components and services shall not need to know the current mode.

**1.5** In `server` mode, every write operation shall emit a `SyncEvent` via `syncEventBus.emit()` so connected client registers are notified.

**1.6** In `client` mode, `SyncPoller` shall run and deliver server events to `syncEventBus`. Hooks that manage local state shall subscribe to relevant event types and refresh their data on receipt.

---

## 2. Event-Driven Requirements

### 2.1 Standalone / Server Mode — Products & Categories (Offline Tab)

**2.1.1** When `useOfflineProducts.loadProducts()` is called, the system shall call `offlineProductService.getProducts()` which reads from local SQLite.

**2.1.2** When `useOfflineProducts.createProduct(data)` is called, the system shall call `offlineProductService.createProduct(data)`, reload the product list, and emit `syncEventBus.emit('product:updated', product)` in server mode.

**2.1.3** When `useOfflineProducts.updateProduct(id, data)` is called, the system shall call `offlineProductService.updateProduct(id, data)`, reload, and emit in server mode.

**2.1.4** When `useOfflineProducts.deleteProduct(id)` is called, the system shall call `offlineProductService.deleteProduct(id)`, reload, and emit in server mode.

**2.1.5** The same pattern applies to `useOfflineCategories` — all operations route through `offlineCategoryService` and emit `'config:updated'` in server mode.

### 2.2 Standalone / Server Mode — Checkout

**2.2.1** When `CheckoutService.startCheckout()` is called, the system shall call `orderRepo.createWithItems(orderInput, lineItems)` which (via `OrderRepository`) persists the order to local SQLite, then emits `syncEventBus.emit('order:created', order)` in server mode.

**2.2.2** When `CheckoutService.completePayment()` is called, the system shall call `orderRepo.updatePayment()` (via `OrderRepository`) and emit `syncEventBus.emit('order:paid', { orderId })` in server mode.

### 2.3 Client Mode — Checkout

**2.3.1** When `CheckoutService.startCheckout()` is called in `client` mode, the system shall call `orderRepo.createWithItems(orderInput, lineItems)` which (via `InstoreApiOrderRepository`) calls `instoreApiClient.createOrder(order, items)` to write the order to the server's SQLite.

**2.3.2** When `CheckoutService.completePayment()` is called in `client` mode, the system shall call `orderRepo.updatePayment()` which (via `InstoreApiOrderRepository`) calls `instoreApiClient.updateOrderPayment()`.

**2.3.3** When `CheckoutService.cancelOrder()` is called in `client` mode, the system shall call `orderRepo.updateStatus(orderId, 'cancelled')` which (via `InstoreApiOrderRepository`) calls `instoreApiClient.updateOrderStatus()`.

### 2.4 Standalone / Server Mode — Returns

**2.4.1** When `RefundService.processReturn()` is called, the system shall call `returnRepo.create()` and `returnRepo.updateStatus()` which (via `ReturnRepository`) persist the return to local SQLite, then emit `syncEventBus.emit('return:created', returnRow)` in server mode.

### 2.5 Client Mode — Returns

**2.5.1** When `RefundService.processReturn()` is called in `client` mode, the system shall call `returnRepo.create()` which (via `InstoreApiReturnRepository`) calls `instoreApiClient.createReturn()` to write the return to the server's SQLite.

### 2.6 Server — Write Endpoints (to be implemented)

**2.6.1** `POST /api/orders` — accepts `{ order: CreateOrderInput, items: CreateOrderItemInput[] }`, calls `orderRepository.create()` + `orderItemRepository.createMany()`, emits `'order:created'`, returns the created order row.

**2.6.2** `PUT /api/orders/:id/status` — accepts `{ status }`, calls `orderRepository.updateStatus()`, emits `'order:updated'`, returns the updated row.

**2.6.3** `PUT /api/orders/:id/payment` — accepts `{ paymentMethod, transactionId }`, calls `orderRepository.updatePayment()`, emits `'order:paid'`, returns the updated row.

**2.6.4** `POST /api/returns` — accepts `CreateReturnInput`, calls `returnRepository.create()` + `returnRepository.updateStatus('completed')`, emits `'return:created'`, returns the return ID.

**2.6.5** `POST /api/products` — accepts product data, calls `offlineProductService.createProduct()`, emits `'product:updated'`, returns the created product.

**2.6.6** `PUT /api/products/:id` — accepts partial product data, calls `offlineProductService.updateProduct()`, emits `'product:updated'`, returns the updated product.

**2.6.7** `DELETE /api/products/:id` — calls `offlineProductService.deleteProduct()`, emits `'product:updated'`, returns `{ ok: true }`.

**2.6.8** `POST /api/categories` — accepts category data, calls `offlineCategoryService.addCategory()`, emits `'config:updated'`, returns the created category.

**2.6.9** `PUT /api/categories/:id` — accepts partial category data, calls `offlineCategoryService.updateCategory()`, emits `'config:updated'`, returns the updated category.

**2.6.10** `DELETE /api/categories/:id` — calls `offlineCategoryService.deleteCategory()`, emits `'config:updated'`, returns `{ ok: true }`.

### 2.7 Client — Write Methods (to be implemented)

**2.7.1** `InstoreApiClient.createOrder(input, items)` → `POST /api/orders`

**2.7.2** `InstoreApiClient.updateOrderStatus(id, status)` → `PUT /api/orders/:id/status`

**2.7.3** `InstoreApiClient.updateOrderPayment(id, method, txId)` → `PUT /api/orders/:id/payment`

**2.7.4** `InstoreApiClient.createReturn(input)` → `POST /api/returns`

**2.7.5** `InstoreApiClient.createProduct(data)` → `POST /api/products`

**2.7.6** `InstoreApiClient.updateProduct(id, data)` → `PUT /api/products/:id`

**2.7.7** `InstoreApiClient.deleteProduct(id)` → `DELETE /api/products/:id`

**2.7.8** `InstoreApiClient.createCategory(data)` → `POST /api/categories`

**2.7.9** `InstoreApiClient.updateCategory(id, data)` → `PUT /api/categories/:id`

**2.7.10** `InstoreApiClient.deleteCategory(id)` → `DELETE /api/categories/:id`

### 2.8 SyncPoller Lifecycle

**2.8.1** When `App.tsx` initialises and `instoreApiConfig.isClient` is `true`, the system shall call `syncPoller.start()`.

**2.8.2** When `App.tsx` unmounts or the mode changes to non-client, the system shall call `syncPoller.stop()`.

**2.8.3** When `SyncPoller` receives events from the server, the system shall call `syncEventBus.receive(event)` for each, which dispatches to all registered handlers.

---

## 3. State-Driven Requirements

**3.1** While `instoreApiConfig.isStandalone` is `true`, all data operations use local SQLite. No HTTP calls are made for business data. No sync events are emitted.

**3.2** While `instoreApiConfig.isServer` is `true`, all data operations use local SQLite AND sync events are emitted after each write so connected clients stay current.

**3.3** While `instoreApiConfig.isClient` is `true`, all data operations use `InstoreApiClient` (via `InstoreApiOrderRepository` / `InstoreApiReturnRepository`). Local SQLite repositories are bypassed for business data. `SyncPoller` runs.

**3.4** While `instoreApiClient.isConnected` is `false` in client mode, data operations will fail — the UI shall surface connection errors and allow the cashier to retry.

**3.5** While `SyncPoller` is running and the server is unreachable, it shall apply exponential backoff (up to 30s) and continue retrying silently after the first 3 errors.

---

## 4. Implementation Gaps

The write endpoints, client write methods, HTTP transport (`InstoreApiTransport` via `react-native-http-bridge`), `GET /api/categories`, and `SyncPoller` startup in `App.tsx` are all implemented. Remaining gaps:

**4.1** **No client-mode write queue** — if the server is unreachable, client transactions fail rather than queue locally (see 5.1.2).

**4.2** **No shift API** — there are no `/api/shifts*` routes and no `ShiftRepository`; client-mode shift management is non-functional.

**4.3** **SyncEventBus has no consumers** — polled events are dispatched but no service subscribes to update local state.

---

## 5. Offline Resilience & Mode Switching

### 5.1 Client Mode — Network Failure

**5.1.1** When a client register loses connectivity to the server, data operations (`createOrder`, `updatePayment`, `createReturn`) will throw — the UI shall surface the error and allow the cashier to retry.

**5.1.2** There is currently no local fallback queue for client mode — if the server is unreachable, the cashier cannot complete a transaction until connectivity is restored. This is a known limitation; a future enhancement would queue writes locally and flush them when the server reconnects.

**5.1.3** When `SyncPoller` loses connectivity, it applies exponential backoff (up to 30s) and continues retrying silently — the client register remains usable for reads from its last-known state.

### 5.2 Mode Switching at Runtime

**5.2.1** When the admin changes the mode in `InstoreApiSettingsTab` and saves, the system shall call `instoreApiConfig.save(updates)` to persist the new mode.

**5.2.2** When mode changes to `server`, the system shall call `instoreApiServer.start()`.

**5.2.3** When mode changes to `client` or `standalone`, the system shall call `instoreApiServer.stop()` and, if switching away from `client`, call `syncPoller.stop()`.

**5.2.4** `BasketServiceFactory` caches its container — after a mode change, `BasketServiceFactory.reset()` must be called so the next `getServices()` call rebuilds the container with the new repository implementations.

**5.2.5** Local SQLite data is preserved when switching modes — no data is deleted on mode change.

### 5.3 Conflict Resolution

**5.3.1** The system uses a last-write-wins strategy for data conflicts — the most recent write to the server's SQLite is the authoritative value. There is no merge or conflict detection.

**5.3.2** Concurrent writes from multiple client registers to the same order are not protected by optimistic locking — the last `updateStatus` or `updatePayment` call wins.

---

## 6. Feature Doc Corrections

The `docs/features/offline.md` feature doc contains two inaccuracies vs the actual implementation:

**Flow 4 inaccuracy** — The feature doc says "Order created on client → SyncEventBus publishes event → Event sent to server via HTTP POST." This is incorrect. In the actual design:

- Client registers write orders directly to the server via `InstoreApiOrderRepository` (HTTP PUT/POST)
- The server emits sync events to `SyncEventBus` after each write
- Other client registers poll `GET /api/sync/events` to receive those events
- There is no client→server event POST — data writes are the events

**Flow 5 inaccuracy** — The feature doc says "Continues operating — all data in local SQLite, orders created locally." In client mode, there is no local SQLite fallback. If the server is unreachable, the client cannot create orders. The local SQLite is only used for config and session state in client mode.

| File                                         | Change                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| `repositories/OrderRepository.ts`            | Exports the `OrderRepository` interface and the mode-aware factory                    |
| `repositories/ReturnRepository.ts`           | Exports the `ReturnRepository` interface                                              |
| `repositories/InstoreApiOrderRepository.ts`  | `OrderRepository` impl delegating to `InstoreApiClient`                               |
| `repositories/InstoreApiReturnRepository.ts` | `ReturnRepository` impl delegating to `InstoreApiClient`                              |
| `repositories/OfflineOrderRepository.ts`     | SQLite implementation for standalone/server mode                                      |
| `repositories/OfflineReturnRepository.ts`    | SQLite implementation for standalone/server mode                                      |
| `services/checkout/CheckoutService.ts`       | Uses `OrderRepository`; no `instoreApiConfig` checks                                  |
| `services/refunds/RefundService.ts`          | Uses `ReturnRepository` via `returnRepo` field; `setReturnRepository()` for injection |
| `services/basket/BasketServiceFactory.ts`    | Selects `InstoreApiOrderRepository` or `OfflineOrderRepository` based on mode         |
| `services/sync/OrderSyncService.ts`          | Uses `OrderRepository`                                                                |
| `hooks/useOfflineProducts.ts`                | Reverted — always uses `offlineProductService` (server/standalone only)               |
| `hooks/useOfflineCategories.ts`              | Reverted — always uses `offlineCategoryService` (server/standalone only)              |

No changes needed to UI components — the routing is entirely in the repository layer.

---

## 7. Files Changed

| File                                         | Change                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| `repositories/OrderRepository.ts`            | Interface + types + singleton + `getOrderRepository()` factory                        |
| `repositories/OfflineOrderRepository.ts`     | SQLite implementation of `OrderRepository`                                            |
| `repositories/InstoreApiOrderRepository.ts`  | HTTP implementation of `OrderRepository`                                              |
| `repositories/ReturnRepository.ts`           | Interface + types + singleton + `getReturnRepository()` factory                       |
| `repositories/OfflineReturnRepository.ts`    | SQLite implementation of `ReturnRepository`                                           |
| `repositories/InstoreApiReturnRepository.ts` | HTTP implementation of `ReturnRepository`                                             |
| `services/checkout/CheckoutService.ts`       | Uses `OrderRepository` interface; no mode checks                                      |
| `services/refunds/RefundService.ts`          | Uses `ReturnRepository` via `returnRepo` field; `setReturnRepository()` for injection |
| `services/basket/BasketServiceFactory.ts`    | Calls `getOrderRepository()` and `getReturnRepository()` at wiring time               |
| `services/sync/OrderSyncService.ts`          | Uses `OrderRepository` interface                                                      |
| `hooks/useOfflineProducts.ts`                | Always uses `offlineProductService` (server/standalone only)                          |
| `hooks/useOfflineCategories.ts`              | Always uses `offlineCategoryService` (server/standalone only)                         |
| `App.tsx`                                    | Starts `syncPoller` when `instoreApiConfig.isClient`                                  |

---

## 8. Component Traceability

| -------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Mode loaded at startup | `instoreApiConfig.load()` | `services/instoreapi/InstoreApiConfig.ts` |
| Repository selected at wiring time | `BasketServiceFactory.buildContainer()` | `services/basket/BasketServiceFactory.ts` |
| Standalone/server: orders written to SQLite | `CheckoutService` → `OfflineOrderRepository.createWithItems()` | `repositories/OrderRepository.ts` |
| Client: orders written to server | `CheckoutService` → `InstoreApiOrderRepository.createWithItems()` | `repositories/InstoreApiOrderRepository.ts` |
| Standalone/server: returns written to SQLite | `RefundService` → `OfflineReturnRepository` | `repositories/ReturnRepository.ts` |
| Client: returns written to server | `RefundService` → `InstoreApiReturnRepository` | `repositories/InstoreApiReturnRepository.ts` |
| Factory functions select right impl | `getOrderRepository()` / `getReturnRepository()` | `repositories/OrderRepository.ts`, `repositories/ReturnRepository.ts` |
| Server: emit sync event after write | `syncEventBus.emit()` in each write path | `services/instoreapi/sync/SyncEventBus.ts` |
| Offline tab product management | `useOfflineProducts` → `offlineProductService` (server/standalone only) | `hooks/useOfflineProducts.ts` |
| Offline tab category management | `useOfflineCategories` → `offlineCategoryService` (server/standalone only) | `hooks/useOfflineCategories.ts` |
| Order screen products (all modes) | `useProducts` → `ProductServiceFactory` | `hooks/useProducts.ts` |
| SyncPoller started in client mode | `App.tsx` → `syncPoller.start()` | `App.tsx` |
| Server write routes | `InstoreApiServer.registerRoutes()` | `services/instoreapi/InstoreApiServer.ts` |
| Client write methods | `InstoreApiClient` | `services/clients/instoreapi/InstoreApiClient.ts` |
