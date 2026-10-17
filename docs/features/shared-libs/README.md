# Shared Libraries

## Purpose

The shared libraries are the app's cross-cutting infrastructure layer: every
behavioural rule that must hold identically across screens, hooks, services, and
repositories is implemented once in `utils/` (there is no `libs/` directory) and
consumed by features. They include money math, the design-token/theme system,
the platform capability matrix, the SQLite persistence backbone, credential
hashing, role/capability gating, and pure domain rules extracted from hooks so
they can run under node/Jest.

Because these libraries have no UI of their own, the "feature" is inverted:
the _consumers_ are other features, and misbehaviour propagates everywhere.

## Scope

### Included

- `utils/*.ts` — all 27 non-test modules (see Implementation Map).
- Behavioural contracts other features rely on: cent-based money, sellability,
  category selection, HID burst detection, layout classes, role/capability
  gating, order state mapping, persistence schema/migrations, PIN hashing,
  CSV/formula-injection escaping.

### Excluded

- `services/` business logic (BasketService, CheckoutService, factories) —
  documented per feature. Utils only _serve_ them.
- `contexts/` state ownership — utils are stateless (or instance-scoped) by
  convention; shared state lives in providers.
- `hooks/` — hooks consume utils; they are feature-owned.
- `repositories/` — consume `utils/db.ts`/`dbSchema.ts`/`sql.ts` but own the
  table access code itself.

## Entry Points

Utils are entered by import, not navigation. Highest-fan-in entry points:

| Util                      | Consumers (approx.) | Main call sites                             |
| ------------------------- | ------------------- | ------------------------------------------- |
| `theme.ts`                | ~97 files           | Nearly every `.tsx`                         |
| `platforms.ts`            | ~97 files           | Services, navigation, repositories          |
| `money.ts`                | ~34 files           | Basket, checkout, order, printer services   |
| `electron.ts`             | ~12 files           | Printer/scanner/drawer/payment services     |
| `db.ts`                   | ~19 files           | All `repositories/`                         |
| `platformCapabilities.ts` | ~11 files           | Menu composers, service guards, settings UI |

Module-load side effects (relevant to lifecycle): `utils/db.ts` opens
`retailPOS.db` at import; `utils/crypto.ts` and `utils/uuid.ts` install the
`crypto.getRandomValues` polyfill at import.

## Feature Flow

There is no user-facing flow. The dependency flow is:

```
Screen / Component / Hook / Context / Service / Repository
        │
        ├─ money.ts, currency.ts          (display + arithmetic)
        ├─ theme.ts, themes.ts, responsive.utils.ts  (visual + layout rules)
        ├─ platforms.ts, platformIds.ts, platformCapabilities.ts  (routing rules)
        ├─ electron.ts                    (desktop capability bridge)
        ├─ sellability, categorySelection, categoryFilter, hidBurst  (sale rules)
        ├─ orderRow.utils, orderStateMapper, orderHistory.utils      (order rules)
        ├─ roleAccess, actionRegistry, menuCapabilityAccess          (gating)
        ├─ crypto, userPin.utils, base64, uuid                       (credentials)
        ├─ printerSettings.utils, inventoryScanner.utils, csv        (misc rules)
        └─ db.ts → dbSchema.ts → sql.ts   (the SQLite backbone)
```

## Implementation Map

| Layer   | Responsibility                                                    | Relevant implementation                                                                              |
| ------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Libs    | Money & currency                                                  | `utils/money.ts`, `utils/currency.ts`                                                                |
| Libs    | Design tokens, presets, interaction states, breakpoints           | `utils/theme.ts`, `utils/themes.ts`, `utils/responsive.utils.ts`                                     |
| Libs    | Platform registry, ID mapping, capability matrix, Electron bridge | `utils/platforms.ts`, `utils/platformIds.ts`, `utils/platformCapabilities.ts`, `utils/electron.ts`   |
| Libs    | SQLite singleton, schema v1–v11, update allowlist                 | `utils/db.ts`, `utils/dbSchema.ts`, `utils/sql.ts`                                                   |
| Libs    | SHA-256/HMAC, PIN hashing, validation, UUID, base64               | `utils/crypto.ts`, `utils/userPin.utils.ts`, `utils/base64.ts`, `utils/uuid.ts`                      |
| Libs    | Role gating, action registry, capability gating                   | `utils/roleAccess.ts`, `utils/actionRegistry.ts`, `utils/menuCapabilityAccess.ts`                    |
| Libs    | Sale domain rules                                                 | `utils/sellability.ts`, `utils/categorySelection.ts`, `utils/categoryFilter.ts`, `utils/hidBurst.ts` |
| Libs    | Order domain mapping/rules                                        | `utils/orderRow.utils.ts`, `utils/orderStateMapper.ts`, `utils/orderHistory.utils.ts`                |
| Libs    | Validation & export helpers                                       | `utils/printerSettings.utils.ts`, `utils/inventoryScanner.utils.ts`, `utils/csv.ts`                  |
| Locales | Validation messages (partially unused — see C2 in rules.md)       | `locales/*/common.json`                                                                              |
| Docs    | Money ADR; feature rules for sale/platform/access-control         | `docs/adr/ADR-006-*.md`, `docs/features/sale/`, `platform.md`, `access-control.md`                   |

