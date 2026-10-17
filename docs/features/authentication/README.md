# Authentication & Permissions

## Purpose

Identifies the staff member using the register (multi-method PIN-centric auth),
keeps the session alive while the till is attended, locks it after inactivity,
and gates every sensitive action by role with per-user overrides and an
in-context manager-approval challenge.

## Scope

### Included

- Login screen and the six-method provider model (PIN, biometric, password,
  magstripe, RFID/NFC, platform_auth).
- Auth configuration (primary method, allowed methods, online/offline mode).
- Brute-force limiting on credential providers.
- Session lifecycle: login → authenticated state → inactivity lock / logout.
- Permission resolution (role + per-user overrides + action registry).
- Manager approval flow for under-privileged actions.
- Audit logging of auth events.
- Multi-register PIN verification via the store API (client mode).

### Excluded

- User management (create/edit/deactivate staff) — users feature.
- Auth-method _settings_ UI (which methods are enabled) — settings feature.
- `platform_auth` token acquisition details — token/platform services.
- First admin creation — onboarding feature.

## Entry Points

- `AuthNavigator` → `Login` after onboarding completes (`navigation/AuthNavigator.tsx`).
- Session end → back to `Login` (logout/lock in `RootNavigator.handleLogout`).
- Any feature may call `permissionService.can()` or
  `managerApprovalService.requestApproval()` — ManagerApprovalModal is mounted
  globally in `App.tsx`.

## Feature Flow

```
App start (onboarded)
   ▼
LoginScreen
   │  getAvailableProviders() → active = primary | first available
   │  biometric? auto-trigger once. magstripe/rfid? wait for swipe.
   ▼
provider.authenticate(credential)
   │  limiter lockout? → error
   │  local users table …or store-api verifyPin (client mode)
   ▼
AuthResult
   ├─ success → audit(auth:login) → handleLogin → AuthContext(user,role)
   │            → warmUpPlatformToken() (background)
   │            → Main stack; useInactivityLock armed
   └─ failure → audit(auth:failed) → shake + clear input
                limiter.recordResult(false) → lockout after 5

In-session:
   useInactivityLock — every 10s: idle > autoLockMinutes → logout('Session locked…')
   Sensitive action → permissionService.can(userId, action)
      ├─ allowed → proceed
      └─ denied → ManagerApprovalService.requestApproval → modal PIN
           → authService.authenticate('pin') → permissionService.can(manager)
           → approved (audit + approval log) | denied | locked(5 fails → 60s)
```

## Implementation Map

| Layer        | Responsibility                                               | Implementation                                                                                |
| ------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Screens      | Login UI, method switching, shake                            | `screens/LoginScreen.tsx`                                                                     |
| Components   | PIN pad/display, approval modal                              | `components/PinKeypad.tsx`, `PinDisplay.tsx`, `ManagerApprovalModal.tsx`                      |
| Contexts     | Session user + isAuthenticated (memory only)                 | `contexts/AuthProvider.tsx`                                                                   |
| Hooks        | Idle lock                                                    | `hooks/useInactivityLock.ts`, `hooks/useManagerApproval.ts`                                   |
| Services     | Provider registry & dispatch                                 | `services/auth/AuthService.ts`, `services/auth/AuthMethodInterface.ts`                        |
| Services     | Method config persistence                                    | `services/auth/AuthConfigService.ts`                                                          |
| Services     | Method implementations                                       | `services/auth/providers/{Pin,Biometric,Password,Magstripe,RfidNfc,PlatformAuth}Provider.ts`  |
| Services     | Brute-force                                                  | `services/auth/AuthAttemptLimiter.ts`                                                         |
| Services     | Permission resolution + approval                             | `services/permissions/{PermissionService,ManagerApprovalService}.ts`                          |
| Repositories | Users, permission overrides, approvals                       | `repositories/{UserRepository,PermissionRepository}.ts`                                       |
| Libs         | Credential hashing, PIN format, action registry, role matrix | `utils/crypto.ts`, `utils/userPin.utils.ts`, `utils/actionRegistry.ts`, `utils/roleAccess.ts` |
| Services     | Audit                                                        | `services/audit/AuditLogService.ts`                                                           |
| Locales      | Login labels/errors                                          | `locales/*/…` `login.*`                                                                       |
| Docs         | EARS specs                                                   | EARS specs retired into this feature                                                          |

## State Ownership

| State                               | Owner                             | Persistence       | Reset condition                               |
| ----------------------------------- | --------------------------------- | ----------------- | --------------------------------------------- |
| `isAuthenticated` + `user`          | `AuthProvider`                    | **None (memory)** | Logout / lock / app restart — always re-login |
| primary/allowed methods + authMode  | `AuthConfigService`               | KV `auth.*`       | Settings change                               |
| Attempt-limiter counters            | `AuthAttemptLimiter` per provider | None              | App restart (deliberate)                      |
| Users + hashed PINs                 | `UserRepository`                  | `users` table     | User deleted/deactivated                      |
| Permission overrides + approval log | `PermissionRepository`            | DB                | Admin action                                  |
| Permission decision cache           | `PermissionService`               | None              | 60s TTL / invalidateCache                     |
| Last-activity timestamp             | `useInactivityLock`               | None              | Every touch/keydown                           |

## Dependencies

- `utils/crypto.ts` — `hashPin`/`verifyPin`/`timingSafeEqual` (PINs stored
  `v1$salt$hash`; legacy plaintext rows transparently rehashed on login).
- `utils/userPin.utils.ts` — 6-digit format gate.
- `utils/actionRegistry.ts` — action keys + `ROLE_RANK`; `roleAccess.ts` for
  UI-level tab gating (navigation feature consumes it).
- `instoreApiConfig`/`instoreApiClient` — client-mode PIN verify against the
  server register.
- `expo-local-authentication` (biometric provider), HID readers (magstripe/rfid).
- `posConfig.values.autoLockMinutes` — lock timeout (0 disables).
- `auditLogService`, `notificationService` — logging + lockout toast.

## Side Effects

- Audit events: `auth:login`, `auth:failed`, `auth:logout`,
  `auth:platform_token`, `permission:approved`, approval rows in DB.
- Transparent PIN re-hash on legacy-row login (writes `users.pin`).
- `warmUpPlatformToken()` after each login — network call, fire-and-forget.
- Session lock → `handleLogout('Session locked after inactivity')` → full
  logout + audit.
