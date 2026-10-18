# AGENT.md — RetailPOS Context Guide

> This file is the **first thing an AI agent or new developer reads**. It orients you to the project and tells you where the detailed rules live. Do not add implementation detail here — it belongs in `docs/guidelines/`.

---

## What this project is

RetailPOS is a cross-platform point-of-sale application (React Native + Expo + Electron) that connects to 8 e-commerce platforms (Shopify, WooCommerce, Magento, BigCommerce, Sylius, Wix, PrestaShop, Commercefull) plus a fully-offline mode. It supports basket management, checkout, payment terminals, barcode scanning, receipt printing, multi-register operation over a LAN, and role-based permissions.

---

## Environment

- **Node.js**: v22 (`nvm use 22`)
- **Package manager**: Yarn 1 (`yarn install`)
- **Pre-commit**: husky + lint-staged — runs `eslint --fix` + `prettier --write` automatically

```bash
yarn start          # Metro bundler
yarn ios / android  # simulators
yarn desktop        # Electron
yarn test           # Jest unit tests
yarn lint           # tsc --noEmit + ESLint
yarn lint:fix       # auto-fix
yarn format         # Prettier
```

---

## Project Structure (one-liner per folder)

The codebase is **feature-sliced**: each domain owns its screens, components, hooks, contexts, services and repositories under `features/<domain>/`. Cross-feature code lives in `shared/`. There is no root-level `services/`, `screens/`, `hooks/` etc.

```
App.tsx             # Root — providers, startup bootstrap
app/
  app/navigation/# React Navigation setup (Root, Auth, MainTab, More + MoreMenuComposer)
  providers/        # App-level providers (DataProvider)
assets/             # Static images and icons
docs/
  adr/              # Architecture Decision Records (ADR-001 … ADR-018)
  features/         # Feature docs — README (what/where) + rules.md (behaviour) per feature
  guidelines/       # Canonical rules: language, patterns, coding standards, UX, testing
  security/         # Deployment security — network segmentation, hardening, controls
electron/           # Electron desktop shell (main.js, IPC bridge)
features/           # Feature slices — one folder per domain (see below)
shared/
  components/# Shared UI primitives (Button, Card, Toast, ErrorBoundary, …)
  contexts/# Cross-feature providers (Theme, Notification)
  hooks/# Cross-feature hooks (useTranslate, useLogger, useResponsive, useSyncStore, …)
  shared/locales/# i18n — en/es/fr/de + i18n.ts
  repositories/# Shared stores (KeyValue, WebhookDelivery)
  services/# audit, logger, notifications, queue, search, secrets
  utils/# theme, money, crypto, db + dbSchema, platforms, platformCapabilities, csv, sql, …
tests/              # Jest setup, mocks, integration tests
```

### Feature anatomy

Each `features/<domain>/` may contain `components/`, `contexts/`, `hooks/`, `repositories/`, `screens/`, `services/`, `utils/` and an `index.ts` (declared public surface — code still imports source files directly).

### Key `features/` directories

| Feature             | Purpose                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `authentication/`   | Pluggable multi-method auth (PIN, biometric, password, magstripe, RFID/NFC, platform) + users & permissions                       |
| `basket/`           | BasketService — cart CRUD; basket state/actions providers                                                                         |
| `catalogue/`        | Product + category services (9 platforms + offline); CategoryProvider                                                             |
| `checkout/`         | CheckoutService, tax quote, sale/checkout providers + screens                                                                     |
| `customers/`        | Customer lookup (9 platforms), loyalty, store credit                                                                              |
| `discounts/`        | Coupon / discount validation (9 platforms + local)                                                                                |
| `hardware/`         | Receipt printers, cash drawer, scanner drivers, KDS, customer display                                                             |
| `inventory/`        | Inventory read/write (9 platforms), barcode labels                                                                                |
| `multi-register/`   | In-store LAN API — server (desktop app only)/client config, HMAC-signed transport, discovery, WebSocket + sync, PED orchestration |
| `onboarding/`       | First-run wizard                                                                                                                  |
| `orders-sync/`      | Order repositories + platform order services; OrderSyncService + BackgroundSyncService; order screens                             |
| `payments/`         | Payment terminals — Stripe NFC, Stripe, Square, Adyen, Tap Payments, Instore API provider                                         |
| `platform-clients/` | BaseApiClient + per-platform clients; config (POSConfigService, credentials, ProtectedValueStore); token lifecycle; tax profiles  |
| `procurement/`      | Purchase orders, vendors, stock-takes, transfer orders                                                                            |
| `reporting/`        | Sales analytics, CSV export                                                                                                       |
| `returns/`          | Returns + refunds (platform refund adapters), exchanges                                                                           |
| `scanning/`         | Scan-input hooks/components(drivers live in `hardware/services/scanner`)                                                          |
| `settings/`         | Settings screens + `SettingsTabComposer` (role-gated tabs)                                                                        |

---

## Non-Negotiable Rules (quick reference)

Full rules with examples: `docs/guidelines/coding-standards.md`

1. No `any` types. No `.js` files.
2. No barrel/index re-export files — import source files directly.
3. No `console.log/error/warn` — use `LoggerFactory` or injected `LoggerInterface`.
4. No hardcoded colours, spacing, or typography — use `shared/utils/theme.ts`.
5. No hardcoded config values — use `posConfig.values`.
6. No raw float arithmetic on money — use `shared/utils/money.ts`.
7. No `I`-prefixed interface names (`IOrderRepository` → `OrderRepository`).
8. Hooks: always `export const useX`, state flag is `isLoading`.
9. Contexts: named exports only (`export const XProvider` + `export const useX`).
10. Drawer is UI-driven — services set `openDrawer` flag; UI calls the driver.
11. Role access defaults to `'cashier'` (least privilege) when role is `undefined`.
12. All monetary arithmetic goes through `shared/utils/money.ts` (ADR-006).

---

## Where to find detailed guidance

| Topic                               | Document                                       |
| ----------------------------------- | ---------------------------------------------- |
| Domain vocabulary (canonical terms) | `docs/guidelines/ubiquitous-language.md`       |
| Coding standards & naming           | `docs/guidelines/coding-standards.md`          |
| Architecture patterns (with code)   | `docs/guidelines/architecture-patterns.md`     |
| UX / theme / component structure    | `docs/guidelines/ux-standards.md`              |
| Testing setup & mock patterns       | `docs/guidelines/testing-guidelines.md`        |
| Architecture overview               | `ARCHITECTURE.md`                              |
| Feature behaviour & rules           | `docs/features/[feature]/` (README + rules.md) |
| Security & network deployment       | `docs/security/` (segmentation, hardening)     |
| Architecture decisions              | `docs/adr/ADR-NNN-*.md`                        |