## State Ownership

By convention these modules are pure or hold only module-level/process-level
state:

| State                             | Owner                                     | Persistence                | Reset condition                 |
| --------------------------------- | ----------------------------------------- | -------------------------- | ------------------------------- |
| DB connection (`dbInstance`)      | `utils/db.ts`                             | SQLite file `retailPOS.db` | App termination                 |
| Schema version                    | `utils/dbSchema.ts`                       | `PRAGMA user_version`      | Never (migrations forward-only) |
| `crypto.getRandomValues` polyfill | `utils/crypto.ts`, `utils/uuid.ts`        | None                       | Process restart (idempotent)    |
| HID burst buffer                  | `HidBurstDetector` instance               | None                       | `reset()` / instance lifetime   |
| Theme preset choice               | `contexts/ThemeProvider.tsx` (not a util) | settings                   | User change                     |
| Everything else                   | Stateless pure functions                  | n/a                        | n/a                             |

## Dependencies

- `expo-sqlite` — `db.ts`/`dbSchema.ts`.
- `react-native-get-random-values`, `uuid` — `crypto.ts`, `uuid.ts`.
- `react-native` `Platform` — `electron.ts`, `theme.ts` (types only).
- `services/logger/LoggerFactory` — `dbSchema.ts` only (notable: `db.ts` uses
  `console.log` instead — see Contradiction C1).
- Domain types — `sellability.ts`, `categorySelection.ts`, `categoryFilter.ts`
  import `services/product/types`, `services/category/types`;
  `orderRow.utils.ts`/`orderStateMapper.ts`/`orderHistory.utils.ts` import
  repository/service types. These are _type-only_ dependencies; the logic stays
  pure.
- `repositories/UserRepository` — `roleAccess.ts`, `actionRegistry.ts` import
  `UserRole` (type dependency in the wrong direction; noted as Q1).

## Side Effects

- Importing `utils/db.ts` opens the SQLite database eagerly and (outside tests)
  runs `initializeSchema` — migrations execute on first DB use.
- Importing `utils/crypto.ts`/`uuid.ts` installs a global crypto polyfill.
- `initializeSchema` may `ALTER`/`CREATE` many tables inside one transaction;
  failure aborts the app bootstrap path that called it.

## Module Groups

Cross-cutting conventions live in `rules.md`; per-module behaviour is
split into one doc per module group:

| Module doc                             | Files                                                                        | Covers                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [money.md](money.md)                   | `money.ts`, `currency.ts`                                                    | Cent math, display formatting, currency table                     |
| [theme.md](theme.md)                   | `theme.ts`, `themes.ts`, `responsive.utils.ts`                               | Tokens, presets, `interactionStyle`, breakpoints, `getSaleLayout` |
| [platform.md](platform.md)             | `platforms.ts`, `platformIds.ts`, `platformCapabilities.ts`, `electron.ts`   | Platform enum, capability matrix, ID mapping, desktop bridge      |
| [persistence.md](persistence.md)       | `db.ts`, `dbSchema.ts`, `sql.ts`                                             | DB singleton, migrations v1–v11, SET-clause allowlist             |
| [credentials.md](credentials.md)       | `crypto.ts`, `userPin.utils.ts`, `base64.ts`, `uuid.ts`                      | Hashing, PIN format, randomness, encoding                         |
| [access-control.md](access-control.md) | `roleAccess.ts`, `actionRegistry.ts`, `menuCapabilityAccess.ts`              | Role gating, sensitive actions, capability gating                 |
| [sale-domain.md](sale-domain.md)       | `sellability.ts`, `categorySelection.ts`, `categoryFilter.ts`, `hidBurst.ts` | Pure sale-screen rules                                            |
| [order-domain.md](order-domain.md)     | `orderRow.utils.ts`, `orderStateMapper.ts`, `orderHistory.utils.ts`          | Order row mapping, sale-state machine, day navigation             |
| [misc.md](misc.md)                     | `printerSettings.utils.ts`, `inventoryScanner.utils.ts`, `csv.ts`            | Validation, scan matching, CSV escaping                           |
