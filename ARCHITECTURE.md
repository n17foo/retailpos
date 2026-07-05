# RetailPOS — Architecture Overview

> High-level technical reference. For implementation patterns and code examples see `docs/guidelines/architecture-patterns.md`. For domain vocabulary see `docs/guidelines/ubiquitous-language.md`.

---

## Technology Stack

| Layer          | Technology                                    | Version |
| -------------- | --------------------------------------------- | ------- |
| **Framework**  | React Native + Expo                           | SDK 55  |
| **Language**   | TypeScript                                    | 5.x     |
| **Navigation** | React Navigation                              | 7.x     |
| **State**      | React Context (app state) + Zustand (queue)   | —       |
| **Database**   | SQLite via `expo-sqlite`                      | —       |
| **Desktop**    | Electron                                      | —       |
| **Styling**    | StyleSheet + `utils/theme.ts`                 | —       |
| **i18n**       | react-i18next + expo-localization             | —       |
| **Logging**    | Custom `LoggerFactory` + pluggable transports | —       |
| **Testing**    | Jest                                          | —       |
| **Linting**    | ESLint (flat config) + Prettier               | —       |

---

## Layer Architecture

The application is organised in four strict layers. **Dependencies only flow downward** — a layer may only call into the layer directly below it. No layer may skip levels or call upward.

```
┌─────────────────────────────────────────────────────────┐
│  Screens  (screens/)                                    │
│  Full-screen views. Compose components, call hooks.     │
│  No direct service calls. No business logic.            │
├─────────────────────────────────────────────────────────┤
│  Components  (components/)                              │
│  Reusable UI fragments. Props-in / callbacks-out.       │
│  No hooks that call services. No state beyond local UI. │
├─────────────────────────────────────────────────────────┤
│  Hooks  (hooks/)                                        │
│  One hook per domain. Owns async state, error state,    │
│  loading flag. Calls service factories. Returns stable  │
│  callbacks via useCallback.                             │
├─────────────────────────────────────────────────────────┤
│  Services  (services/)                                  │
│  All business logic and platform integration.           │
│  No React imports. No UI state.                         │
│  Interface → Factory → Platform implementations.        │
└─────────────────────────────────────────────────────────┘
          ↕  (cross-cutting)
┌─────────────────────────────────────────────────────────┐
│  Contexts  (contexts/)                                  │
│  Global state shared across many screens (Basket,       │
│  Auth, Category). Provided at the root; consumed via    │
│  the companion useX hook. Internally call services.     │
└─────────────────────────────────────────────────────────┘
```

### Rules

| Rule                                                                  | Rationale                                                            |
| --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Screens call hooks and contexts — never service factories directly    | Keeps screens as pure composition surfaces; logic stays testable     |
| Components receive all data via props — no service or factory imports | Components are pure UI; trivially reusable and testable              |
| Hooks call `XServiceFactory.getInstance().getService(platform)`       | Single call-site for platform resolution                             |
| Services have zero React imports                                      | Services must be usable outside React (tests, background jobs)       |
| Contexts call services internally, never factories from inside JSX    | Context is the bridge between React lifecycle and singleton services |
| No cross-service calls at the same layer                              | Services are composed by hooks/contexts, not by each other           |

### Data Flow Example — Add to Cart

```
ProductCard (component)
  → onPress prop (callback)
  → OrderScreen (screen)
  → addToCart() from useBasketContext()
  → BasketProvider (context)
  → BasketService.addItem()     ← service layer
  → BasketRepository.save()     ← data layer
```

### Where Contexts fit

Contexts (`BasketProvider`, `AuthProvider`, `CategoryProvider`) are **not** a fourth layer — they are shared-state bridges. A context:

- **Wraps** a domain service singleton for React lifecycle management
- **Exposes** stable callbacks and derived state to many screens at once
- **Is consumed** via its companion `useX` hook (e.g. `useBasketContext`)

Prefer a plain hook (`useProducts`, `useOrders`) when state is **local to one screen**. Use a context only when state must be **shared across multiple screens** simultaneously.

---

