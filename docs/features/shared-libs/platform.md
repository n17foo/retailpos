# Platform & Electron Bridge

**Files:** `utils/platforms.ts`, `utils/platformIds.ts`,
`utils/platformCapabilities.ts`, `utils/electron.ts`
**Tests:** `utils/platformIds.test.ts` | **Docs:**
capability-rollout rules — retired into `platform.md`
**Parent:** [`rules.md`](rules.md)

---

## P-R1 — `offline` is a first-class platform and the default

**Rule**
`ECommercePlatform` = 8 online platforms + `OFFLINE`.
`DEFAULT_PLATFORM = OFFLINE` so the app works with no credentials;
`isOnlinePlatform` is the single check distinguishing them.

**Evidence** — `utils/platforms.ts` (~97 importers).

🟢 **E1.1** — `isOnlinePlatform(ECommercePlatform.OFFLINE)` → `false`; drives
tax-at-checkout and local-only paths (e.g. `BasketPanel`).

## P-R2 — The capability matrix is the single source of truth for platform behaviour

**Rule**
`PLATFORM_CAPABILITY_MATRIX` gives per-platform `CapabilityLevel`
(`supported|custom|not_recommended`) for catalog, customers, inventory,
orderSync, discounts, giftCards, refunds, loyalty, storeCredit, plus
`basketMode` (`native_draft|remote_cart|local_only`) — which decides how
checkout talks to the platform (draft / remote cart / local-only). Unknown or
null platform ⇒ OFFLINE profile (silent).

**Evidence** — `utils/platformCapabilities.ts:71`; gating helpers
`supportsStrict/supportsWithCustom/isNotRecommended/getUnavailableReason`.

🟢 **E2.1** — Shopify `basketMode: 'native_draft'` → checkout sends a platform
draft order and platform computes tax; Magento/WooCommerce use `remote_cart`;
OFFLINE is `local_only` — basket never leaves the device.

🟠 **E2.2 — `custom` means adapter-gated** — e.g. WooCommerce giftCards;
visibility comes from `menuCapabilityAccess` (adapterReady check), not from
this matrix alone.

🟠 **E2.3 — OFFLINE loyalty/storeCredit are `supported`** — the local SQLite
ledgers always work; the level describes _platform sync_, not availability
(comment at `platformCapabilities.ts:52`).

🔴 **E2.4 — Silent fallback** — a typo'd platform string resolves to the
OFFLINE profile instead of erroring; misconfiguration is invisible. PG10.

## P-R3 — App IDs are platform-prefixed; raw IDs only at the boundary

**Rule**
Internally products/variants are `platform-id` (`shopify-123`, `shopify-123-456`).
`toPlatformProductId` strips the prefix (or uses `originalId`);
`toPlatformVariantId` also maps the synthetic `'default'` variant → `undefined`.

**Evidence** — `utils/platformIds.ts`, `platformIds.test.ts`.

🟢 **E3.1** — `toPlatformVariantId('shopify', {productId:'shopify-123', variantId:'shopify-123-456'})` → `'456'`.
🟠 **E3.2** — variantId `'default'` (product without real variants) → `undefined`
so no variant is sent to the platform.
🟠 **E3.3** — un-prefixed productId passes through unchanged — callers must not
double-strip.

## P-R4 — `electron.ts` detects the desktop shell and types its IPC surface

**Rule**
`isElectron()` = RN `Platform.OS === 'web'` **and** (`window.isElectron ===
true` **or** UA contains 'electron'). `getElectronAPI()` returns the preload
bridge (`printerSendRawData`, `onBarcodeScan`, `drawerOpen`, `paymentCollect`,
`secureStorage`, window controls) or null. `getPlatformType()` maps to
`ios|android|web|desktop`.

**Evidence** — `utils/electron.ts`; ~12 consumers (printer/scanner/drawer/
payment services).

🟢 **E4.1 — Desktop hardware path** — under Electron, services call
`electronAPI.printerSendRawData(...)`; off-Electron the same services use
native transports.

🔴 **E4.2 — UA false-positive** — any web view with 'electron' in its UA is
treated as desktop and loses native fallbacks. PG4.

🔴 **E4.3 — `getAppVersion()` returns '1.0.0'** on non-Electron — the comment
admits expo-constants isn't wired. Parent-map Q3.

## ❓ Questions

- **P-Q1** — `basketMode` for Commercefull is `native_draft`; does its API
  actually expose a draft-order object, or is this aspirational (per
  capability-rollout spec)?
- **P-Q2** — Is the OFFLINE-fallback-on-unknown-platform a deliberate
  fail-open, or should it fail loudly?

## Coverage

| Example                    | Coverage              |
| -------------------------- | --------------------- |
| P-R3 ID mapping            | `platformIds.test.ts` |
| P-R1/R2 matrix + fallbacks | Not found             |
| P-R4 detection             | Not found             |
