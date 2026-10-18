# Authentication & Permissions — Rules

**Specs:** auth EARS specs (login/logout/permissions) — retired into this doc

---

## R1 — PIN is always available and cannot be disabled

**Rule**
`AuthService.getAvailableProviders()` always prepends the PIN provider if it
isn't already enabled; `AuthConfigService.disableMethod('pin')` is a no-op;
`setAllowedMethods`/`setPrimaryMethod` force PIN back in.

**Evidence** — `AuthService.ts:78-82`, `AuthConfigService.ts:107-146`;
spec §1.1.

🟢 **E1.1** — `allowedMethods = ['biometric']` saved → load normalises to
`['pin','biometric']` — every login screen has a PIN path.
🟠 **E1.2 — `platform_auth` excluded everywhere** — it is filtered out of
persisted allowed/primary methods, its `supportedModes` is `[]`, and its
`isAvailable()` returns `false`. Spec §2.7 platform login is unreachable —
Contradiction C1.

## R2 — Providers are gated by config, device availability, and mode

**Rule**
`authenticate(method)`: unknown → error; non-PIN not in `allowedMethods` →
"not enabled"; method's `supportedModes` must include `authMode`;
`provider.isAvailable()` must be true; result must resolve to an **active**
staff user or it's a failure.

**Evidence** — `AuthService.ts:88-109`.

🟢 **E2.1** — biometric allowed + enrolled → provider used; biometric not in
allowed → "Fingerprint is not enabled."
🔴 **E2.2 — Deactivated user** — provider returns success but `is_active = 0`
→ "Authentication did not resolve to an active staff user."
🟠 **E2.3** — `isAvailable()` throwing is treated as unavailable (silent).

## R3 — Credential providers are brute-force limited (in-memory)

**Rule**
`AuthAttemptLimiter`: after `maxAttempts` (5) recent failures → lock for
`30s × 2^overruns`, capped at 15 min. Success does **not** reset the counter;
the budget expires after `maxLockoutMs` of failure-free inactivity.
Per-provider instance; restart clears it (documented anti-abuse choice).

**Evidence** — `AuthAttemptLimiter.ts`; used by Pin/Password/Magstripe/RfidNfc
providers.

🟢 **E3.1** — 5th wrong PIN → `Try again in 30s` error.
🟠 **E3.2** — 6th failure → 60s; 7th → 120s; capped 15 min.
🟠 **E3.3 — Restart resets lockout** — documented trade-off; an attacker who
can restart the device bypasses it. Deliberate (avoids persistent lockout DoS).
🟠 **E3.4** — malformed PIN (non-6-digit) counts toward the limiter.

## R4 — PINs are salted-SHA256; legacy plaintext migrates on first login

**Rule**
`UserRepository.findByPin` scans **all active users**, `verifyPin` each —
matching a legacy plaintext row transparently re-hashes it (`v1$` format).

**Evidence** — `features/authentication/repositories/UserRepository.ts:90-103`, `shared/utils/crypto.ts`.

🟢 **E4.1** — new user → `hashPin` stored; login verifies via salted hash.
🟠 **E4.2 — Migration** — plaintext row from an old schema verifies, then the
row is re-hashed (fire-and-forget `updatePin().catch()`).
🟠 **E4.3 — O(n·verify)** — every login checks every active user; fine for a
POS (tens of users), noticeable at thousands.

## R5 — Client-mode PIN verify goes to the server register

**Rule**
When `instoreApiConfig.isClient`, `PinAuthProvider` calls
`instoreApiClient.verifyPin` instead of the local users table — user
management is centralised on the server register.

**Evidence** — `features/authentication/services/auth/providers/PinAuthProvider.ts:39-47,85-99`.

🟢 **E5.1** — client register, server reachable → PIN verified centrally.
🔴 **E5.2 — LAN down on a client register** → `verifyPin` fails →
`Authentication failed` — **cashiers cannot log in even for offline sales**.
No local fallback. Potential gap PG1.

## R6 — Session is memory-only; lock = logout

**Rule**
`AuthProvider` keeps `{isAuthenticated, user}` in memory only. Logout and
inactivity lock both call `handleLogout(details)` → clear user → audit
`auth:logout`. After any app restart the staff member must re-authenticate.

**Evidence** — `features/authentication/contexts/AuthProvider.tsx`, `app/navigation/RootNavigator.tsx:55-68`;
spec `logout.md`.

🟢 **E6.1** — logout → `auth:logout` with the triggering detail
("User logged out" / "Register locked" / "Session locked after inactivity").
📱 **E6.2 — App kill** — session never persisted → next launch shows Login.
🔴 **E6.3** — `handleLogout` with an in-flight sale: the basket **persists**
(feature-owned); the next login sees the draft — by design.

## R7 — Idle lock = posConfig `autoLockMinutes`, armed only when authenticated

**Rule**
`useInactivityLock` checks every 10s; `idle >= AUTO_LOCK_TIMEOUT_MS()` →
lock. Touch capture + (web) `keydown` reset the timer — **HID barcode scans
count as activity**. `autoLockMinutes = 0` disables. Background time counts.

**Evidence** — `features/authentication/hooks/useInactivityLock.ts`,
`features/platform-clients/services/config/POSConfigService.ts:142`, `RootNavigator` responder capture.

🟢 **E7.1** — default N minutes idle → auto-logout with audit detail.
🟠 **E7.2 — Scanning keeps the session alive** — deliberate (a busy till is
active), but a scanner left firing could keep a register unlocked.
📱 **E7.3 — Foreground after sleep** — the `AppState` 'active' listener runs
`checkIdle` → immediate lock if the device slept past the timeout.

