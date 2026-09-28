# Security Hardening — Round 3 Status

> **Status**: Implemented and verified — not committed
> **Scope**: Production-readiness review of areas not covered by rounds 1–2 (authorization, session handling, financial integrity, exports, SQL construction, LAN protocol, logging, Electron packaging, native keychain configuration)

---

## Decisions

These were agreed with the product owner before implementation:

| Topic                   | Decision                                                                                                                                                                                                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LAN authentication      | **Signed requests only.** The server rejects the legacy `x-shared-secret` header, so every register must be upgraded at the same time. `PaymentIntentClient` still sends the legacy header to the external store-api/integration-hub, because that server can't be changed from here. |
| Manager settings access | **Admin-only** for the Auth, Payment, E-commerce and Multi-register tabs, and for user and permission-set management. Managers keep General, POS, Hardware, Hardware Status, Receipt, Theme and Offline product/category management.                                                  |
| Inactivity auto-lock    | **5 minutes** by default, stored as `pos.autoLockMinutes`. `0` disables it.                                                                                                                                                                                                           |

---

## Completed

### 1. CSV formula injection

- Added `utils/csv.ts`. It prefixes cells that start with `= + - @ \t \r` with `'`, leaves plain numbers such as `-5.00` alone, and quotes cells per RFC 4180.
- Applied to `AuditLogService.exportCsv`, `ReportingService.exportOrdersCsv` and `BarcodeLabelService.exportToCsv`.
- Tests: `utils/csv.test.ts`.

### 2. SQL column allowlists and user integrity

- Added `utils/sql.ts` → `buildUpdateAssignments(data, allowedColumns)`. It throws on any column that isn't allowlisted, which stops SQL fragments or protected columns (e.g. `pin`) being passed in through runtime object keys.
- Applied to `UserRepository`, `ProductRepository`, `CategoryRepository` and `DiscountRepository`.
- `UserRepository`:
  - Validates roles on create and update.
  - Refuses to demote, deactivate or delete the **last active admin**.
- Tests: `repositories/UserRepository.test.ts`.

### 3. Authorization

- `PermissionService`:
  - Deactivated users, including admins, are denied everything.
  - An explicit deny in any permission set wins over a grant in another.
  - The admin-only ceiling is kept.
  - Cache entries now expire after 60 s.
- `SettingsTabComposer`:
  - Now receives the user role; previously `SettingsScreen` never passed one.
  - Credential-bearing tabs require `settings:edit` (admin).
- `SettingsScreen`:
  - Treats an undefined role as cashier.
  - Renders only tabs the composer returned as enabled.
- Added `components/PermissionGate.tsx`, a screen-level guard. It is applied in `MoreNavigator` to:
  - Settings, Users and PermissionSets
  - Reports and SyncQueue
  - Customers and CustomerProfile
  - All procurement and inventory-configuration screens
- `OfflineManagementTab` hides and gates the Users section behind `user:edit`.
- `useUsers` checks `user:create` / `user:edit` / `user:delete` at the data boundary.
  - The only unauthenticated path is onboarding creating the **first admin**, and only while no active admin exists.
  - The permission cache is invalidated after each user change.
- `PermissionSetsScreen` checks the permission again before saving or deleting.
- Added the `common.accessDenied` string in en/es/fr/de.
- Tests: `services/permissions/PermissionService.test.ts`, `services/navigation/SettingsTabComposer.test.ts`.

### 4. Inactivity auto-lock

- `POSConfigService`:
  - New optional `autoLockMinutes` setting.
  - New `DEFAULT_AUTO_LOCK_MINUTES = 5`.
  - New `AUTO_LOCK_TIMEOUT_MS()`, which ignores invalid or negative values.
- `hooks/useInactivityLock.ts`:
  - Counts touches (captured in `RootNavigator`) and web/Electron `keydown` as activity.
  - Checks every 10 s and again when the app returns to the foreground.
- On lock, the session logs out and writes an `auth:logout` audit entry with the reason.
- Tests: `services/config/POSConfigService.test.ts`.

### 5. Return and refund integrity

- `services/refunds/returnValidation.ts` → `validateReturnRequest` requires:
  - The order is paid or synced.
  - Each return quantity is a positive whole number, and each refund is a finite amount ≥ 0.
  - Each item belongs to the order.
  - Quantities per line, including earlier returns and split lines, don't exceed the quantity sold.
  - The cumulative refund doesn't exceed the order total (integer-cent comparison).
- `ReturnService.processReturn` runs the validation before writing anything and sums with `addMoney`.
- The LAN `POST /api/returns` route runs the same validation — a LAN client can no longer bypass it.
- Tests: `services/refunds/returnValidation.test.ts`, plus new cases in `ReturnService.test.ts`.

### 6. LAN: HMAC-signed requests (implemented)

