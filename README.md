# RetailPOS — Point of Sale System for E-commerce Platforms

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/n17foo/retailpos/workflows/CI/badge.svg)](https://github.com/n17foo/retailpos/actions)
[![Release](https://github.com/n17foo/retailpos/workflows/Release/badge.svg)](https://github.com/n17foo/retailpos/actions/workflows/release.yml)

A modern, cross-platform (mobile, tablet and desktop) Point of Sale (POS) system built with React Native and Expo. Supports multiple e-commerce platforms, offline operation, and hardware integration.

Website: [retailpos.org](https://retailpos.org)

---

## Features

- **Multi-Platform Support** — Shopify, WooCommerce, BigCommerce, Magento, Sylius, Wix, PrestaShop, Commercefull, Offline
- **Offline-First** — Full POS functionality without internet; background sync with retry and exponential backoff
- **Multi-Register** — Server/client mode over LAN with event-driven sync (SyncEventBus + SyncPoller)
- **Product Variants** — Option-based variants with inventory tracking and barcode lookup
- **Tax Profiles** — Configurable tax rates; platform-authoritative tax for online orders
- **Checkout Flow** — Draft order creation, payment recording, cash drawer integration
- **Returns & Refunds** — Return recording with optional platform monetary refund (9 platforms)
- **Customer Management** — Search and attach customers from platform APIs during checkout
- **Reporting Dashboard** — Sales analytics, cashier performance, payment breakdown, CSV export
- **Sync Queue** — Retry/discard failed orders with detailed error tracking
- **Notifications** — Real-time alerts for sync events and returns
- **Audit Logging** — Append-only event log for orders, payments, refunds, and auth
- **Hardware Integration** — Receipt printers (ESC/POS), barcode scanners (camera/BT/USB/QR), payment terminals, cash drawers, kitchen display systems (KDS), customer-facing display
- **Payment Providers** — Stripe NFC (tap-to-pay), Stripe Terminal, Square, Adyen, Tap Payments (React Native SDK providers only; non-SDK providers via Instore API)
- **Authentication** — PIN, biometric, password, magstripe, RFID/NFC, platform auth
- **Role-Based Access** — Admin, Manager, Cashier with least-privilege defaults
- **Cross-Platform** — iOS, Android, Web, Desktop (Electron)
- **Multi-Language** — English, Spanish, French, German

---

## Architecture

RetailPOS follows a strict four-layer architecture with unidirectional dependencies:

- **Screens** — Full-screen views that compose components and call hooks
- **Components** — Reusable UI fragments with props-in/callbacks-out pattern
- **Hooks** — Domain-specific hooks that manage async state and call service factories
- **Services** — All business logic and platform integration (zero React imports)

**Cross-cutting**: Contexts provide global state (Basket, Auth, Category) shared across screens.

Key architectural decisions are documented in [`docs/adr/`](docs/adr/) and the full technical reference is in [`ARCHITECTURE.md`](ARCHITECTURE.md). Implementation patterns with code examples are in [`docs/guidelines/architecture-patterns.md`](docs/guidelines/architecture-patterns.md).

---

## Tech Stack

| Layer      | Technology                           |
| ---------- | ------------------------------------ |
| Framework  | React Native + Expo SDK 57           |
| Language   | TypeScript 6.x (strict mode)         |
| Navigation | React Navigation 7.x                 |
| State      | React Context + Zustand (sync queue) |
| Database   | SQLite via `expo-sqlite`             |
| Desktop    | Electron                             |
| Styling    | StyleSheet + `shared/utils/theme.ts` |
| i18n       | react-i18next + expo-localization    |
| Logging    | Custom LoggerFactory + transports    |
| Testing    | Jest                                 |
| Linting    | ESLint 10 (flat config) + Prettier   |

---

## Prerequisites

- Node.js 22.x
- Yarn 1.x
- Expo CLI — `npm install -g @expo/cli`

---

## Quick Start

```bash
git clone https://github.com/n17foo/retailpos.git
cd retailpos
yarn install
cp .env.example .env
```

```bash
yarn ios        # iOS simulator
yarn android    # Android emulator
yarn web        # Web browser
yarn desktop    # Electron desktop
```

On first launch, follow the onboarding wizard to choose your platform, configure hardware, and create an admin account.

---

## Testing

```bash
yarn test              # Run all tests
yarn test:watch        # Watch mode
yarn test:coverage     # With coverage report
yarn lint              # ESLint + type check
yarn lint:fix          # Auto-fix
yarn format            # Prettier
yarn doctor            # Expo Doctor — verify project health
```

---

## Recent Changes — Expo SDK 57 Migration

The project has been upgraded to **Expo SDK 57**, **TypeScript 6.x** (strict mode), and **ESLint 10**:

- **Expo SDK 57** — Upgraded all Expo packages; splash screen migrated to config plugin (`expo-splash-screen`); installed `@expo/vector-icons` and `expo-font` as peer dependencies
- **TypeScript strict mode** — Enabled `"strict": true` in `tsconfig.json`; fixed 107 type errors across ~50 files (catch-block type guards, SQLite bind param types, null/undefined assignments, spread-on-unknown)
- **ESLint 10** — Migrated from `eslint-plugin-react` / `eslint-plugin-react-native` (incompatible with ESLint 10); fixed 24 rule violations (`preserve-caught-error`, `no-useless-assignment`, formatting)
- **Deprecated API replacements** — `StyleSheet.absoluteFillObject` → `absoluteFill` (removed in RN 0.86)

Run `yarn doctor` to verify the project passes all 20 Expo Doctor checks.

---

## Releases

RetailPOS uses [Conventional Commits](https://www.conventionalcommits.org/) and [`standard-version`](https://github.com/conventional-changelog/standard-version) to automate semver tagging and changelog generation.

### Commit message format

```
<type>(<optional scope>): <description>

feat(checkout): add split payment support     → minor bump
fix(scanner): handle empty barcode string     → patch bump
feat!: redesign checkout API                  → major bump
chore: update dependencies                    → no bump (hidden)
```

| Type                         | Changelog section | Version bump |
| ---------------------------- | ----------------- | ------------ |
| `feat`                       | Features          | minor        |
| `fix`                        | Bug Fixes         | patch        |
| `perf`                       | Performance       | patch        |
| `refactor`                   | Refactoring       | patch        |
| `test`                       | Tests             | patch        |
| `chore`                      | — hidden —        | none         |
| `docs`                       | — hidden —        | none         |
| `feat!` / `BREAKING CHANGE:` | —                 | major        |

The `commit-msg` husky hook enforces this format on every commit locally.

### Cutting a release locally

```bash
yarn release           # auto-detects bump from commits since last tag
yarn release:patch     # force patch (1.0.0 → 1.0.1)
yarn release:minor     # force minor (1.0.0 → 1.1.0)
yarn release:major     # force major (1.0.0 → 2.0.0)

git push --follow-tags origin main
```

This bumps `package.json`, updates `CHANGELOG.md`, commits both, and creates a `vX.Y.Z` git tag.

### Cutting a release from GitHub

Go to **Actions → Release → Run workflow**, choose the release type (`auto`, `patch`, `minor`, or `major`), and click **Run**. The workflow runs tests first and only tags if they pass.

---

## Environment Variables

Copy `.env.example` to `.env`. Key flags:

```env
# Mock services for development (no real hardware or API calls)
USE_MOCK_SCANNER=true
USE_MOCK_PAYMENT=true
USE_MOCK_PRINTERS=true
USE_MOCK_SECRETS=true

# Platform credentials (set per platform as needed)
SHOPIFY_STORE_URL=your-shop.myshopify.com
SHOPIFY_API_VERSION=2024-01
WOOCOMMERCE_URL=https://yourstore.com
```

---

## Project Structure

The codebase is **feature-sliced** — each domain owns its screens, components, hooks, contexts, services and repositories under `features/<domain>/`. Cross-feature code lives in `shared/`.

```
retailpos/
├── App.tsx                    # Root — providers, startup init
├── app/
│   ├── app/navigation/# Root, Auth, MainTab, More navigators + MoreMenuComposer
│   └── providers/             # App-level providers (DataProvider)
├── features/                  # Feature slices — one folder per domain
│   ├── authentication/        # PIN/biometric/magstripe/RFID auth + users & permissions
│   ├── basket/                # Cart CRUD + basket providers
│   ├── catalogue/             # Products + categories (9 platforms + offline)
│   ├── checkout/              # CheckoutService, tax quote, sale/checkout screens
│   ├── customers/             # Customer lookup, loyalty, store credit
│   ├── discounts/             # Coupon/discount validation
│   ├── hardware/              # Printer, drawer, scanner drivers, KDS, customer display
│   ├── inventory/             # Stock read/write, barcode labels
│   ├── multi-register/        # In-store LAN API: signed transport, discovery, sync, PED
│   ├── onboarding/            # First-run wizard
│   ├── orders-sync/           # Order repositories + platform sync + order screens
│   ├── payments/              # Stripe, Square, Adyen, Tap, Instore API provider
│   ├── platform-clients/      # Platform API clients, config, tokens, tax profiles
│   ├── procurement/           # Purchase orders, vendors, stock-takes, transfers
│   ├── reporting/             # Sales analytics, CSV export
│   ├── returns/               # Returns + refunds (platform adapters)
│   ├── scanning/              # Scan-input hooks/components
│   └── settings/              # Settings screens + role-gated tab composer
├── shared/                    # Cross-feature code
│   ├── components/# UI primitives (Button, Card, Toast, ErrorBoundary, …)
│   ├── contexts/# Theme + Notification providers
│   ├── hooks/# useTranslate, useLogger, useResponsive, useSyncStore, …
│   ├── shared/locales/# i18n — en/es/fr/de
│   ├── repositories/# KeyValue + WebhookDelivery stores
│   ├── services/# audit, logger, notifications, queue, search, secrets
│   └── utils/# theme, money, crypto, db + dbSchema, platforms, csv, sql, …
├── electron/                  # Electron desktop shell
├── tests/                     # Jest setup, mocks, integration tests
└── docs/
    ├── adr/                   # Architecture Decision Records (17 ADRs)
    ├── features/              # Per-feature README + rules.md
    ├── guidelines/            # Canonical development rules
    │   ├── ubiquitous-language.md      # Domain vocabulary
    │   ├── architecture-patterns.md    # Implementation patterns
    │   ├── coding-standards.md         # TypeScript & naming rules
    │   ├── ux-standards.md             # Theme & component structure
    │   └── testing-guidelines.md       # Test structure & mocks
    └── security/              # Network segmentation, hardening, controls inventory
```

---

## Documentation

| Document                                                                               | Purpose                                                       |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)                                                   | Technical architecture, patterns, database schema             |
| [`AGENT.md`](AGENT.md)                                                                 | Quick-start context guide for developers and AI agents        |
| [`docs/adr/`](docs/adr/)                                                               | Architecture Decision Records (17 ADRs)                       |
| [`docs/features/`](docs/features/)                                                     | Per-feature docs — README (what/where) + rules.md (behaviour) |
| [`docs/security/`](docs/security/)                                                     | Network segmentation, in-store server hardening, controls     |
| [`docs/guidelines/`](docs/guidelines/)                                                 | **Canonical development rules** (see below)                   |
| [`docs/guidelines/ubiquitous-language.md`](docs/guidelines/ubiquitous-language.md)     | Domain vocabulary — single source of truth for all terms      |
| [`docs/guidelines/architecture-patterns.md`](docs/guidelines/architecture-patterns.md) | Implementation patterns with code examples                    |
| [`docs/guidelines/coding-standards.md`](docs/guidelines/coding-standards.md)           | TypeScript, naming, file structure, common tasks              |
| [`docs/guidelines/ux-standards.md`](docs/guidelines/ux-standards.md)                   | Theme system, component structure, accessibility              |
| [`docs/guidelines/testing-guidelines.md`](docs/guidelines/testing-guidelines.md)       | Test structure, mocks, running tests                          |
| [`CONTRIBUTING.md`](CONTRIBUTING.md)                                                   | Contribution guidelines                                       |
| [`CHANGELOG.md`](CHANGELOG.md)                                                         | Version history                                               |
| [`SECURITY.md`](SECURITY.md)                                                           | Security policy                                               |

### Steering Docs (Canonical Rules)

The `docs/guidelines/` directory contains the **single source of truth** for development standards:

- **ubiquitous-language.md** — Domain vocabulary used across specs, code, tests, and ADRs. Use terms exactly as defined.
- **architecture-patterns.md** — Service layer, repository pattern, context providers, factories, background jobs (with code examples).
- **coding-standards.md** — TypeScript rules, naming conventions, file organization, the 14 non-negotiable rules.
- **ux-standards.md** — Theme system (`shared/utils/theme.ts`), component structure, accessibility, responsive layout.
- **testing-guidelines.md** — Test file location, required mocks, test structure, running tests.

### Architecture Decision Records

| ADR                                                                   | Decision                                                   |
| --------------------------------------------------------------------- | ---------------------------------------------------------- |
| [ADR-001](docs/adr/ADR-001-service-split.md)                          | Service split — Basket, Checkout, OrderSync                |
| [ADR-002](docs/adr/ADR-002-repository-interface-pattern.md)           | Repository interface pattern — no I-prefix                 |
| [ADR-003](docs/adr/ADR-003-multi-register-repository-injection.md)    | Multi-register — repository injection at wiring time       |
| [ADR-004](docs/adr/ADR-004-offline-first-sqlite.md)                   | Offline-first SQLite with async platform sync              |
| [ADR-005](docs/adr/ADR-005-platform-abstraction-factory.md)           | Platform abstraction via Factory + Interface               |
| [ADR-006](docs/adr/ADR-006-money-integer-cent-math.md)                | Money arithmetic — integer-cent math                       |
| [ADR-007](docs/adr/ADR-007-pluggable-logger.md)                       | Pluggable logger with transport pattern                    |
| [ADR-008](docs/adr/ADR-008-authentication-pluggable-multi-method.md)  | Authentication — pluggable multi-method with PIN fallback  |
| [ADR-009](docs/adr/ADR-009-tax-calculation-platform-authoritative.md) | Tax calculation — platform-authoritative for online orders |
| [ADR-010](docs/adr/ADR-010-cash-drawer-ui-driven.md)                  | Cash drawer — UI-driven, service-decided                   |
| [ADR-011](docs/adr/ADR-011-notification-singleton-event-bus.md)       | Notification system — singleton event bus                  |
| [ADR-012](docs/adr/ADR-012-audit-log-kv-append-only.md)               | Audit log — KV-backed append-only                          |
| [ADR-013](docs/adr/ADR-013-scanner-hardware-abstraction.md)           | Scanner hardware abstraction — four types, one interface   |
| [ADR-014](docs/adr/ADR-014-spec-first-development.md)                 | Spec-first development with EARS format                    |
| [ADR-015](docs/adr/ADR-015-ped-integration-via-instore-api.md)        | PED integration via Instore API — not direct provider      |
| [ADR-016](docs/adr/ADR-016-platform-token-lifecycle.md)               | Platform token lifecycle                                   |
| [ADR-017](docs/adr/ADR-017-sale-screen-fast-path.md)                  | Sale screen fast path                                      |

### Feature Docs

Hardware- and platform-facing behaviour is specified per feature in `docs/features/<name>/` (README + rules.md):

| Doc                                                 | Purpose                                              |
| --------------------------------------------------- | ---------------------------------------------------- |
| [Hardware](docs/features/hardware/)                 | Printer, cash drawer, scanner, KDS, customer display |
| [Scanning](docs/features/scanning/)                 | Camera, BT, USB, QR scan input                       |
| [Payments](docs/features/payments/)                 | Stripe NFC, Stripe, Square, Adyen, Tap Payments      |
| [Authentication](docs/features/authentication/)     | PIN, biometric, magstripe, RFID/NFC, permissions     |
| [Multi-register](docs/features/multi-register/)     | LAN API, signed requests, discovery, sync            |
| [Platform clients](docs/features/platform-clients/) | API clients, config, tokens, tax profiles            |

---

## Builds

Electron desktop installers (Windows, macOS, Linux) are built automatically on every push to `main`. Download from [GitHub Actions](https://github.com/n17foo/retailpos/actions).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). In brief:

1. Fork and create a feature branch
2. Read [AGENT.md](AGENT.md) for project orientation
3. Follow the canonical rules in [`docs/guidelines/`](docs/guidelines/)
4. Use domain vocabulary from [`docs/guidelines/ubiquitous-language.md`](docs/guidelines/ubiquitous-language.md)
5. Match existing patterns from [`docs/guidelines/architecture-patterns.md`](docs/guidelines/architecture-patterns.md)
6. Run `yarn lint` and `yarn test` before submitting
7. Submit a pull request with conventional commit messages

---

## Security

See [SECURITY.md](SECURITY.md) for reporting and [docs/security/](docs/security/) for deployment guidance — dedicated POS network segmentation, in-store server hardening, and the implemented controls inventory. Known residual risks (including the plaintext LAN transport — a dedicated VLAN is required) are tracked in [`docs/security/security-controls.md`](docs/security/security-controls.md).

---

## License

Apache License 2.0 — see [LICENSE](LICENSE).

---

## Need Help?

RetailPOS is built and maintained by **[N17](https://n17.foo)** — a software studio specialising in retail and commerce infrastructure.

- **Platform integration** — Shopify, WooCommerce, BigCommerce, Magento, and more
- **Custom hardware setup** — scanners, printers, cash drawers, card terminals
- **Multi-register deployment** — server/client mode across multiple registers
- **Custom feature development** — loyalty, custom reporting, bespoke payment flows
- **Production hardening** — PIN hashing, encrypted credentials, PCI guidance
- **Staff training & onboarding**

🌐 [n17.foo](https://n17.foo) · 📧 [hello@n17.foo](mailto:hello@n17.foo)

---

**RetailPOS** — Bridging the gap between physical and digital retail.