## R8 — Permission resolution: admin → overrides → registry default → deny

**Rule**
`permissionService.can(userId, action)`: user missing/inactive → deny;
`admin` → allow; any deny override → deny; grant override → allow **unless**
the action's `defaultMinRole === 'admin'` (ceiling); else registry default
role rank; unknown action → deny. 60s per-user cache; fails closed on error.
`canByRole` is a synchronous role-only variant (no overrides) for composers.

**Evidence** — `features/authentication/services/permissions/PermissionService.ts`; spec §1, §6.1.

🟢 **E8.1** — cashier + `discount:apply` (min cashier) → true.
🔴 **E8.2** — cashier + `order:void` (min manager) → false → caller triggers
manager approval (R9).
🟠 **E8.3 — Override ceiling** — a set granting `settings:edit` (admin-only)
to a manager → still denied; warn-logged.
🟠 **E8.4 — Cache staleness** — role demotion/deactivation can take up to 60s
to take effect (TTL documented as intentional; `invalidateCache` exists but
only helps same-process callers).

## R9 — Manager approval is an in-context PIN challenge

**Rule**
`requestApproval(actionKey, requestingUserId)` → pending promise + listeners;
`ManagerApprovalModal` shows; `submitManagerPin` → authenticate the manager's
PIN via `authService` → `permissionService.can(managerId, actionKey)` →
log approval + audit → resolve `{approved:true}`. Cancel → `{approved:false}`.
5 bad PINs (keyed to the **requesting** user) → 60s lockout + notification.

**Evidence** — `features/authentication/services/permissions/ManagerApprovalService.ts`,
`features/authentication/components/ManagerApprovalModal.tsx`, `features/authentication/hooks/useManagerApproval.ts`.

🟢 **E9.1** — cashier taps price-override → modal → manager enters PIN →
approved → action proceeds; `permission:approved` audited.
🔴 **E9.2 — Manager lacks permission** — e.g. manager PIN for `settings:edit`
(admin-only) → "This action requires admin approval."
🔴 **E9.3 — 5 wrong manager PINs** → requester's approvals lock 60s;
subsequent `requestApproval` immediately resolves `{approved:false}`.
🟠 **E9.4** — The manager's PIN attempt also hits the shared `pin` provider's
`AuthAttemptLimiter` — approval attempts can lock out the login PIN path for
the register (shared limiter; observed).

## R10 — Every auth event is audited

**Rule**
`auth:login` (user, method), `auth:failed` (method + error), `auth:logout`
(detail), `auth:platform_token` (post-login warm-up result),
`permission:approved` (manager, action).

**Evidence** — `LoginScreen.tsx:59-78`, `RootNavigator.tsx:45-52,56-66`,
`ManagerApprovalService.ts:117-124`; spec §1.2–1.3.

## ❓ Open Questions

- **Q1** — Is `platform_auth` intentionally dead (UI/primary mode/provider
  all disabled), or is it waiting on a token-service capability? Spec §2.7
  documents a full flow.
- **Q2** — `AuthConfigService.setAuthMode` exists but **no caller** sets it —
  `authMode` is always `'offline'`. Should onboarding call it? (Spec says
  "set during onboarding"; `OnboardingScreen` never does.)
- **Q3** — Client-mode login failure when the server register is offline —
  intended hard dependency or should there be an emergency local PIN?
- **Q4** — `findByPin` returns the _first_ matching user by `name ASC` — two
  users sharing a PIN is prevented by `isPinUnique` at creation, but a legacy
  DB could contain duplicates; first match wins silently.

## ⚠️ Potential Coverage Gaps

- **PG1** — Client-register login requires the LAN server; no offline
  fallback → register unusable during network loss.
- **PG2** — Permission cache (60s) means server-side role changes lag; a
  deactivated user keeps their permissions until TTL.
- **PG3** — `ManagerApprovalService` lockout is keyed to requesting user but
  the manager's PIN failures also feed the login limiter (R9 E9.4) — a
  cashier could force a register-wide PIN lockout.
- **PG4** — `warmUpPlatformToken` is fire-and-forget — token failure is
  audited but the first real API call still pays the latency/failure.
- **PG5** — `useInactivityLock` polls every 10s — up to ~10s over the
  configured timeout before lock fires.
- **PG6** — Biometric enrollment maps to a local user implicitly — revoking
  local user deactivates, but OS-level biometric revocation isn't re-checked
  beyond `isAvailable`.

## ⚠️ Contradictions

- **C1** — Spec §2.7 documents platform login end-to-end; the provider is
  disabled at three layers (`supportedModes: []`, `isAvailable()→false`,
  filtered from persisted methods) — unreachable dead path.
- **C2** — Spec says `authMode` is "set during onboarding"; onboarding never
  calls `setAuthMode` → always `'offline'`.
- **C3** — Login spec says navigate "to the Order screen"; current flow lands
  on `Main` (Sale tab) — stale doc wording.

## Test Coverage Mapping

| Example                  | Coverage                             |
| ------------------------ | ------------------------------------ |
| R3 limiter               | `AuthAttemptLimiter.test.ts`         |
| R2/R1 provider dispatch  | `AuthService.test.ts`                |
| R1/R2 config persistence | `AuthConfigService.test.ts`          |
| R8 resolution            | `PermissionService.test.ts`          |
| R7 lock timer            | `useInactivityLock.test.ts`          |
| R4/R5 PIN providers      | Not found (indirect via AuthService) |
| R9 approval flow         | Not found                            |
| R6 session               | Not found                            |
