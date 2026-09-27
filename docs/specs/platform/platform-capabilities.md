# Platform Capabilities – EARS Requirements

> **System**: RetailPOS – Platform Feature Gating & Capability Model  
> **Actor**: System, Admin  
> **Date**: 2026-05-01  
> **Source**: `utils/platformCapabilities.ts`, `services/platform/PlatformCapabilityService.ts`, `services/checkout/CheckoutService.ts`, `services/sync/OrderSyncService.ts`, `services/order/platforms/`, `screens/settings/EcommerceSettingsTab.tsx`, `services/navigation/MoreMenuComposer.ts`, `services/navigation/SettingsTabComposer.ts`

---

## Context

The platform capability model is the single source of truth for what each e-commerce platform supports. It gates checkout behaviour, sync strategy, UI visibility, and service configuration — ensuring the POS works correctly on all 9 platforms without forcing a Shopify-style draft-order abstraction everywhere.

Every platform is assigned a **basket mode** that determines how the POS manages basket state relative to the platform:

| Basket mode    | Description                                                                                | Platforms                                             |
| -------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| `native_draft` | Platform creates a mutable draft order with server-calculated tax at checkout start        | Shopify, Wix, Commercefull                            |
| `remote_cart`  | Platform has a cart/quote/in-progress order; POS basket is local-authoritative at checkout | WooCommerce, Magento, BigCommerce, Sylius, PrestaShop |
| `local_only`   | Fully local basket; order imported to platform post-payment via `createOrder()`            | Squarespace, Offline                                  |

Every platform also has a capability level for each advanced feature:

| Level             | Meaning                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------- |
| `supported`       | First-class, stable API support — enabled by default                                      |
| `custom`          | Custom adapter required; project/tenant-specific risk — gated by readiness                |
| `not_recommended` | Not recommended for parity promise in current public API shape — hidden or disabled in UI |

### Actors

| Actor  | Role                                                                                     |
| ------ | ---------------------------------------------------------------------------------------- |
| System | Reads capability profile at startup and runtime to gate checkout, sync, and UI behaviour |
| Admin  | Selects platform in E-commerce settings; sees capability summary before saving           |

### Platform Capability Matrix

| Feature              | Shopify | WooCommerce | Magento | BigCommerce | Sylius | Wix | PrestaShop | Squarespace | Commercefull | Offline |
| -------------------- | ------- | ----------- | ------- | ----------- | ------ | --- | ---------- | ----------- | ------------ | ------- |
| Basket mode          | ND      | RC          | RC      | RC          | RC     | ND  | RC         | LO          | ND           | LO      |
| Catalog / variants   | S       | S           | S       | S           | C      | S   | S          | S           | S            | S       |
| Customers / attach   | S       | S           | S       | S           | C      | S   | S          | S           | S            | S       |
| Inventory read/write | S       | S           | S       | S           | C      | S   | S          | S           | S            | S       |
| Order sync           | S       | S           | S       | S           | C      | S   | S          | S           | S            | S       |
| Discounts / coupons  | S       | S           | S       | S           | C      | S   | S          | NR          | S            | S       |
| Gift cards           | S       | C           | C       | C           | NR     | S   | NR         | NR          | S            | NR      |
| Refunds              | S       | C           | S       | S           | C      | S   | C          | NR          | S            | S       |

Legend: `ND` = native_draft, `RC` = remote_cart, `LO` = local_only, `S` = supported, `C` = custom, `NR` = not_recommended

### Sellable Unit by Platform

Each basket line must point to the platform's actual sellable unit. The correct unit is stored in `BasketItem.variantId`:

| Platform    | Sellable unit                                                     |
| ----------- | ----------------------------------------------------------------- |
| Shopify     | `ProductVariant.id`                                               |
| WooCommerce | variation id for variable products; omitted for simple products   |
| Magento     | concrete simple SKU selected through configurable product options |
| BigCommerce | variant id (maps to SKU + inventory)                              |
| Sylius      | `productVariantCode`                                              |
| Wix         | variant id                                                        |
| PrestaShop  | combination id                                                    |
| Squarespace | `ProductVariant.id`                                               |
| Offline     | local product id                                                  |

### Key Defaults

| Field                             | Default              | Source                                        |
| --------------------------------- | -------------------- | --------------------------------------------- |
| Platform on first launch          | `offline`            | `DEFAULT_PLATFORM` in `utils/platforms.ts`    |
| Capability cache on startup       | Loaded from KV store | `PlatformCapabilityService.loadFromStorage()` |
| `basketMode` for unknown platform | `local_only`         | `getPlatformCapabilities()` fallback          |
| Adapter readiness for `custom`    | `false` (not ready)  | `MoreMenuComposer` / `SettingsTabComposer`    |

