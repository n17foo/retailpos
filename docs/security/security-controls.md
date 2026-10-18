# Security Controls Inventory

> Consolidated record of implemented code-level security controls (hardening
> rounds 1–3), reorganised as a permanent reference. For deployment/ops see
> `network-segmentation.md` and `instore-server-hardening.md`; for
> feature-level behaviour see `docs/features/*/rules.md`.

## Product decisions

| Topic                   | Decision                                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LAN authentication      | **Signed requests only.** The server rejects the legacy `x-shared-secret` header, so every register must run a signing-capable build. `PaymentIntentClient` still sends the legacy header to the external store-api/integration-hub, which can't be changed from the POS side. |
| Manager settings access | **Admin-only** for the Auth, Payment, E-commerce and Multi-register tabs, and for user and permission-set management. Managers keep General, POS, Hardware, Hardware Status, Receipt, Theme and Offline product/category management.                                           |
| Inactivity auto-lock    | **5 minutes** by default (`pos.autoLockMinutes`). `0` disables it.                                                                                                                                                                                                             |

---

## 1. Output encoding — CSV formula injection

- `shared/utils/csv.ts` prefixes cells starting with `= + - @ \t \r` with `'`, leaves
  plain numbers such as `-5.00` alone, and quotes cells per RFC 4180.
- Applied to `AuditLogService.exportCsv`, `ReportingService.exportOrdersCsv`
  and `BarcodeLabelService.exportToCsv`.
- Tests: `shared/utils/csv.test.ts`.

## 2. SQL construction and user integrity

- `shared/utils/sql.ts` → `buildUpdateAssignments(data, allowedColumns)` throws on
  any non-allowlisted column — stops SQL fragments or protected columns
  (e.g. `pin`) arriving via runtime object keys.
- Applied to `UserRepository`, `ProductRepository`, `CategoryRepository` and
  `DiscountRepository`.
- `UserRepository` validates roles on create/update and refuses to demote,
  deactivate or delete the **last active admin**.
- Tests: `features/authentication/repositories/UserRepository.test.ts`.

## 3. Authorization

- `PermissionService`:
  - Deactivated users, including admins, are denied everything.
  - An explicit deny in any permission set wins over a grant in another.
  - The admin-only ceiling is kept.
  - Permission cache entries expire after 60 s.
- `SettingsTabComposer` receives the user role; credential-bearing tabs
  require `settings:edit` (admin).
- `SettingsScreen` treats an undefined role as cashier and renders only
  enabled tabs.
- `features/authentication/components/PermissionGate.tsx` — screen-level guard applied in
  `MoreNavigator` to Settings, Users, PermissionSets, Reports, SyncQueue,
  Customers, CustomerProfile, and all procurement/inventory-configuration
  screens.
- `OfflineManagementTab` hides/gates the Users section behind `user:edit`.
- `useUsers` checks `user:create` / `user:edit` / `user:delete` at the data
  boundary. The only unauthenticated path is onboarding creating the
  **first admin**, and only while no active admin exists. The permission
  cache is invalidated after each user change.
- `PermissionSetsScreen` re-checks the permission before saving/deleting.
- `common.accessDenied` string in en/es/fr/de.
- Tests: `features/authentication/services/permissions/PermissionService.test.ts`,
  `features/settings/services/SettingsTabComposer.test.ts`.

## 4. Inactivity auto-lock

- `POSConfigService`: `autoLockMinutes` setting,
  `DEFAULT_AUTO_LOCK_MINUTES = 5`, `AUTO_LOCK_TIMEOUT_MS()` ignores
  invalid/negative values.
- `features/authentication/hooks/useInactivityLock.ts`: counts touches (captured in `RootNavigator`)
  and web/Electron `keydown` as activity; checks every 10 s and on
  foreground. On lock, the session logs out and writes an `auth:logout`
  audit entry with the reason.
- `POSConfigSettingsTab` (Advanced): admin-editable "Auto-lock after
  inactivity (minutes)" — whole minutes 0–480, 0 disables.
- Tests: `features/platform-clients/services/config/POSConfigService.test.ts`,
  `features/authentication/hooks/useInactivityLock.test.ts`.

## 5. Return and refund integrity

- `features/returns/services/refunds/returnValidation.ts` → `validateReturnRequest` requires:
  - The order is paid or synced.
  - Each return quantity is a positive whole number; each refund is a finite
    amount ≥ 0.
  - Each item belongs to the order.
  - Quantities per line, including earlier returns and split lines, don't
    exceed the quantity sold.
  - The cumulative refund doesn't exceed the order total (integer-cent
    comparison).
- `ReturnService.processReturn` validates before writing; the LAN
  `POST /api/returns` route runs the same validation so a LAN client can't
  bypass it.
- Tests: `features/returns/services/refunds/returnValidation.test.ts`, `ReturnService.test.ts`.

## 6. LAN authentication — HMAC-signed requests

- `requestSigning.ts` — shared sign/verify helpers. Signature covers
  `METHOD \n PATH?QUERY \n TIMESTAMP \n NONCE \n sha256hex(rawBody)`.
- Client sends `x-instore-register` / `x-instore-timestamp` /
  `x-instore-nonce` / `x-instore-signature`; the secret is never transmitted
  and `x-shared-secret` is no longer sent or accepted.
