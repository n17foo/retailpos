# Shared Libraries — Rules

The rules below are **cross-cutting conventions** every shared lib obeys (or is
supposed to). Per-module behaviour lives in the module docs:

| Module doc                             | Files                                                                        |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| [money.md](money.md)                   | `money.ts`, `currency.ts`                                                    |
| [theme.md](theme.md)                   | `theme.ts`, `themes.ts`, `responsive.utils.ts`                               |
| [platform.md](platform.md)             | `platforms.ts`, `platformIds.ts`, `platformCapabilities.ts`, `electron.ts`   |
| [persistence.md](persistence.md)       | `db.ts`, `dbSchema.ts`, `sql.ts`                                             |
| [credentials.md](credentials.md)       | `crypto.ts`, `userPin.utils.ts`, `base64.ts`, `uuid.ts`                      |
| [access-control.md](access-control.md) | `roleAccess.ts`, `actionRegistry.ts`, `menuCapabilityAccess.ts`              |
| [sale-domain.md](sale-domain.md)       | `sellability.ts`, `categorySelection.ts`, `categoryFilter.ts`, `hidBurst.ts` |
| [order-domain.md](order-domain.md)     | `orderRow.utils.ts`, `orderStateMapper.ts`, `orderHistory.utils.ts`          |
| [misc.md](misc.md)                     | `printerSettings.utils.ts`, `inventoryScanner.utils.ts`, `csv.ts`            |

Per-module rule IDs are prefixed (`M-`, `T-`, `P-`, `DB-`, `C-`, `A-`, `S-`,
`O-`, `X-`) and referenced below where relevant.

---

## R1 — Shared logic is pure and node-testable

**Rule**
A `shared/utils/` or feature `utils/` module that encodes a behavioural rule is a pure function/class with
no React or RN dependency, so it can be unit-tested under node. Any injectable
nondeterminism (clock, randomness) is a parameter, not a global read.

**Evidence**

- `features/scanning/utils/hidBurst.ts` — `now: () => number` injected into `HidBurstDetector`.
- `shared/utils/responsive.utils.ts`, `features/catalogue/utils/categorySelection.ts`,
  `features/catalogue/utils/sellability.ts`, `features/orders-sync/utils/orderHistory.utils.ts` — header comments state
  "No React, no RN … fully testable in node".
- 14 `*.test.ts` files in `utils/` run under Jest/node.

🟢 **E1.1 — Layout decision tested without a window**
Given `getSaleLayout(390, 844)` (portrait phone)
When the function runs under plain node
Then it returns `layoutClass: 'phone'`, `shell: 'stacked'` with no RN imports.
Covered by `shared/utils/responsive.utils.test.ts`.

🟠 **E1.2 — Hidden platform dependency**
Given `shared/utils/theme.ts` (`interactionStyle` returns `ViewStyle`, type-only RN
use) and `shared/utils/electron.ts` (reads `Platform.OS`)
When a test imports them under node
Then `electron.ts` still needs RN's `Platform` — it is _not_ pure; only
type-imported RN symbols are acceptable under R1.
Status: observed variance, not a defect — `electron.ts` is a platform bridge,
not a rule module.

## R2 — All monetary arithmetic goes through `shared/utils/money.ts`

**Rule**
No raw float arithmetic on money anywhere in the app (ADR-006; AGENT.md rule
6/12). Prices are handled in integer cents; formatting always shows 2 decimals.

**Evidence**

- `docs/adr/ADR-006-money-integer-cent-math.md`.
- `shared/utils/money.ts` — `toCents/toDollars/roundMoney/multiplyMoney/addMoney/subtractMoney/sumMoney/formatMoney`.
- `shared/utils/money.test.ts` — cent rounding incl. IEEE-754 notes (`1.005 → 100`).

🟢 **E2.1** — `addMoney(19.99, 0.01)` → `20` (not `20.000000000000004`).
🟢 **E2.2** — `formatMoney(1200.4, 'JPY')` → `¥1200`: ISO 4217 minor units are
honoured (`CurrencyInfo.decimals`). See [money.md](money.md) M-R2.

## R3 — No hardcoded colours/spacing/typography outside `shared/utils/theme.ts`

**Rule**
All visual constants come from `shared/utils/theme.ts` tokens (AGENT.md rule 4/12).

