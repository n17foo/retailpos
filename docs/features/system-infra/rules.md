# System Infrastructure — Rules

## I-R1 — Audit is append-only, KV-backed, and queryable

**Rule.** `auditLogService.log(action, {userId?, details?, metadata?})` appends
an `AuditEntry` to a persisted JSON store; queries: `getAll`, `getByAction`,
`getByUser`, `getByDateRange`, `exportCsv`; `clear()` wipes. ~45 typed
`AuditAction`s cover orders, refunds, auth, settings, shifts, drawer,
permissions, customers, procurement, sync, exchange.

**Evidence.** `services/audit/AuditLogService.ts`.

🟢 **E1.1** — drawer open → `drawer:opened` row with pin/method metadata.

🔴 **E1.2 — Persistence failure** — `persist()` failure path: entries buffer
in memory until loaded; a crash loses them (PG1).

🟠 **E1.3** — `clear()` exists — who may call it (admin-only enforcement at
call sites, not in the service — Q1).

## I-R2 — Failed platform requests are queued and retried with backoff

**Rule.** `addToQueue` persists a `QueuedRequest` (attempts:0). `processQueue`
runs on: NetInfo connectivity-restore, `AppState → active`, and a 30s poll.
Each retry: `attempts++`, delay `min(30s·2^(n−1), 5min)`. Success removes the
request; `maxAttempts` exhausts it.

**Evidence.** `hooks/useSyncStore.ts`, `services/queue/QueueManager.ts:19-43`.

🟢 **E2.1 — Offline POST** — call fails → queued → next connectivity triggers
the pass → request replays.

📱 **E2.2 — Restart** — the store persists via the SQLite adapter — queue
survives termination; `isProcessing` is _not_ persisted (starts false).

🟠 **E2.3 — Double-processing** — poll + connectivity trigger can overlap;
processQueue is re-entrant-guarded by `isProcessing` (verify — PG2).

## I-R3 — Secrets resolve to the safest available backend

**Rule.** `SecretsServiceFactory` picks by runtime: native → `Keychain`;
Electron → `safeStorage`; browser → `BrowserSecretsService`; Expo Go →
`Memory` (non-persistent).

**Evidence.** `services/secrets/*`.

🟢 **E3.1** — platform API key saved on iOS lands in the keychain; same call
in Expo Go lands in memory (lost on restart — expected for dev).

🔴 **E3.2 — Memory backend in production** — secrets vanish on restart;
mis-detection would silently degrade to memory (PG3).

## I-R4 — Notifications are fire-and-forget toasts

**Rule.** `notificationService.notify(title, body, severity)` emits to
listeners; no persistence, no dedup — callers decide frequency.

**Evidence.** `services/notifications/NotificationService.ts`.

🟠 **E4.1** — background sync notifies every failing pass (see orders-sync
PG4) — the service itself doesn't throttle.

## I-R5 — Search is a per-platform adapter the sale layer calls

**Rule.** `SearchServiceFactory.getService(platform).search(query)` — the
omnibar's resolution path; adapter availability mirrors the `catalog`
capability.

**Evidence.** `services/search/*`, `sale/catalogue.md` (consumer rules).

🟠 **E5.1** — OFFLINE → local search over the seeded catalogue (which has
the onboarding-seeding gap noted in the onboarding doc).

## I-R6 — Logging goes through LoggerFactory, never console

**Rule.** `LoggerFactory.getInstance().createLogger(tag)` + pluggable
`LogTransport`s — the AGENT.md non-negotiable; `utils/db.ts` is the known
exception (C1 in shared-libs).

## I-R7 — The More menu is composed, not hardcoded

**Rule.** `MoreMenuComposer` (pure, no side effects) produces the ordered
More-menu list with per-item `MenuItemStatus` (enabled/disabled/hidden) from
four inputs: user role (`canAccessMoreMenuItem`), platform capability,
custom-adapter readiness, and permission-set access
(`evaluateCombinedAccess`). `MoreNavigator` renders it; `screens/sale/
MainMenu.tsx` and `SetupProgressService` also consume the same composition —
menu truth is single-sourced.