- `services/instoreapi/requestSigning.ts` — shared sign/verify helpers. Signature covers `METHOD \n PATH?QUERY \n TIMESTAMP \n NONCE \n sha256hex(rawBody)`.
- Client sends `x-instore-register` / `x-instore-timestamp` / `x-instore-nonce` / `x-instore-signature`; the secret is never transmitted and `x-shared-secret` is no longer sent or accepted.
- `InstoreApiServer` verifies the signature (constant-time), enforces a ±5-minute timestamp window, and rejects replayed nonces via a bounded in-memory `(register, nonce)` cache.
- `InstoreApiTransport` now passes the full path **with query string** and the raw body so the signature covers the exact wire bytes.
- Discovery no longer sends the secret during subnet scans; `probeHealth`/`probeAddress` are unauthenticated.
- `testConnection()` uses the new authenticated `GET /api/session` route — it now detects a wrong secret (previously it hit unauthenticated `/api/health` and always succeeded).
- Route-order bug fixed: `/api/orders/unsynced` is registered before `/api/orders/:id`.
- Write-route input validation: order shape/amounts/items, order-status allowlist, payment field bounds, product/category allowlists and size limits, return validation.
- `StoreApiWebSocket`: non-text, oversized (>1 MiB), malformed, and non-object frames are dropped; `dedupe_key` is bounded. The HELLO handshake is documented as unauthenticated — it belongs to the external store-api protocol.
- Tests: `services/instoreapi/requestSigning.test.ts`; `tests/integration/InstoreApiTransport.integration.test.ts` rewritten for signed requests (legacy-header rejection, wrong-secret rejection, replay rejection, tampered body, unsynced route).
- **Rollout:** all registers must run a signing build — mixed versions cannot authenticate.

### 7. Logger metadata redaction

- `services/logger/redaction.ts` — recursively redacts metadata keys matching a sensitive-word list (`secret`, `token`, `password`, `pin`, `apikey`, `authorization`, `credential`, `signature`, `session`, `cookie`, `key`, `auth`), with camelCase/separator splitting so `shippingAddress` isn't over-redacted.
- Applied in `ReactNativeLogger.forward` before entries reach external transports.
- Tests: `services/logger/redaction.test.ts`.

### 8. Electron packaging

- `isDev` now requires both `!app.isPackaged` and `NODE_ENV === 'development'` — a packaged build can no longer be tricked into trusting the dev-server origin by an env var.
- Network printer ports restricted to raw-print range `9100–9109`.
- `electronFuses` in `package.json`: `runAsNode`, `enableNodeOptionsEnvironmentVariable`, and `enableNodeCliInspectArguments` disabled; `enableCookieEncryption` enabled.
- Deferred pending a packaged-build smoke test: `enableEmbeddedAsarIntegrityValidation`, `onlyLoadAppFromAsar`.

### 9. iOS/Android keychain configuration

- Removed the mismatched `accessGroup` (`com.commercefull.retailpos` didn't match the bundle id and had no entitlement — it would have caused `errSecMissingEntitlement` and, with the fail-closed policy, total credential-storage failure on production iOS).
- Secrets now use `AccessibleAfterFirstUnlockThisDeviceOnly` — never migrate via backups or to other devices.
- **Still needs:** smoke test on a real iOS device build.

### 10. Auto-lock follow-ups

- `POSConfigSettingsTab` (Advanced section): admin-editable "Auto-lock after inactivity (minutes)" — whole minutes 0–480, 0 disables.
- `hooks/useInactivityLock.test.ts` — fake-timer tests (lock on timeout, activity reset, unauthenticated/disabled/unmount cases). Added `react-test-renderer` devDependency and fixed the `AppState.addEventListener` mock to return a subscription.

### 11. Documentation

- `multi-register.md`: signed-request auth, `/api/session`, unauthenticated probes, updated gap 4.8 and traceability.
- `permissions.md`: round-3 section — deactivated-user denial, deny-wins, cache expiry, `PermissionGate`, admin-only credential tabs, first-admin bootstrap, last-admin guard.
- `logout.md`: auto-lock requirement + traceability.
- `refunds.md`: `validateReturnRequest` rules + traceability.
- `secrets.md`: backend table (Electron `safeStorage`, browser fallback flag), keychain accessibility/no access group.

---

## Remaining work

### Verification — done

- `yarn lint`: passed
- `yarn test --runInBand`: 45 suites, 380 tests passed
- `yarn test:integration --runInBand`: 20 tests passed
- `git diff --check`: passed
- `node --check electron/main.js && node --check electron/preload.js`: passed
- No commit or push performed.

### Manual smoke tests (cannot run here)

- Real iOS device build — verify keychain read/write after the access-group removal.
- Packaged Electron build — verify `electronFuses` apply and the app loads `dist/index.html` in production mode.
- Two physical registers on a LAN — signed-request handshake, discovery, sync.
- `expo prebuild` / native build smoke test (lockfile was touched in round 1).

## Accepted / residual risks (not planned for this round)

- **PIN uniqueness oracle:** creating or updating a user reveals whether a PIN is already taken. This is inherent to PIN-only identification and limited to admins.
- **Global LAN PIN rate limit:** `/api/users/verify-pin` locks for every register after 10 failures a minute. That allows a denial of service by any secret holder, but a per-register limit would rely on the spoofable `X-Register-Id` until signed register identity exists (item 6).
- **Audit log** is a mutable KV JSON array capped at 2000 entries (ADR-012). It isn't tamper-evident. `clear()` exists but has no UI caller.
- **Manager-approval lockout** is keyed by the requesting cashier. Online PIN brute-force protection still comes from `AuthAttemptLimiter`.
- **Plaintext LAN transport and the shared-secret trust model** remain. Signing (item 6) protects the secret but not confidentiality; the VLAN/WireGuard/Tailscale requirement still applies.
- **Dependencies:** 9 advisories remain, all build-time except `decode-uri-component` (DoS only, via `@react-navigation` → `query-string`; the fix is ESM-only).
- Carried over from round 2: salted SHA-256 credential hashes (no KDF), the Electron privileged peripheral/payment IPC surface, platform login disabled, webhook listener idempotency.