**Evidence** — `shared/utils/theme.ts` — `lightColors`, `spacing`, `typography`,
`hitTarget`, `interactionStyle`, `elevation`.

⚠️ **Contradiction C3** — `features/checkout/utils/orderStateMapper.ts` embeds hardcoded hex
colours (`#2196f3`, `#ff9800`, …) in `getSaleStateInfo` — a lib inside a feature `utils/`
that itself violates R3. See [order-domain.md](order-domain.md) O-R2.

🟠 **E3.1 — Theme presets do not reach `lightColors` importers**
`shared/utils/themes.ts` states components "call `useTheme().colors` instead of
importing `lightColors`", but ~92 `.tsx` files import `lightColors` directly
and only `ThemeProvider`/`ThemeSettingsTab` consume `shared/utils/themes.ts`.
Observed: non-default presets recolour only `useTheme` consumers; the rest of
the UI stays on the default palette. See [theme.md](theme.md) T-R3 / C4.

## R4 — Undefined role defaults to least privilege

**Rule**
Everywhere a role may be `undefined`, access resolves as `cashier`.

**Evidence** — `shared/utils/roleAccess.ts` (`effectiveRole = role ?? 'cashier'`),
`shared/utils/actionRegistry.ts` (`ROLE_RANK`), AGENT.md rule 11/12.

🟢 **E4.1** — `canAccessTab(undefined, 'Inventory')` → `false` (cashier lacks
Inventory tab).
🔴 **E4.2** — The same least-privilege default exists for platform capabilities:
`getPlatformCapabilities(null)` → OFFLINE profile; `getPlatformDisplayName(null)`
→ 'Offline Mode'. Misconfiguration degrades silently rather than failing —
see [platform.md](platform.md) P-R2 / PG10.

## R5 — Offline-first: the app works with `ECommercePlatform.OFFLINE`

**Rule**
`DEFAULT_PLATFORM = OFFLINE`; every feature reachable without credentials must
fall back to local behaviour. `db.ts` is the backbone all repositories share.

**Evidence** — `shared/utils/platforms.ts:17`, `shared/utils/db.ts`.

📴 **E5.1 — App restart, offline**
Given the app was terminated mid-sale
When it restarts
Then `db.ts` reopens `retailPOS.db`, `initializeSchema` runs pending migrations
(v1→v11 in one transaction), and repositories recover persisted basket/order
rows. No remote call is required.

🔴 **E5.2 — DB open failure at startup**
the open promise is cached but cleared on failure, so the next access retries
subsequent `db.*` call through the Proxy returns the same rejected promise —
the app effectively dead-ends until restart. See
[persistence.md](persistence.md) DB-R1 / PG2.

## R6 — Security helpers fail closed

**Rule**
Credential verification and SQL/CSV builders reject on ambiguity rather than
fall through.

**Evidence**

- `shared/utils/crypto.ts` `verifyPin` — empty/malformed stored value → `false`;
  a `v1$` prefix that fails the hash regex → `false`.
- `shared/utils/sql.ts` `buildUpdateAssignments` — non-allowlisted column → **throws**
  (`Column 'x' cannot be updated`), never silently dropped.
- `shared/utils/csv.ts` — formula-trigger cells are `'` prefixed.

🟢 **E6.1** — `verifyPin('123456', '')` → `false`; a legacy plaintext row
`'123456'` still verifies (documented transparent-rehash path — C-R1 / PG7).
🔴 **E6.2** — `buildUpdateAssignments({pin:'x'}, allowed)` without `pin` in the
allowlist throws — callers must catch or it propagates as a 500/user-facing
error.

## R7 — Injection defenses are applied at output boundaries

**Rule**
Untrusted strings (names, platform values) are sanitised where they leave the
app: SQL column names allowlisted (`sql.ts`), CSV formula triggers escaped
(`csv.ts`), platform ID prefixes stripped at the platform boundary
(`platformIds.ts`).

**Evidence** — `shared/utils/sql.ts:9` comment, `shared/utils/csv.ts:4` comment,
`shared/utils/platformIds.ts` header.

---

## ❓ Open Questions

- **Q1** — Should utils→repository type imports (`UserRole`) be inverted so
  `UserRole` lives in a types module? Currently `roleAccess.ts` and
  `actionRegistry.ts` depend on a repository file. (Also A-Q2.)