- `InstoreApiServer` verifies the signature (constant-time), enforces a
  ±5-minute timestamp window, and rejects replayed nonces via a bounded
  in-memory `(register, nonce)` cache.
- `InstoreApiTransport` passes the full path with query string and the raw
  body so the signature covers the exact wire bytes.
- Discovery never sends the secret during subnet scans;
  `probeHealth`/`probeAddress` are unauthenticated.
- `testConnection()` uses authenticated `GET /api/session` — it now detects
  a wrong secret.
- Route order: `/api/orders/unsynced` registered before `/api/orders/:id`.
- Write-route input validation: order shape/amounts/items, order-status
  allowlist, payment field bounds, product/category allowlists and size
  limits, return validation.
- `StoreApiWebSocket`: non-text, oversized (>1 MiB), malformed and
  non-object frames dropped; `dedupe_key` bounded. The HELLO handshake is
  unauthenticated — it belongs to the external store-api protocol.
- Tests: `requestSigning.test.ts`;
  `tests/integration/InstoreApiTransport.integration.test.ts` (legacy-header
  rejection, wrong-secret rejection, replay rejection, tampered body).
- **Rollout:** all registers must run a signing build — mixed versions
  cannot authenticate.

## 7. Logging — metadata redaction

- `shared/services/logger/redaction.ts` recursively redacts metadata keys matching a
  sensitive-word list (`secret`, `token`, `password`, `pin`, `apikey`,
  `authorization`, `credential`, `signature`, `session`, `cookie`, `key`,
  `auth`), with camelCase/separator splitting so `shippingAddress` isn't
  over-redacted.
- Applied in `ReactNativeLogger.forward` before entries reach external
  transports.
- Tests: `shared/services/logger/redaction.test.ts`.

## 8. Electron packaging

- `isDev` requires both `!app.isPackaged` and `NODE_ENV === 'development'` —
  a packaged build can't be tricked into trusting the dev-server origin by
  an env var.
- Network printer ports restricted to raw-print range `9100–9109`.
- `electronFuses` in `package.json`: `runAsNode`,
  `enableNodeOptionsEnvironmentVariable` and
  `enableNodeCliInspectArguments` disabled; `enableCookieEncryption` enabled.
- Deferred pending packaged-build smoke test:
  `enableEmbeddedAsarIntegrityValidation`, `onlyLoadAppFromAsar`.

## 9. Native credential storage

- Removed the mismatched iOS `accessGroup` (didn't match the bundle id, had
  no entitlement — would have caused `errSecMissingEntitlement` and total
  credential-storage failure under the fail-closed policy).
- Secrets use `AccessibleAfterFirstUnlockThisDeviceOnly` — never migrate via
  backups or to other devices.
- Browser `ALLOW_PLAINTEXT_SECRET_FALLBACK` must stay `false` in production;
  Electron uses OS `safeStorage`.

## 10. Where behaviour rules are documented

Feature docs updated alongside the controls:

- `docs/features/multi-register/` — signed-request auth, `/api/session`,
  unauthenticated probes.
- `docs/features/authentication/` (permissions, logout) — deactivated-user
  denial, deny-wins, cache expiry, `PermissionGate`, admin-only credential
  tabs, first-admin bootstrap, last-admin guard, auto-lock.
- `docs/features/returns/` — `validateReturnRequest` rules.
- `docs/features/system-infra/` — secrets backends table, keychain
  accessibility, audit-log limits.

---

## Pending verification (manual, device-dependent)

- Real iOS device build — keychain read/write after access-group removal.
- Packaged Electron build — `electronFuses` apply; app loads `dist/index.html`
  in production mode.
- Two physical registers on a LAN — signed handshake, discovery, sync.
- `expo prebuild` / native build smoke test.

## Residual risks (accepted)

| Risk                             | Note                                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PIN uniqueness oracle            | Creating/updating a user reveals whether a PIN is already taken — inherent to PIN-only identification; limited to admins.                                          |
| Global LAN PIN rate limit        | `/api/users/verify-pin` locks for every register after 10 failures/min — a secret holder can DoS PIN logins. Per-register limiting needs signed register identity. |
| Mutable audit log                | KV JSON array capped ~2000 entries (ADR-012); not tamper-evident. `clear()` exists with no UI caller. Export CSV regularly.                                        |
| Manager-approval lockout keying  | Keyed by requesting cashier; online PIN brute-force protection comes from `AuthAttemptLimiter`.                                                                    |
| Plaintext LAN transport          | Signing protects integrity, not confidentiality → dedicated VLAN or WireGuard/Tailscale overlay required (`network-segmentation.md`).                              |
| Dependency advisories            | 9 remain, all build-time except `decode-uri-component` (DoS only, via `@react-navigation` → `query-string`; fix is ESM-only).                                      |
| Salted SHA-256 credential hashes | No KDF (carried over from round 2).                                                                                                                                |
| Electron privileged IPC surface  | Peripheral/payment bridge is privileged — mitigated by fuses and port allowlists.                                                                                  |
| Platform login disabled          | Carried over from round 2.                                                                                                                                         |
| Webhook listener idempotency     | Carried over from round 2.                                                                                                                                         |