---

## 1. Ubiquitous Requirements

**1.1** The system shall maintain a single authoritative capability matrix in `utils/platformCapabilities.ts` — no platform-specific capability values shall be hardcoded in screens, hooks, or services.

**1.2** The system shall expose `getPlatformCapabilities(platform)` which returns the full `PlatformCapabilities` profile for any platform, falling back to the `offline` profile for unknown or null values.

**1.3** The system shall expose `getBasketMode(capabilities)` which returns the `BasketMode` (`native_draft` | `remote_cart` | `local_only`) for a given capability profile.

**1.4** The system shall expose `supportsStrict(capabilities, feature)`, `supportsWithCustom(capabilities, feature)`, and `isNotRecommended(capabilities, feature)` as typed helpers — these helpers shall exclude `basketMode` from their `feature` parameter type since `basketMode` is not a `CapabilityLevel`.

**1.5** The system shall expose `getUnavailableReason(capabilities, feature, platformName)` which returns a human-readable string explaining why a feature is unavailable — used in UI disabled states and tooltips.

**1.6** `PlatformCapabilityService` shall be a singleton that caches the active platform's capability profile in memory after loading from storage.

**1.7** The system shall never block the payment completion flow due to a capability check — capability gating applies to UI entry points and service guards, not to the local payment recording path.

**1.8** Each `BasketItem` shall carry a sellable-unit snapshot at add-to-cart time: `variantId` (platform sellable unit), `sku`, `optionSummary`, `taxCode`, `taxProfileId`, `taxRate`, `taxable`, `inventoryPolicy`, and `catalogVersion`. This snapshot is persisted to `order_items` so receipts and refunds remain accurate even if the platform catalog changes later.

---

## 2. Event-Driven Requirements

### 2.1 Startup — Capability Cache Load

**2.1.1** When `ServiceConfigBridge.configureFromStorage()` completes, the system shall call `PlatformCapabilityService.loadFromStorage()` to cache the active platform's capability profile.

**2.1.2** When `PlatformCapabilityService.loadFromStorage()` completes, the system shall call `PlatformCapabilityService.logCapabilitySummary()` to emit a structured log entry listing every capability level for the active platform.

**2.1.3** When `PlatformCapabilityService.loadFromStorage()` fails (storage error), the system shall default to the `offline` capability profile and log a warning — the app shall not crash.

**2.1.4** When the admin saves a new platform selection in E-commerce settings, the system shall call `PlatformCapabilityService.setPlatform(platform)` to update the in-memory cache immediately without requiring an app restart.

### 2.2 Checkout — Basket Mode Branching

**2.2.1** When `CheckoutService.startCheckout(platform)` is called and `getBasketMode(capabilities) === 'native_draft'`, the system shall call `OrderServiceFactory.getService(platform).createDraftOrder()` and use the platform-returned `subtotal`, `tax`, `total`, and per-line `taxRate` values as authoritative.

**2.2.2** When the `createDraftOrder()` call succeeds in `native_draft` mode, the system shall store the returned `platformOrderId` on the `LocalOrder` and set `status: 'draft'`.

**2.2.3** When the `createDraftOrder()` call fails in `native_draft` mode, the system shall log a warning and fall back to local basket totals — checkout shall not be blocked and `status` shall be set to `'pending'`.

**2.2.4** When `CheckoutService.startCheckout(platform)` is called and `getBasketMode(capabilities) !== 'native_draft'` (i.e. `remote_cart` or `local_only`), the system shall skip draft creation, use local basket totals as authoritative, and set `status: 'pending'`.

**2.2.5** When `CheckoutService.completePayment(orderId)` is called and the order has a `platformOrderId` and `basketMode === 'native_draft'`, the system shall call `orderService.completeOrder(platformOrderId, paymentMethod, transactionId)` to mark the platform draft as paid (non-blocking — failure is logged but does not block local payment recording).

**2.2.6** When `CheckoutService.completePayment(orderId)` is called and the order has no `platformOrderId` or `basketMode !== 'native_draft'`, the system shall skip the `completeOrder()` call — the order will be synced post-payment by `OrderSyncService`.

### 2.3 Sync — Basket Mode Branching

**2.3.1** When `OrderSyncService.syncOrderToPlatform(orderId)` is called and the order has a `platformOrderId`, the system shall call `orderService.completeOrder(platformOrderId, paymentMethod)` — this applies only to `native_draft` platforms where a draft was created at checkout.

