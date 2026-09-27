# Ubiquitous Language — RetailPOS

> Canonical domain vocabulary. Use these terms exactly — no paraphrasing or synonyms.

---

## Basket & Cart

**Basket** — In-progress order before payment. Persisted to SQLite. One active basket per register.  
❌ Never: cart, trolley, order

**BasketItem** — Single line in basket. Immutable sellable-unit snapshot (`variantId`, `sku`, `taxRate`, `taxable`, `inventoryPolicy`).  
❌ Never: cart item, line item

**CartProduct** — Shape passed to `addToCart()` by UI. Distinct from `UnifiedProduct` (catalog) and `BasketItem` (stored).

**Add-to-Cart** — Calling `BasketProvider.addToCart(product, quantity)`. Tax rate resolved here.

**Subtotal** — `sum(price × quantity)` before tax/discount. Integer-cent math.

**Tax** — `sum(lineTotal × taxRate)` for taxable items. Per-item using `taxRate` snapshot.

**Total** — `max(0, roundMoney(subtotal + tax − discountAmount))`. Never negative.

**Discount Amount** — Flat monetary deduction. Single value, not per-item.

---

## Order & Checkout

**LocalOrder** — POS local representation of a sale. SQLite `orders` table. Lifecycle: `draft`/`pending` → `processing` → `paid` → `synced`.  
❌ Never: order record, sale, transaction

**OrderItem** — Single product line on `LocalOrder`. Stored in `order_items`.  
❌ Never: basket item

**PaymentLine** — Single payment entry. Multiple allowed (split tender). Fields: `method`, `amount`, `transactionId`, `cardBrand`, `last4`.

**Draft Order** — `LocalOrder` with `status: 'draft'`. Created by `startCheckout()` on `native_draft` platforms only.

**platformOrderId** — ID of corresponding platform order. `null` until draft created or sync completes.

**startCheckout()** — Converts basket to `LocalOrder`. On `native_draft` platforms, creates platform draft and overwrites tax with platform values.

**completePayment()** — Records payment, clears basket, triggers async sync. Validates payment total = order total (±1¢).

**completeOrder()** — Platform API call for `native_draft` sync to mark draft as paid.

**Order Status**: `draft`, `pending`, `processing`, `paid`, `failed`, `cancelled`

**Sync Status**: `pending`, `synced`, `failed`

**Split Tender** — Multiple `PaymentLine`s for one order. Sum must equal `LocalOrder.total`.

**ExchangeSession** — In-memory exchange transaction. Fields: `returnItems`, `returnCredit`, `newItems`, `netDue`, `payments`. Committed atomically or discarded.

**Cash Tender** — Physical cash amount. Always ≥ split amount. Change displayed but not recorded.

---

## Platform & Capability

**Platform** — E-commerce backend or `offline`. Enum: `shopify`, `woocommerce`, `bigcommerce`, `magento`, `sylius`, `wix`, `prestashop`, `squarespace`, `commercefull`, `offline`

**Basket Mode**:

- `native_draft` — Platform creates mutable draft at checkout; tax is platform-authoritative (Shopify, Wix, Commercefull)
- `remote_cart` — No platform call at checkout; POS basket local-authoritative; sync creates order (WooCommerce, Magento, BigCommerce, Sylius, PrestaShop)
- `local_only` — Fully local basket; order imported post-payment (Squarespace, Offline)

**Capability Level**: `supported` (stable API), `custom` (adapter required), `not_recommended` (hidden/disabled)

**Platform Capability Matrix** — Static table in `utils/platformCapabilities.ts` mapping Platform → Feature → CapabilityLevel

**Sellable Unit** — Platform-specific inventory entity that `BasketItem.variantId` points to

**ServiceConfigBridge** — Reads e-commerce credentials from KV store, calls `configureService(platform, config)` on factories

---

## Products & Catalog

**UnifiedProduct** — Normalized product schema. All platform shapes mapped to this.

**UnifiedCategory** — Normalized category schema.

**Product Variant** — Specific purchasable configuration (size + color). Represented by `variantId` on `BasketItem`.

**optionSummary** — Human-readable variant options (e.g. `"Size: M / Colour: Red"`). Captured at add-to-cart.

**inventoryPolicy** — `'deny'` (block when stock = 0) or `'continue'` (allow overselling). Captured at add-to-cart.

**catalogVersion** — Timestamp/token captured at add-to-cart. Detects stale snapshots.

---

## Tax

**TaxProfile** — Named tax config in SQLite. Fields: `id`, `name`, `rate` (0–1), `isDefault`. Three defaults: Standard (20%), Reduced (5%), Zero (0%).

**taxProfileId** — Reference from offline product to `TaxProfile`. Rate resolved at add-to-cart.

**taxCode** — Platform-supplied tax class string (e.g. `'reduced-rate'`). Resolved to local `TaxProfile` by name match.

**taxRate** — Resolved decimal (0–1) stored on `BasketItem`. Captured once at add-to-cart, never re-resolved.