## Key Architectural Boundaries

### Basket → Checkout → Sync (ADR-001)

Three focused services own the sale lifecycle — no monolith:

| Service            | Owns                                                         |
| ------------------ | ------------------------------------------------------------ |
| `BasketService`    | Cart CRUD: add / remove / update items, recalculate totals   |
| `CheckoutService`  | `startCheckout()`, `completePayment()`, order queries        |
| `OrderSyncService` | Sync paid orders to platform; retry with exponential backoff |

### Platform Abstraction — Factory + Interface (ADR-005)

Every domain (product, order, inventory, customer, …) follows: **Interface → Factory → Platform implementations → Offline fallback**. Hooks call factories; UI components call hooks. No platform-specific code reaches the UI layer.

### Offline-First SQLite (ADR-004)

All business data is written to local SQLite first. Checkout never blocks on a network call. `OrderSyncService` syncs post-payment, asynchronously with retry. The `sync_status` field on each order tracks its sync state.

### Repository Mode Switching (ADR-003)

Repositories abstract both SQLite (`OfflineOrderRepository`) and HTTP-to-server (`LocalApiOrderRepository`) behind the same interface. A factory function (`getOrderRepository()`) returns the correct implementation based on `localApiConfig.isClient`. Services are unaware of the mode.

### Platform Capability Model

`utils/platformCapabilities.ts` is the single source of truth for what each platform supports. It gates checkout behaviour (`basketMode`), sync strategy, and UI visibility. See `docs/specs/platform/platform-capabilities.md`.

### Tax — Platform-Authoritative (ADR-009)

For `native_draft` platforms (Shopify, Wix, CommerceFull), tax is calculated by the platform at `startCheckout()` time and overwrites local estimates. For all other platforms, local `TaxProfile` rates are authoritative.

---

## Supported Platforms

`shopify` · `woocommerce` · `bigcommerce` · `magento` · `sylius` · `wix` · `prestashop` · `squarespace` · `commercefull` · `offline`

Defined in `utils/platforms.ts` → `ECommercePlatform` enum. Each platform has a capability profile in `utils/platformCapabilities.ts`.

---

## Database Schema

SQLite managed by `SQLiteStorageService` (`services/storage/SQLiteStorageService.ts`). Current schema version: **v3** (migrations in `utils/dbSchema.ts`).

| Table                   | Purpose                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `users`                 | Cashiers / admins — id, name, role, pin, is_active                         |
| `orders`                | Order headers — status, sync_status, platformOrderId, payments_json        |
| `order_items`           | Order line items — product snapshot, qty, price, tax_rate                  |
| `baskets`               | Active basket state — items (JSON), totals, customer_id                    |
| `key_value_store`       | All KV config: `pos.*`, auth config, scan settings, audit log, cached data |
| `tax_profiles`          | Named tax rates — Standard 20%, Reduced 5%, Zero 0%                        |
| `product_variants`      | Local offline product variants — SKU, barcode, options                     |
| `returns`               | Return records — items, reason, refund linkage                             |
| `customers_cache`       | Cached platform customer lookup results                                    |
| `vendors`               | Procurement — supplier / vendor records                                    |
| `purchase_orders`       | Procurement — PO headers                                                   |
| `purchase_order_items`  | Procurement — PO line items                                                |
| `inventory_counts`      | Stock-take sessions                                                        |
| `inventory_count_items` | Counted quantities per product / variant                                   |
| `transfer_orders`       | Stock transfer headers                                                     |
| `transfer_order_items`  | Stock transfer line items                                                  |

`SettingsRepository` is a typed JSON facade over `key_value_store` — no separate settings table.

---

## User Roles

Three fixed, immutable roles. Role rank: `admin (3) > manager (2) > cashier (1)`.

| Role      | Access                                          |
| --------- | ----------------------------------------------- |
| `admin`   | Full access — settings, users, reports, refunds |
| `manager` | Products, reports, refunds, daily operations    |
| `cashier` | Sales, product search, basic operations         |

---

## Register Modes (Multi-Register)