**Evidence.** `services/navigation/MoreMenuComposer.ts`,
`navigation/MoreNavigator.tsx`, `utils/{roleAccess,menuCapabilityAccess,
platformCapabilities}.ts`, `services/permissions/PermissionService.ts`.

🟢 **E7.1** — cashier on WooCommerce → capability-gated items (e.g. features
the platform doesn't support) render disabled with `getUnavailableReason`,
role-gated items hidden.

🟠 **E7.2 — Stale comments** — the file header still references
`docs/specs/onboarding-menu-capability-implementation.md` and
`docs/specs/auth/permissions.md`; both specs are retired — behaviour lives
here and in `docs/features/authentication`.

## I-R8 — Dead/orphaned code inventory (mounted but unconsumed)

**Rule.** These surfaces exist but have no live consumers — treat as dead
code pending removal, not behaviour to rely on:

- `contexts/DataProvider.tsx` — mounted in `App.tsx:184`, but **zero** files
  call `useData()`. Its `useOrders`/`useOfflineProducts`/`useOfflineCategories`
  hooks still fire their effects at mount (possible wasted loads).
- `hooks/useKeyboardShortcuts.ts` — zero consumers; the desktop-shortcut
  intent lives in `screens/sale/*` key handlers instead (sale R8).
- `screens/search/*` (`SearchHeader`, `SearchHistory`, `FilterPanel`,
  `ProductResultItem`) — orphaned by the unified sale surface; only
  `hooks/useSearch.ts` still names them.
- `services/jobs/LoyaltyExpiryJob` — was never `start()`ed; **fixed** —
  started/stopped in `App.tsx` (see customers rules).

**Evidence.** grep over `screens/`, `components/`, `contexts/`, `App.tsx`,
`navigation/` — no importers.

## ❓ Open Questions

- **Q1** — Who may call `auditLogService.clear()` — is there a UI/role gate?
- **Q2** — Does the queue capture _which_ endpoint/op each request was
  (replay semantics), or just payloads?
- **Q3** — Audit growth: is there rotation/retention, or unbounded until
  clear?
- **Q4** — Notification delivery: are toasts the only channel, or do
  severities route differently?

## ⚠️ Potential Gaps

- **PG1** — Audit persistence lag: `ensureLoaded`/`persist` async — a crash
  between log() and persist loses entries.
- **PG2** — Queue re-entrancy on overlapping triggers.
- **PG3** — Backend mis-detection → memory secrets (silent persistence loss).
- **PG4** — At-least-once queue delivery — a platform request that succeeded
  but whose response was lost will replay (idempotency is the request's
  problem, not the queue's).
- **PG5** — Unbounded audit log growth (no rotation observed).

## Test Coverage Mapping

| Example      | Coverage                                         |
| ------------ | ------------------------------------------------ |
| I-R1 audit   | `services/audit/AuditLogService.test.ts`         |
| I-R2 queue   | Not found                                        |
| I-R3 secrets | mock backend used in tests; per-backend untested |

## Feature Context Summary

**Feature**: System infrastructure
**Responsibility**: Audit trail, toasts, persisted API-retry queue, secret
backends, logging, platform search adapters, More-menu composition.

**Core rules**

- I-R1 Append-only audit, ~45 actions, queryable + CSV.
- I-R2 Queued requests retry on connectivity/app-active/30s with 30s·2ⁿ
  ≤5min backoff; persisted across restarts.
- I-R3 Secret backend resolved by platform.
- I-R4 Toasts are fire-and-forget.
- I-R5 Search adapters per platform feed the omnibar.
- I-R6 LoggerFactory only.
- I-R7 More menu composed from role + capability + permission + adapter
  readiness.
- I-R8 Dead surfaces inventoried (DataProvider, useKeyboardShortcuts,
  screens/search/*).

**Critical unhappy paths**: audit persist lag (PG1); queue replay without
idempotency (PG4); memory-backend secret loss (PG3).

**Offline**: queue+audit persist locally and process on reconnect — this is
the backbone of "retry later" behaviour outside order sync.