**2.3.2** When `OrderSyncService.syncOrderToPlatform(orderId)` is called and the order has no `platformOrderId` and the platform is online, the system shall call `orderService.createOrder(platformOrder)` — this applies to `remote_cart` and `local_only` platforms.

**2.3.3** When `OrderSyncService.syncOrderToPlatform(orderId)` is called and the platform is `offline` or `undefined`, the system shall immediately mark the order `sync_status = 'synced'` without any platform API call.

### 2.4 UI — More Menu Composition

**2.4.1** When `MoreMenuScreen` renders, the system shall call `composeMoreMenu({ userRole, platform, capabilities })` to produce the ordered item list — items are `enabled`, `disabled` (with reason), or `hidden` based on role + capability.

**2.4.2** When a menu item's `capabilityKey` maps to a `not_recommended` feature for the active platform, the system shall set that item's status to `hidden` — it shall not appear in the list.

**2.4.3** When a menu item's `capabilityKey` maps to a `custom` feature and `adapterReady` is `false`, the system shall set that item's status to `disabled` with a reason string from `getUnavailableReason()`.

**2.4.4** When a menu item's `capabilityKey` maps to a `supported` feature, the system shall set that item's status to `enabled`.

### 2.5 UI — Settings Tab Composition

**2.5.1** When `SettingsScreen` renders, the system shall call `composeSettingsTabs({ platform, capabilities })` to produce the ordered tab list — tabs are `enabled`, `disabled`, or `hidden` based on capability.

**2.5.2** When a settings tab has no `capabilityKey` (core tab), the system shall always include it with `status: 'enabled'` regardless of platform.

**2.5.3** When a settings tab's `capabilityKey` maps to a `not_recommended` feature, the system shall exclude it from the rendered tab list.

### 2.6 UI — E-commerce Settings Capability Summary

**2.6.1** When the admin selects a platform in `EcommerceSettingsTab`, the system shall render a `CapabilitySummaryPanel` showing the basket mode and all 7 capability features with colour-coded badges (`supported` = green, `custom` = orange, `not_recommended` = red).

**2.6.2** When a feature is `custom` or `not_recommended` in the capability summary, the system shall render an explanatory text line below the badge using `getUnavailableReason()`.

**2.6.3** When the capability summary renders, the system shall read all values from `getPlatformCapabilities(platform)` — no capability values shall be hardcoded in the component.

---

## 3. State-Driven Requirements

**3.1** While `basketMode === 'native_draft'` for the active platform, `CheckoutService.startCheckout()` shall attempt to create a platform draft order and use platform-authoritative totals.

**3.2** While `basketMode === 'remote_cart'` or `basketMode === 'local_only'` for the active platform, `CheckoutService.startCheckout()` shall use local basket totals and set `status: 'pending'` — no platform API is called at checkout start.

**3.3** While `basketMode === 'local_only'` and the platform is `offline`, `OrderSyncService` shall mark orders as synced immediately without any platform API call.

**3.4** While a feature has `CapabilityLevel === 'not_recommended'` for the active platform, the corresponding UI entry point (menu item, settings tab, action button) shall be hidden or absent.

**3.5** While a feature has `CapabilityLevel === 'custom'` and adapter readiness is `false`, the corresponding UI entry point shall be visible but disabled with a reason subtitle.

**3.6** While a feature has `CapabilityLevel === 'supported'`, the corresponding UI entry point shall be fully enabled.

**3.7** While `PlatformCapabilityService.isLoading` is `true` (initial load), the system shall treat the active platform as `offline` — the least-privilege default.

---

## 4. Optional Feature Requirements

**4.1** Where `adapterReadiness[capabilityKey]` is `true` for a `custom` feature, the system shall treat that feature as `enabled` in menu and settings tab composition — the adapter is confirmed ready.

**4.2** Where `USE_MOCK_PAYMENT` is `'true'`, the payment capability check shall be bypassed — mock services are always available regardless of platform capability.

**4.3** Where `USE_MOCK_SCANNER` is `'true'`, the scanner capability check shall be bypassed — mock services are always available regardless of platform capability.

---

## 5. Unwanted Behaviour / Edge Cases

### 5.1 Unknown Platform

**5.1.1** If `getPlatformCapabilities(platform)` is called with a platform string not in the capability matrix, the system shall return the `offline` profile — the safest fallback with `local_only` basket mode and no advanced features.

### 5.2 Capability Cache Miss