- **Q2** — Is `shared/utils/db.ts` skipping `initializeSchema` under `NODE_ENV=test`
  intentional isolation, or does it hide schema drift in tests? The `dbProxy`
  in tests is usually mocked, so real-schema coverage is absent.
- **Q3** — `getAppVersion()` returns hardcoded `'1.0.0'` outside Electron —
  stale by design or a TODO?
- Module-level questions live in each module doc (M-Q*, T-Q1, P-Q*, DB-Q*,
  C-Q*, A-Q*, S-Q*, O-Q*, X-Q*).

## ⚠️ Potential Coverage Gaps

- **PG1** — `orderStateMapper.ts` declares `preparing-checkout` and `paid` in
  `UserFacingSaleState`, but `getUserFacingSaleState` can never produce them —
  dead states; consumers rendering on them are unreachable. (O-R2)
- ~~**PG2**~~ **RESOLVED** — DB open failures now clear the cached promise so
  the next access retries (DB-R1). `console.*` also replaced with
  LoggerFactory (was C1).
- **PG3** — Theme presets only reach `useTheme().colors` consumers (~9 files);
  the other ~92 `.tsx` files keep `lightColors`. (T-R3)
- **PG4** — `isElectron()`'s user-agent fallback can false-positive on any web
  view whose UA contains "electron". (P-R4)
- **PG5** — `HidBurstDetector`'s first keystroke of each burst is _not_
  swallowed (indistinguishable from typing). Correctness depends on callers
  rejecting the buffered char via `isBursting()` — if a caller forgets, one
  scan char leaks into the focused input. (S-R4)
- **PG6** — `timingSafeEqual` is approximate constant-time on a JS VM
  (acknowledged in code comment). (C-R1)
- **PG7** — `verifyPin` still accepts legacy plaintext PINs — required for the
  rehash path, but it means plaintext rows remain valid credentials. (C-R1)
- **PG8** — `orderHistory.utils` day boundaries use device-local midnight;
  timezone changes or midnight-DST boundaries can shift "today". (O-R3)
- ~~**PG9**~~ **RESOLVED** — `CurrencyInfo.decimals` (ISO 4217) added;
  `formatMoney` honours it (M-R2).
- **PG10** — Unknown platform strings silently resolve to the OFFLINE
  capability profile — misconfiguration is invisible. (P-R2)
- **PG11** — `multiplyMoney` accepts fractional quantities without complaint.
  (M-R1)
- **PG12** — Printer-settings validation fails open on unknown connection
  types and accepts out-of-range IP octets. (X-R1)

## ⚠️ Contradictions

- ~~**C1**~~ **RESOLVED** — `shared/utils/db.ts` now uses LoggerFactory.
- ~~**C2**~~ **RESOLVED** — `validatePrinterSettings` returns the
  `settings.printer.validation.*` keys; the hook translates them.
- **C3** — `orderStateMapper.ts` hardcodes colours (see R3 / O-R2).
- **C4** — `themes.ts` header vs reality: most components bypass
  `useTheme().colors` (see T-R3 / PG3).

## Test Coverage Mapping

| Area                                                                                                                                                                                                                                               | Coverage                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `money.ts`                                                                                                                                                                                                                                         | `shared/utils/money.test.ts`                              |
| `hidBurst.ts`                                                                                                                                                                                                                                      | `features/scanning/utils/hidBurst.test.ts`                |
| `sellability.ts`                                                                                                                                                                                                                                   | `features/catalogue/utils/sellability.test.ts`            |
| `categorySelection.ts`                                                                                                                                                                                                                             | `features/catalogue/utils/categorySelection.test.ts`      |
| `categoryFilter.ts`                                                                                                                                                                                                                                | `features/catalogue/utils/categoryFilter.test.ts`         |
| `responsive.utils.ts`                                                                                                                                                                                                                              | `shared/utils/responsive.utils.test.ts`                   |
| `orderRow.utils.ts`                                                                                                                                                                                                                                | `features/orders-sync/utils/orderRow.utils.test.ts`       |
| `orderHistory.utils.ts`                                                                                                                                                                                                                            | `features/orders-sync/utils/orderHistory.utils.test.ts`   |
| `csv.ts`                                                                                                                                                                                                                                           | `shared/utils/csv.test.ts`                                |
| `crypto.ts`                                                                                                                                                                                                                                        | `shared/utils/crypto.test.ts`                             |
| `platformIds.ts`                                                                                                                                                                                                                                   | `shared/utils/platformIds.test.ts`                        |
| `userPin.utils.ts`                                                                                                                                                                                                                                 | `features/authentication/utils/userPin.utils.test.ts`     |
| `printerSettings.utils.ts`                                                                                                                                                                                                                         | `features/hardware/utils/printerSettings.utils.test.ts`   |
| `inventoryScanner.utils.ts`                                                                                                                                                                                                                        | `features/inventory/utils/inventoryScanner.utils.test.ts` |
| `theme.ts`, `themes.ts`, `platforms.ts`, `platformCapabilities.ts`, `db.ts`, `dbSchema.ts`, `sql.ts`, `electron.ts`, `currency.ts`, `base64.ts`, `uuid.ts`, `roleAccess.ts`, `actionRegistry.ts`, `menuCapabilityAccess.ts`, `orderStateMapper.ts` | Not found                                                 |

