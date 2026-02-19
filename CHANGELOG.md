# Changelog

All notable changes to RetailPOS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Open source documentation and contribution guidelines
- Code of Conduct for community standards
- Security policy for vulnerability reporting
- GitHub issue and pull request templates
- UUID utility for React Native compatibility
- **POSConfigService** (`services/config/POSConfigService.ts`) — runtime POS configuration with no hardcoded defaults; all values set during onboarding
- **POSSetupStep** onboarding screen — collects store name, tax rate, currency, drawer settings
- **POS Config** settings tab — edit configuration values after onboarding
- **LogTransport** interface for pluggable logging providers (Sentry, Datadog, NewRelic)
- **CheckoutService** — separated from BasketService, handles payment + order queries
- **OrderSyncService** — separated from BasketService, handles platform sync with per-order retry tracking
- **BackgroundSyncService** — exponential backoff (capped at 15 min), pauses when app is backgrounded
- **CashDrawerServiceInterface** — standalone peripheral decoupled from printer, with `PrinterDrawerDriver` and `NoOpDrawerDriver`
- `CheckoutResult.openDrawer` flag — service decides if drawer opens, UI executes
- `onDisconnect()` / `offDisconnect()` callbacks on `ScannerServiceInterface`
- `openDrawer(pin)` method on `BasePrinterService` with ESC/POS drawer kick commands
- **All Planned Features Complete** — final integration session implementing all remaining POS capabilities
- **Platform Extensions**: BigCommerce, Magento, Sylius, Wix, PrestaShop, Squarespace customer/discount/giftcard services (24 new implementations)
- **Customer Search Modal**: Platform customer lookup and attachment during checkout
- **Notification System**: Real-time alerts for sync events, inventory changes, returns processing
- **Audit Logging**: Complete audit trail for user actions and system events
- **Error Boundary**: Crash recovery with retry UI and basket persistence
- **Refund + Returns Merge**: ReturnService now orchestrates platform refunds
- **Accessibility Audit**: Full screen reader support across all interactive components
- 55 tests across 4 suites (money, BasketService, CheckoutService, POSConfigService)

### Changed

- Updated README to be developer-focused
- Improved require cycle resolution in service architecture
- Enhanced TypeScript compilation and linting
- **Moved** `config/pos.ts` → `services/config/POSConfigService.ts`
- **Consolidated** `SettingsRepository` and `KeyValueRepository` — both now use the single `key_value_store` table; `SettingsRepository` is a typed JSON facade over `KeyValueRepository`
- **DB schema v2** — migrates data from legacy `settings` table into `key_value_store` and drops `settings`
- `DEFAULT_TAX_RATE` and `MAX_SYNC_RETRIES` are now functions (not constants) — loaded from settings DB
- `PaymentServiceInterface.disconnect()` is now `Promise<void> | void` (async-compatible)
- `ErrorReportingService` removed — all services use `LoggerInterface` with pluggable transports
- Updated `ARCHITECTURE.md` and `AGENT.md` with all architectural changes
- **README.md**: Updated with complete feature list and project structure

### Fixed

- Crypto module compatibility issues for Expo/React Native
- Double setState bug in ecommerce settings hook
- Memory leaks in category and search hooks
- Unsafe error handling in printer settings

## [2.0.0] - 2024-01-XX

### Added

- Complete rewrite with React Native and Expo
- Multi-platform e-commerce support (Shopify, WooCommerce, BigCommerce, etc.)
- Offline mode with local SQLite storage
- Hardware integration (printers, scanners, payment terminals)
- Cross-platform support (iOS, Android, Web, Desktop)
- Multi-language support (English, Spanish, French, German)
- Role-based user management
- Real-time inventory sync
- Receipt printing and barcode scanning

### Changed

- Migration from previous architecture to clean architecture pattern
- Improved state management with Zustand
- Enhanced error handling and logging

### Removed

- Legacy platform-specific implementations

## [1.x.x] - Previous Versions

Previous versions were internal releases and not publicly documented.

---

## Types of Changes

- `Added` for new features
- `Changed` for changes in existing functionality
- `Deprecated` for soon-to-be removed features
- `Removed` for now removed features
- `Fixed` for any bug fixes
- `Security` in case of vulnerabilities

## Version Numbering

We use [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

## Contributing to the Changelog

When contributing to RetailPOS, please update this changelog with your changes. Follow the format above and add your changes to the "Unreleased" section.