**5.2.1** If `PlatformCapabilityService.getPlatform()` is called before `loadFromStorage()` has completed, the system shall return `ECommercePlatform.OFFLINE` — the least-privilege default.

### 5.3 Draft Creation Failure on native_draft Platform

**5.3.1** If `createDraftOrder()` throws on a `native_draft` platform, the system shall log a warning with the platform name and error, fall back to local basket totals, set `status: 'pending'`, and continue checkout — the cashier shall not see an error.

**5.3.2** If the device is offline when `createDraftOrder()` is called on a `native_draft` platform, the network error shall be treated identically to 5.3.1 — local fallback, no blocking.

### 5.4 Squarespace Order Import Failure

**5.4.1** If `SquarespaceOrderService.createOrder()` fails during sync, the system shall treat it as a retryable sync error — the order remains `sync_status = 'pending'` and will be retried by `OrderSyncService`.

### 5.5 Sylius Variant Resolution

**5.5.1** If a `BasketItem` for a Sylius order has no `variantId`, the system shall fall back to `sku` then `productId` when calling `addItemToCart()` — `productVariantCode` is required by the Sylius API and must be resolved before adding to cart.

### 5.6 Capability Matrix Drift

**5.6.1** If a platform adapter's actual behaviour diverges from the capability matrix (e.g. a `remote_cart` platform starts supporting native drafts), the system shall continue to use the matrix value until the matrix is explicitly updated — runtime behaviour is always matrix-driven, not adapter-detected.

---

## 6. Complex Requirements

**6.1** When `CheckoutService.startCheckout(platform)` is called while `basketMode === 'native_draft'` and `createDraftOrder()` succeeds, the system shall simultaneously: use platform-returned `subtotal`, `tax`, `total`, and per-line `taxRate` values; store `platformOrderId`; set `status: 'draft'`; and persist all values to SQLite via `OrderRepository.createWithItems()` — the local order is the canonical record regardless of platform state.

**6.2** When `MoreMenuScreen` renders while `userRole` is `undefined`, the system shall default to `'cashier'` for role checks and use the active platform's capability profile for capability checks — both dimensions are applied simultaneously to produce the final item list.

**6.3** When `EcommerceSettingsTab` saves a new platform selection and `ServiceConfigBridge.configureFromStorage()` completes, the system shall call `PlatformCapabilityService.setPlatform(newPlatform)` so that `MoreMenuComposer` and `SettingsTabComposer` immediately reflect the new capability profile on the next render — no app restart is required.

---

## 7. Platform Capability Lifecycle Summary

### Startup sequence

```
App launches
  → OnboardingProvider loads onboarding_status
  → SetupProgressService.load()                    ← warm deferred setup cache
  → ServiceConfigBridge.configureFromStorage()
      → loads ecommerceSettings from KV store
      → configures all service factories
      → PlatformCapabilityService.loadFromStorage() ← cache active platform
      → PlatformCapabilityService.logCapabilitySummary()
          → logs: "Capability summary for shopify: catalog: supported, ..."
```

### Checkout branching by basket mode

```
CheckoutService.startCheckout(platform)
  → getBasketMode(getPlatformCapabilities(platform))

  [native_draft: Shopify, Wix, Commercefull]
    → createDraftOrder()
        → [success] use platform totals, status: 'draft', store platformOrderId
        → [failure] fall back to basket totals, status: 'pending'

  [remote_cart: WooCommerce, Magento, BigCommerce, Sylius, PrestaShop]
    → skip draft creation
    → use basket totals, status: 'pending'

  [local_only: Squarespace, Offline]
    → skip draft creation
    → use basket totals, status: 'pending'

  → OrderRepository.createWithItems()              ← always persists locally
```

### Sync branching by basket mode

```
OrderSyncService.syncOrderToPlatform(orderId)
  → [offline platform]     → updateSyncSuccess() immediately, no API call
  → [platformOrderId set]  → completeOrder()      ← native_draft platforms only
  → [no platformOrderId]   → createOrder()        ← remote_cart + local_only platforms
      [Squarespace]        → Orders API import (channelName: 'POS')
      [other online]       → standard createOrder()
```

### UI capability gating