---

## Feature Context Summary

**Feature** — Shared Libraries (`shared/utils/` + feature `utils/`)

**Responsibility** — Single source of truth for cross-cutting rules: money
math, theme/layout tokens, platform capabilities, persistence schema,
credentials, role/capability gating, and pure sale/order domain rules.

**Entry Points** — Import-time (no UI): ~97 consumers each for `theme.ts` and
`platforms.ts`; `db.ts` underpins all repositories.

**Core Rules**

- R1 — Rule modules are pure and node-testable.
- R2 — All money arithmetic via `shared/utils/money.ts` (integer cents; ADR-006).
- R3 — All visual constants via `shared/utils/theme.ts` tokens.
- R4 — Undefined role ⇒ `cashier` (least privilege); unknown platform ⇒ OFFLINE.
- R5 — Offline-first: `DEFAULT_PLATFORM = OFFLINE`; SQLite is the backbone.
- R6 — Security helpers fail closed (verify-false / throw on unknown column).
- R7 — Injection defences at output boundaries (SQL, CSV, platform IDs).
- Per-module rules live in the module docs: `M-R*`, `T-R*`, `P-R*`, `DB-R*`,
  `C-R*`, `A-R*`, `S-R*`, `O-R*`, `X-R*`.

**Primary Happy Path** — Feature code calls a pure util; behaviour is
deterministic, unit-tested under node, and identical on iOS/Android/web/Electron.

**Critical Unhappy Paths** — `verifyPin` fails closed; `buildUpdateAssignments`
throws on smuggled columns; a failed DB open now retries on next access.

**Important Edge Cases** — First HID keystroke never swallowed (PG5); legacy
plaintext PINs still verify (PG7); preset themes
only reach `useTheme` consumers (PG3).

**Offline Behaviour** — `db.ts`/`dbSchema.ts` implement the whole offline
backbone: lazy-open DB, transactional migrations v1→v11, `PRAGMA user_version`.
`DEFAULT_PLATFORM = OFFLINE` keeps the app functional with no credentials.

**Lifecycle Behaviour** — Import side effects: crypto polyfill installs
(DB now opens lazily on first query); schema migrates once on first use; all other state is
per-instance (e.g. `HidBurstDetector` buffer) or absent.

**State Ownership** — Stateless by convention; exceptions: `dbInstance` (process),
`PRAGMA user_version` (persistent), detector buffers (instance).

**Dependencies** — `expo-sqlite`, `react-native-get-random-values`, `uuid`,
`LoggerFactory` (dbSchema only), domain types (type-only).

**Side Effects** — DB open + migrations on first query; global crypto polyfill.

**Open Questions** — Q1 utils→repository `UserRole` import direction; Q2 schema
skip under test env; Q3 hardcoded `'1.0.0'` app version off-Electron; plus
module-level questions in each module doc.

**Potential Gaps** — PG1 dead sale states; PG3 partial theme coverage;
PG4 Electron UA false-positive; PG5 first-scan-char leak; PG6 approximate
constant-time; PG7 plaintext PIN path; PG8 local-midnight day boundaries;
PG10 silent OFFLINE platform fallback; PG11 fractional quantity; PG12
printer-validation fail-open. (PG2 DB failure, PG9 decimal display, and
C2 dead printer locale keys are resolved.)

**Contradictions** — C3 hardcoded colours in `orderStateMapper.ts`; C4 theme
presets vs `lightColors` reality. (C1 `console.log` in `db.ts` and C2 dead
printer locale keys are resolved.)
