# AGENT.md — RetailPOS Context Guide

> This file is the **first thing an AI agent or new developer reads**. It orients you to the project and tells you where the detailed rules live. Do not add implementation detail here — it belongs in `docs/guidelines/`.

---

## What this project is

RetailPOS is a cross-platform point-of-sale application (React Native + Expo + Electron) that connects to 9 e-commerce platforms (Shopify, WooCommerce, Magento, BigCommerce, Sylius, Wix, PrestaShop, Squarespace, CommerceFull) plus a fully-offline mode. It supports basket management, checkout, payment terminals, barcode scanning, receipt printing, multi-register operation over a LAN, and role-based permissions.

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

```
App.tsx             # Root — providers, startup bootstrap
assets/             # Static images and icons
components/         # Shared React Native UI components
contexts/           # React Context providers (Basket, Auth, Category, …)
docs/
  adr/              # Architecture Decision Records (ADR-001 … ADR-015)
  specs/            # EARS requirement specs per domain
  steering/         # Canonical rules: language, patterns, coding standards, UX, testing
electron/           # Electron desktop shell (main.js, IPC bridge)
hooks/              # Custom hooks — one per domain, wraps factory calls
locales/            # i18n translation files (en, es, fr, de)
navigation/         # React Navigation setup (Root, MainTab, More navigators)
repositories/       # SQLite data access layer — one file per entity
screens/            # Screen components + settings tabs + onboarding steps
services/           # All business logic and platform integrations (see below)
utils/              # money.ts, theme.ts, platforms.ts, platformCapabilities.ts, …
```

### Key `services/` directories

| Directory        | Purpose                                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ |
| `audit/`         | AuditLogService — KV-backed append-only log + CSV export                                                           |
| `auth/`          | Pluggable multi-method auth (PIN, biometric, magstripe, …)                                                         |
| `basket/`        | BasketService — cart CRUD only                                                                                     |
| `checkout/`      | CheckoutService — startCheckout, completePayment, order queries                                                    |
| `config/`        | POSConfigService + ServiceConfigBridge                                                                             |
| `customer/`      | Customer lookup — 10 platforms + factory                                                                           |
| `discount/`      | Coupon / discount validation — 10 platforms + factory                                                              |
| `drawer/`        | CashDrawer peripheral (decoupled from printer)                                                                     |
| `giftcard/`      | Gift card — 10 platforms + factory                                                                                 |
| `inventory/`     | Inventory read / write — 10 platforms + factory                                                                    |
| `localapi/`      | Multi-register LAN API (server / client / discovery / sync / WebSocket / payment orchestration)                    |
| `logger/`        | LoggerFactory + pluggable LogTransport                                                                             |
| `notifications/` | NotificationService singleton + Toast                                                                              |
| `order/`         | Order domain — 10 platforms + factory                                                                              |
| `payment/`       | Payment terminals — Stripe NFC, Stripe, Square, Adyen, Tap Payments, Instore API (PED via store-api orchestration) |
| `permissions/`   | PermissionService, ManagerApprovalService, action registry                                                         |
| `printer/`       | Receipt printing — USB/BT/Net/Electron                                                                             |
| `product/`       | Product catalog — 10 platforms + factory                                                                           |
| `procurement/`   | Purchase orders, vendors, stock-takes, transfer orders                                                             |
| `returns/`       | ReturnService — returns + refunds, 10 platform adapters                                                            |
| `scanner/`       | Barcode scanning — camera, BT, USB, QR hardware, Electron                                                          |
| `search/`        | Product search — 10 platforms + factory                                                                            |
| `sync/`          | OrderSyncService + BackgroundSyncService (exponential backoff)                                                     |
| `tax/`           | TaxProfileService + TaxServiceFactory (strategy pattern)                                                           |

---

## Non-Negotiable Rules (quick reference)

Full rules with examples: `docs/guidelines/coding-standards.md`

1. No `any` types. No `.js` files.
2. No barrel/index re-export files — import source files directly.
3. No `console.log/error/warn` — use `LoggerFactory` or injected `LoggerInterface`.
4. No hardcoded colours, spacing, or typography — use `utils/theme.ts`.
5. No hardcoded config values — use `posConfig.values`.
6. No raw float arithmetic on money — use `utils/money.ts`.
7. No `I`-prefixed interface names (`IOrderRepository` → `OrderRepository`).
8. Hooks: always `export const useX`, state flag is `isLoading`.
9. Contexts: named exports only (`export const XProvider` + `export const useX`).
10. Drawer is UI-driven — services set `openDrawer` flag; UI calls the driver.
11. Role access defaults to `'cashier'` (least privilege) when role is `undefined`.
12. All monetary arithmetic goes through `utils/money.ts` (ADR-006).

---

## Where to find detailed guidance

| Topic                               | Document                                   |
| ----------------------------------- | ------------------------------------------ |
| Domain vocabulary (canonical terms) | `docs/guidelines/ubiquitous-language.md`   |
| Coding standards & naming           | `docs/guidelines/coding-standards.md`      |
| Architecture patterns (with code)   | `docs/guidelines/architecture-patterns.md` |
| UX / theme / component structure    | `docs/guidelines/ux-standards.md`          |
| Testing setup & mock patterns       | `docs/guidelines/testing-guidelines.md`    |
| Architecture overview               | `ARCHITECTURE.md`                          |
| Feature requirements (EARS specs)   | `docs/specs/[domain]/`                     |
| Architecture decisions              | `docs/adr/ADR-NNN-*.md`                    |