| Mode         | Data source    | Hosts Instore API | Store-API Connection |
| ------------ | -------------- | ----------------- | -------------------- |
| `standalone` | Local SQLite   | No                | None                 |
| `server`     | Local SQLite   | Yes — LAN HTTP    | WebSocket + REST     |
| `client`     | Server via LAN | No                | WebSocket + REST     |

In `client` or `server` mode the POS also establishes a **WebSocket connection** to the store-api (`/ws`) for real-time outbox delivery. The connection uses the HELLO/replay/snapshot state machine:

1. Client sends HELLO with `device_id`, `last_acked_server_seq`
2. Server replays missed outbox messages or triggers a snapshot
3. Client acks each message; server pings every 10s

If the WebSocket is unavailable, the POS falls back to polling `GET /api/sync/events`.

### Authentication in Client Mode

In client mode, PIN verification is delegated to the store-api (`POST /api/users/verify-pin`) so that user management is centralised on the server. In standalone/server mode, PINs are verified against local SQLite.

---

## Peripheral Abstraction

All hardware peripherals use the same interface → factory → implementation pattern:

| Peripheral  | Mobile / Tablet                                                   | Electron Desktop                              |
| ----------- | ----------------------------------------------------------------- | --------------------------------------------- |
| Printer     | `UnifiedPrinterService`                                           | `ElectronPrinterService`                      |
| Scanner     | Camera / BT / USB HID keydown                                     | `ElectronScannerService`                      |
| Payment     | Stripe NFC / Stripe / Square / Adyen / Tap Payments / Instore API | Instore API (no direct Electron payment path) |
| Cash Drawer | `PrinterDrawerDriver` or NoOp                                     | `ElectronDrawerDriver`                        |

PED (PIN Entry Device) integration must go through the Instore API — never as a direct `PaymentProvider` in the POS client (ADR-015).

### Instore API Payment Flow (PED)

The `INSTORE_API` payment provider routes payments through the store-api's orchestration layer:

```
PaymentServiceFactory → InstoreApiPaymentService
  → PaymentIntentClient.initiatePayment()
  → POST /api/payment-intents → store-api → PED terminal
  → poll or listen via WebSocket for payment.approved/declined
  → map PaymentIntent → PaymentResponse
```

Supports: initiate, cancel, refund, unknown-outcome recovery, receipt retrieval.

---

## Environment & Development Setup

### Prerequisites

- **Node.js** v22 (`nvm use 22`)
- **Yarn** 1.x
- **Expo CLI** — `npm install -g @expo/cli`
- **Xcode** (macOS — iOS builds)
- **Android Studio** (Android builds)

### Setup

```bash
cp .env.example .env   # then fill in API keys
yarn install
yarn start             # Metro bundler
```

### Mock Flags (`.env`)

| Flag                | Effect when `true`                       |
| ------------------- | ---------------------------------------- |
| `USE_MOCK_SCANNER`  | Simulated barcode scans, no hardware     |
| `USE_MOCK_PAYMENT`  | Simulated payments, no terminal required |
| `USE_MOCK_SECRETS`  | In-memory credential store (no keychain) |
| `USE_MOCK_PRINTERS` | Simulated printer, no ESC/POS device     |

### Build Commands

```bash
yarn ios / android / web / desktop      # dev runs
yarn desktop:build-mac / win / linux    # production builds
yarn test / lint / lint:fix / format    # quality gates
```

---

## Security

- **Credentials** — stored via `SecretsService` (`react-native-keychain` in production; in-memory mock in dev)
- **Environment** — `.env` is gitignored; never commit secrets
- **Auth** — pluggable multi-method; PIN is always the fallback (ADR-008)
- **Payments** — delegated to PCI-compliant SDKs (Stripe, Square, Adyen, Tap Payments); non-SDK providers go through the Instore API
- **Known gap** — PINs stored as plaintext in `users.pin`; must be hashed before production

---

## Internationalisation

`react-i18next` + `expo-localization` for automatic locale detection.
Translation files: `locales/en.json`, `locales/es.json`, `locales/fr.json`, `locales/de.json`.