**TaxCalculationType**: `'inclusive'` (tax inside price), `'exclusive'` (tax added), `'exempt'` (no tax)

**Rate Resolution Pipeline**: 1) Normalize tax code 2) Exempt fast-path 3) Live platform rate 4) Local profile fallback 5) Default profile

**Zero-Rate Platform** — Platform with no public tax API (Shopify, BigCommerce, Wix, PrestaShop, Squarespace). Returns 0%.

**Platform-Authoritative Tax** — For `native_draft`, platform draft values overwrite local estimates at `startCheckout()`.

---

## Authentication & Permissions

**Role** — Fixed: `admin` (3), `manager` (2), `cashier` (1). Cannot create/delete/rename.

**Auth Method**: `pin` (6-digit), `biometric`, `password`, `magstripe`, `rfid_nfc`, `platform_auth`

**Auth Mode**: `'offline'` (local methods) or `'online'` (+ platform_auth)

**PIN Fallback** — `pin` always available, cannot be disabled.

**PermissionService** — Singleton for action-level authorization. Only gate for checks.

**PermissionSet** — Named collection of `PermissionOverride` entries. Assigned to users.

**Action Key** — Dot-namespaced action identifier (e.g. `discount:manual`). Declared in `ACTION_REGISTRY`.

**Manager Approval** — In-context PIN challenge for higher-role actions. Approving manager's session doesn't replace cashier's.

**Brute-Force Lockout** — 60s lockout after 5 failed PIN entries.

**Approval Window** — Optional cache suppressing repeated prompts within time window.

---

## Payments

**PaymentProvider** — Card terminal/SDK: `STRIPE_NFC`, `STRIPE`, `SQUARE`, `ADYEN`, `TAP_PAYMENTS`

**PaymentRequest / PaymentResponse** — Provider-agnostic payment contract.

**PED (PIN Entry Device)** — Physical terminal (Ingenico, Verifone, PAX). **Must integrate via Instore API** (ADR-015).

**Mock Mode** — `USE_MOCK_PAYMENT=true` enables mock implementations.

---

## Sync

**OrderSyncService** — Syncs paid `LocalOrder`s to platform. Called non-blocking after `completePayment()`.

**BackgroundSyncService** — Periodic retry for `pending`/`failed` sync status.

**MAX_SYNC_RETRIES** — Max automatic retries before `syncStatus: 'failed'`.

**Retryable Error** — Network errors and 5xx. 4xx are not retryable.

**SyncQueue** — Screen/hook for managing `pending`/`failed` orders.

---

## Multi-Register & Instore API

**Register Mode**: `standalone` (local SQLite), `server` (hosts LAN API), `client` (thin interface)

**Instore API** — Local HTTP server on `server` register. Exposes orders/returns/events to `client` registers. PED integration point.

**SyncEventBus** — Pub/sub bus on server publishing basket/order mutations.

**SyncPoller** — Client-side polling loop pulling events from server. Exponential backoff.

---

## Hardware

**CashDrawer** — Physical tray opened by kick signal. Requires `cash_drawer:open` permission outside sale.

**PrinterService** — Receipt printing abstraction. `UnifiedPrinterService` (mobile) / `ElectronPrinterService` (desktop).

**BarcodeScanner** — Hardware/camera reading barcodes. Types: `camera`, `usb`, `bluetooth`, `qr_hardware`, `electron`

**ScanResult** — Scan outcome: `searching`, `found_local`, `found_variant`, `found_online`, `not_found`. Inline banner, never alert.

---

## Architecture Patterns

**Factory Pattern** — Interface → Factory (singleton) → Platform implementations → Offline fallback (ADR-005)

**Repository Pattern** — Repositories own SQLite access. Services never call DB directly (ADR-002, ADR-003)

**Strategy Pattern** — Tax calculation: `TaxServiceFactory` holds one `TaxStrategy` per platform

**KV Store** — String key → JSON value in SQLite. Config, flags, session data, audit log.

**Audit Log** — Append-only log of actions. Dot-namespaced keys (e.g. `auth:login`). CSV export (ADR-012)

**Integer-Cent Math** — All money arithmetic in integer cents via `utils/money.ts` (ADR-006)

---

## Notification & Observability

**NotificationService** — Singleton pub/sub for in-app notifications (toasts, bell drawer) (ADR-011)

**Toast** — Transient on-screen message. Auto-dismissed.

**Logger** — Structured, level-filtered logger via `LoggerFactory`. No `console.*` in production (ADR-007)

---

## Anti-Terms (Never Use)

| ❌ Forbidden       | ✅ Use Instead                                                |
| ------------------ | ------------------------------------------------------------- |
| cart               | **basket**                                                    |
| cart item          | **BasketItem** (pre-checkout) / **OrderItem** (post-checkout) |
| sale               | **LocalOrder** or **checkout**                                |
| transaction        | **PaymentLine** or **payment**                                |
| shop               | **platform** or **store**                                     |
| ecommerce order    | **Platform Order**                                            |
| synced to platform | **sync status: synced**                                       |
| offline mode       | **`local_only` basket mode** or **offline platform**          |