```
MoreMenuComposer.composeMoreMenu({ userRole, platform, capabilities })
  → for each item in MENU_ORDER:
      roleAllowed = canAccessMoreMenuItem(userRole, key)
      capLevel    = capabilities[capabilityKey]
      adapterReady = adapterReadiness[capabilityKey] ?? false
      → hidden   if !roleAllowed OR capLevel === 'not_recommended'
      → disabled if capLevel === 'custom' AND !adapterReady
      → enabled  otherwise

SettingsTabComposer.composeSettingsTabs({ platform, capabilities })
  → for each tab in TAB_ORDER:
      → always enabled if no capabilityKey (core tab)
      → hidden   if capLevel === 'not_recommended'
      → disabled if capLevel === 'custom' AND !adapterReady
      → enabled  otherwise
```

---

## 8. Component Traceability

| Requirement (summary)                                        | Component / Hook / Service                                                 | Source File                                           |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| Capability matrix — single source of truth                   | `PLATFORM_CAPABILITY_MATRIX`                                               | `utils/platformCapabilities.ts`                       |
| `getPlatformCapabilities(platform)`                          | `getPlatformCapabilities`                                                  | `utils/platformCapabilities.ts`                       |
| `getBasketMode(capabilities)`                                | `getBasketMode`                                                            | `utils/platformCapabilities.ts`                       |
| `supportsStrict` / `supportsWithCustom` / `isNotRecommended` | helper functions                                                           | `utils/platformCapabilities.ts`                       |
| `getUnavailableReason(capabilities, feature, name)`          | `getUnavailableReason`                                                     | `utils/platformCapabilities.ts`                       |
| Capability cache singleton                                   | `PlatformCapabilityService.getInstance()`                                  | `services/platform/PlatformCapabilityService.ts`      |
| Cache loaded at startup                                      | `ServiceConfigBridge.configureFromStorage()` → `loadFromStorage()`         | `services/config/ServiceConfigBridge.ts`              |
| Startup capability log                                       | `PlatformCapabilityService.logCapabilitySummary()`                         | `services/platform/PlatformCapabilityService.ts`      |
| Cache updated on platform change                             | `PlatformCapabilityService.setPlatform(platform)`                          | `services/platform/PlatformCapabilityService.ts`      |
| Checkout branches on `basketMode`                            | `CheckoutService.startCheckout()` → `getBasketMode()`                      | `services/checkout/CheckoutService.ts`                |
| `native_draft` → `createDraftOrder()`                        | `CheckoutService.startCheckout()` (basketMode === 'native_draft' branch)   | `services/checkout/CheckoutService.ts`                |
| `native_draft` → `completeOrder()` on payment                | `CheckoutService.completePayment()` (basketMode === 'native_draft' branch) | `services/checkout/CheckoutService.ts`                |
| `remote_cart` / `local_only` → skip draft                    | `CheckoutService.startCheckout()` (else branch)                            | `services/checkout/CheckoutService.ts`                |
| Sync branches on `platformOrderId`                           | `OrderSyncService.syncOrderToPlatform()` (platformOrderId check)           | `services/sync/OrderSyncService.ts`                   |
| Offline fast-path to synced                                  | `OrderSyncService.syncOrderToPlatform()` (`!isOnlinePlatform` branch)      | `services/sync/OrderSyncService.ts`                   |
| Squarespace order import                                     | `SquarespaceOrderService.createOrder()` → `mapToSquarespaceImportOrder()`  | `services/order/platforms/SquarespaceOrderService.ts` |
| Sylius variant resolution                                    | `SyliusOrderService.addItemToCart()` → `productVariantCode`                | `services/order/platforms/SyliusOrderService.ts`      |
| More menu composed by role + capability                      | `composeMoreMenu({ userRole, platform, capabilities })`                    | `services/navigation/MoreMenuComposer.ts`             |
| Menu item hidden for `not_recommended`                       | `evaluateCombinedAccess()` → `status: 'hidden'`                            | `utils/menuCapabilityAccess.ts`                       |
| Menu item disabled for `custom` + not ready                  | `evaluateCapabilityGate()` → `status: 'disabled'`                          | `utils/menuCapabilityAccess.ts`                       |
| Settings tabs composed by capability                         | `composeSettingsTabs({ platform, capabilities })`                          | `services/navigation/SettingsTabComposer.ts`          |
| Capability summary panel in E-commerce settings              | `CapabilitySummaryPanel` → `getPlatformCapabilities(platform)`             | `screens/settings/EcommerceSettingsTab.tsx`           |
| Basket mode shown first in capability summary                | `CapabilitySummaryPanel` (basketMode row rendered before feature rows)     | `screens/settings/EcommerceSettingsTab.tsx`           |
| `BasketItem` sellable-unit snapshot fields                   | `BasketItem` interface (variantId, sku, taxRate, inventoryPolicy, etc.)    | `services/basket/basket.ts`                           |
