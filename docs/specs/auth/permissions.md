# Permissions – EARS Requirements

> **System**: RetailPOS – Permission System & Manager Approval  
> **Actor**: Cashier, Manager, Admin, System  
> **Date**: 2026-05-03  
> **Source**: `services/permissions/PermissionService.ts`, `services/permissions/ManagerApprovalService.ts`, `repositories/PermissionRepository.ts`, `repositories/UserRepository.ts`, `utils/actionRegistry.ts`, `services/audit/AuditLogService.ts`, `services/auth/AuthService.ts`

---

## Context

The permission system controls access to sensitive actions in the POS. It uses a role-based model with optional per-user overrides. When a cashier attempts an action they don't have permission for, the system can trigger an in-context manager approval flow where a manager authenticates with their PIN to authorize the action.

### Permission Resolution

The system resolves permissions in priority order:

1. **Admin bypass** — admin role always returns `true`
2. **User-level overrides** — explicit grants or denials in `permission_overrides` table
3. **Action registry default** — minimum role requirement from `ACTION_MAP`
4. **Deny** — unknown actions are denied by default

### Manager Approval Flow

When a cashier needs manager approval:

1. Cashier triggers an action requiring elevated permission
2. System calls `managerApprovalService.requestApproval(actionKey, cashierId)`
3. `ManagerApprovalModal` opens, prompting for manager PIN
4. Manager enters PIN → system authenticates and checks manager's permission
5. If approved, the action proceeds; if denied/cancelled, the action is blocked

### Actors

| Actor   | Role                                                                               |
| ------- | ---------------------------------------------------------------------------------- |
| Cashier | Attempts actions, triggers manager approval when needed                            |
| Manager | Approves actions via PIN authentication                                            |
| Admin   | Configures permission overrides, bypasses all permission checks                    |
| System  | Resolves permissions, caches results, logs approvals, enforces brute-force lockout |

### User Roles

| Role    | Rank | Description                                                          |
| ------- | ---- | -------------------------------------------------------------------- |
| Cashier | 1    | Basic POS operations (sales, returns, customer lookup)               |
| Manager | 2    | Elevated operations (discounts, voids, refunds, reports)             |
| Admin   | 3    | Full system access (settings, user management, permission overrides) |

Role rank is used for default permission checks: `userRank >= requiredRank`.

### Key Defaults

| Field               | Default                                   | Source                                |
| ------------------- | ----------------------------------------- | ------------------------------------- |
| Admin bypass        | Always `true` for admin role              | `PermissionService.resolve()`         |
| Unknown action      | Deny (return `false`)                     | `PermissionService.resolve()`         |
| Cache invalidation  | Per-user or global                        | `PermissionService.invalidateCache()` |
| Brute-force lockout | 5 failures, 60-second cooldown            | `ManagerApprovalService` constants    |
| Approval timeout    | None (modal remains open until dismissed) | `ManagerApprovalService`              |

---

## 1. Ubiquitous Requirements

**1.1** The system shall resolve permissions using a four-tier priority: admin bypass, user overrides, action registry default, deny.

**1.2** The system shall cache permission results in memory per user and action key to avoid repeated database queries.

**1.3** The system shall invalidate the cache for a user when their role or permission overrides change.

**1.4** The system shall audit-log every manager approval with action `permission:approved`, including the approving manager's ID and role.

**1.5** The system shall enforce a brute-force lockout after 5 failed manager approval attempts, locking the requesting user for 60 seconds.

**1.6** The system shall use the action registry (`ACTION_MAP`) as the source of truth for action keys, descriptions, and default minimum roles.

**1.7** The system shall never grant admin-only actions to non-admin users via permission overrides — the admin role ceiling is enforced.

**1.8** The system shall fail closed — any error during permission resolution returns `false`.

---

## 2. Event-Driven Requirements

### 2.1 Check Permission

**2.1.1** When `can(userId, action)` is called, the system shall check the in-memory cache for a cached result.

**2.1.2** When a cached result exists, the system shall return it immediately without querying the database.

**2.1.3** When no cached result exists, the system shall call `resolve(userId, action)` to compute the permission.

**2.1.4** When `resolve()` returns a result, the system shall store it in the cache under `userId → action → result`.

**2.1.5** When any step in `can()` throws an error, the system shall catch it, log an error message, and return `false`.

### 2.2 Resolve Permission

**2.2.1** When `resolve(userId, action)` is called, the system shall call `UserRepository.findById(userId)` to retrieve the user.

**2.2.2** When the user is not found, the system shall return `false`.

**2.2.3** When the user is found and `user.role === 'admin'`, the system shall return `true` immediately (admin bypass).

**2.2.4** When the user is not an admin, the system shall call `PermissionRepository.findOverridesForUser(userId)` to retrieve permission overrides.

**2.2.5** When an override exists for the action and `override.granted === true`, the system shall check if the action is admin-only.

**2.2.6** When the action is admin-only and the user is not an admin, the system shall log a warning and return `false` (ceiling enforced).

**2.2.7** When the action is not admin-only or the user is an admin, the system shall return `true` (override grants permission).

**2.2.8** When an override exists for the action and `override.granted === false`, the system shall return `false` (override denies permission).

**2.2.9** When no override exists, the system shall look up the action in `ACTION_MAP`.

**2.2.10** When the action is not found in `ACTION_MAP`, the system shall log a warning and return `false` (unknown action denied).

**2.2.11** When the action is found, the system shall compare `ROLE_RANK[user.role] >= ROLE_RANK[action.defaultMinRole]` and return the result.

### 2.3 Check Permission by Role (Synchronous)

**2.3.1** When `canByRole(role, action)` is called, the system shall default `role` to `'cashier'` if `undefined`.

**2.3.2** When the role is `'admin'`, the system shall return `true` immediately.

**2.3.3** When the role is not admin, the system shall look up the action in `ACTION_MAP`.

**2.3.4** When the action is not found, the system shall return `false`.

**2.3.5** When the action is found, the system shall compare `ROLE_RANK[role] >= ROLE_RANK[action.defaultMinRole]` and return the result.

**2.3.6** When `canByRole()` is called, the system shall NOT consult user-level permission overrides — this is a role-only check for navigation composers.

### 2.4 Invalidate Cache

**2.4.1** When `invalidateCache(userId)` is called, the system shall delete the cache entry for that user.

**2.4.2** When `invalidateAll()` is called, the system shall clear the entire cache.

### 2.5 Request Manager Approval

**2.5.1** When `requestApproval(actionKey, requestingUserId)` is called, the system shall check if the requesting user is locked out.

**2.5.2** When the user is locked out (`Date.now() < lockoutUntil`), the system shall return `{ approved: false }` immediately without opening the modal.

**2.5.3** When the user is not locked out, the system shall look up the action description from `ACTION_MAP`.

**2.5.4** When the action is found, the system shall create a `PendingApproval` object with `actionKey`, `actionDescription`, `requestingUserId`, and a `resolve` function.

**2.5.5** When the pending approval is created, the system shall store it in `this.pending` and call `notifyListeners()` to trigger UI updates.

**2.5.6** When `requestApproval()` returns, the system shall return a `Promise<ApprovalResult>` that resolves when the modal is dismissed.

### 2.6 Submit Manager PIN

**2.6.1** When `submitManagerPin(pin)` is called and no pending approval exists, the system shall return `{ success: false, error: 'No pending approval' }`.

**2.6.2** When a pending approval exists, the system shall call `AuthService.authenticate('pin', pin)` to authenticate the manager.

**2.6.3** When authentication fails, the system shall call `recordFailure(requestingUserId)` to increment the failure count.

**2.6.4** When the failure count reaches 5, the system shall set a lockout timestamp 60 seconds in the future and emit a warning notification.

**2.6.5** When authentication fails, the system shall return `{ success: false, error: 'Incorrect PIN. Please try again.' }` without resolving the pending approval.

**2.6.6** When authentication succeeds, the system shall call `PermissionService.can(managerId, actionKey)` to check if the manager has permission.

**2.6.7** When the manager does not have permission, the system shall return `{ success: false, error: 'This action requires admin approval.' }` (for admin-only actions) or `{ success: false, error: 'This manager does not have permission for this action.' }` (for other actions).

**2.6.8** When the manager has permission, the system shall call `PermissionRepository.logApproval(actionKey, requestingUserId, managerId, true)` to record the approval.

**2.6.9** When the approval is logged, the system shall call `auditLogService.log('permission:approved')` with metadata including `actionKey`, `requestingUserId`, `approvingUserId`, and `managerRole`.

**2.6.10** When the audit log succeeds, the system shall reset the failure count for the requesting user.

**2.6.11** When all steps succeed, the system shall clear `this.pending`, call `notifyListeners()`, resolve the promise with `{ approved: true, approvingUserId: managerId }`, and return `{ success: true }`.

### 2.7 Cancel Approval

**2.7.1** When `cancel()` is called and no pending approval exists, the system shall return immediately.

**2.7.2** When a pending approval exists, the system shall clear `this.pending`, call `notifyListeners()`, and resolve the promise with `{ approved: false }`.

### 2.8 Subscribe to Approval Changes

**2.8.1** When `subscribe(listener)` is called, the system shall add the listener function to the `listeners` array.

**2.8.2** When `subscribe()` returns, the system shall return an unsubscribe function that removes the listener from the array.

**2.8.3** When `notifyListeners()` is called, the system shall invoke every listener function in the `listeners` array.

---

## 3. State-Driven Requirements

**3.1** While a user is locked out, the system shall reject all `requestApproval()` calls for that user with `{ approved: false }` without opening the modal.

**3.2** While a pending approval exists, the system shall allow only one approval request at a time — subsequent calls to `requestApproval()` will overwrite the pending approval.

**3.3** While the manager is entering their PIN, the system shall allow multiple submission attempts until the approval is resolved or cancelled.

**3.4** While the cache contains a result for a user-action pair, the system shall return the cached result without querying the database.

**3.5** While a user's role is `'admin'`, the system shall always return `true` for any action without checking overrides or the action registry.

---

## 4. Optional Feature Requirements

**4.1** Where a user has a permission override with `granted: true`, the system shall grant the permission unless the action is admin-only and the user is not an admin.

**4.2** Where a user has a permission override with `granted: false`, the system shall deny the permission regardless of their role.

**4.3** Where an action is not found in `ACTION_MAP`, the system shall deny the permission and log a warning.

---

## 5. Unwanted Behaviour / Edge Cases

### 5.1 User Not Found

**5.1.1** If `can()` is called with a `userId` that does not exist in the database, then the system shall return `false`.

### 5.2 Unknown Action

**5.2.1** If `can()` is called with an action key that is not in `ACTION_MAP`, then the system shall log a warning and return `false`.

**5.2.2** If `canByRole()` is called with an unknown action, then the system shall return `false` without logging a warning (synchronous check).

### 5.3 Admin Ceiling Violation

**5.3.1** If a permission override grants an admin-only action to a non-admin user, then the system shall log a warning and return `false` — the admin ceiling is enforced.

### 5.4 Permission Resolution Error

**5.4.1** If any step in `resolve()` throws an error (e.g. database query failure), then `can()` shall catch the error, log it, and return `false` — the system fails closed.

### 5.5 Brute-Force Lockout

**5.5.1** If a user triggers 5 failed manager approval attempts, then the system shall lock them out for 60 seconds and emit a warning notification.

**5.5.2** If a locked-out user calls `requestApproval()`, then the system shall return `{ approved: false }` immediately without opening the modal.

**5.5.3** If the lockout period expires, then the next `requestApproval()` call shall proceed normally.

### 5.6 Manager Lacks Permission

**5.6.1** If a manager authenticates successfully but does not have permission for the requested action, then the system shall return `{ success: false, error }` without resolving the approval.

**5.6.2** If the action is admin-only and the manager is not an admin, then the error message shall be `'This action requires admin approval.'`.

**5.6.3** If the action is not admin-only but the manager's role is insufficient, then the error message shall be `'This manager does not have permission for this action.'`.

### 5.7 No Pending Approval

**5.7.1** If `submitManagerPin()` is called when `this.pending` is `null`, then the system shall return `{ success: false, error: 'No pending approval' }`.

**5.7.2** If `cancel()` is called when `this.pending` is `null`, then the system shall return immediately without throwing.

### 5.8 Concurrent Approval Requests

**5.8.1** If `requestApproval()` is called while a pending approval already exists, then the system shall overwrite `this.pending` with the new approval — the previous approval is abandoned.

---

## 6. Complex Requirements

**6.1** When `can()` is called and the user is an admin, the system shall return `true` immediately without checking overrides or the action registry — admin bypass takes precedence over all other rules.

**6.2** When `resolve()` finds a permission override with `granted: true` for an admin-only action and the user is not an admin, the system shall log a warning, enforce the admin ceiling, and return `false` — overrides cannot grant admin-only actions to non-admins.

**6.3** When `submitManagerPin()` succeeds and the manager has permission, the system shall atomically log the approval to the database, audit-log the event, reset the failure count, clear the pending approval, notify listeners, and resolve the promise with `{ approved: true, approvingUserId }`.

**6.4** When `recordFailure()` increments the failure count to 5, the system shall set a lockout timestamp 60 seconds in the future, reset the failure count to 0, log a warning, and emit a notification — the lockout is enforced on the next `requestApproval()` call.

**6.5** When `canByRole()` is called, the system shall perform a synchronous role-only check without consulting the database or user-level overrides — this is used by navigation composers where async is not available.

---

## 7. Permission System Lifecycle Summary

### Permission Check Flow

```
Component checks permission
  → PermissionService.can(userId, action)
    → Check cache: return cached result if exists
    → resolve(userId, action)
      → UserRepository.findById(userId)
      → Return false if user not found
      → Return true if user.role === 'admin' (admin bypass)
      → PermissionRepository.findOverridesForUser(userId)
      → For each override matching action:
        → If granted === true:
          → Check if action is admin-only
          → If admin-only and user is not admin: log warning, return false (ceiling)
          → Else: return true (override grants)
        → If granted === false: return false (override denies)
      → ACTION_MAP.get(action)
      → Return false if action not found (unknown action)
      → Return ROLE_RANK[user.role] >= ROLE_RANK[action.defaultMinRole]
    → Cache result: cache.set(userId, action, result)
    → Return result
```

### Manager Approval Flow

```
Cashier triggers action requiring approval
  → ManagerApprovalService.requestApproval(actionKey, cashierId)
    → Check lockout: return { approved: false } if locked out
    → Create PendingApproval { actionKey, actionDescription, requestingUserId, resolve }
    → Store in this.pending
    → notifyListeners() → ManagerApprovalModal opens
    → Return Promise<ApprovalResult>

Manager enters PIN
  → ManagerApprovalModal.handleSubmit(pin)
    → ManagerApprovalService.submitManagerPin(pin)
      → Return { success: false, error } if no pending approval
      → AuthService.authenticate('pin', pin)
      → If auth fails:
        → recordFailure(requestingUserId)
          → Increment failure count
          → If count >= 5: set lockout timestamp, emit notification
        → Return { success: false, error: 'Incorrect PIN' }
      → PermissionService.can(managerId, actionKey)
      → If manager lacks permission:
        → Return { success: false, error: 'This action requires admin approval' } (admin-only)
        → Return { success: false, error: 'This manager does not have permission' } (other)
      → PermissionRepository.logApproval(actionKey, requestingUserId, managerId, true)
      → auditLogService.log('permission:approved', { actionKey, requestingUserId, approvingUserId, managerRole })
      → Reset failure count
      → Clear this.pending
      → notifyListeners() → ManagerApprovalModal closes
      → resolve({ approved: true, approvingUserId: managerId })
      → Return { success: true }

Cashier cancels
  → ManagerApprovalModal.handleCancel()
    → ManagerApprovalService.cancel()
      → Clear this.pending
      → notifyListeners() → ManagerApprovalModal closes
      → resolve({ approved: false })
```

### Permission Resolution Priority

| Priority | Rule                    | Example                                                       |
| -------- | ----------------------- | ------------------------------------------------------------- |
| 1        | Admin bypass            | Admin user → always `true`                                    |
| 2        | User override (granted) | Cashier granted `refund:process` → `true` (if not admin-only) |
| 3        | User override (denied)  | Manager denied `settings:edit` → `false`                      |
| 4        | Action registry default | Manager role rank >= action min role → `true`                 |
| 5        | Deny (unknown action)   | Action not in `ACTION_MAP` → `false`                          |

### Brute-Force Lockout

| Attempt   | Result                                                        |
| --------- | ------------------------------------------------------------- |
| 1–4       | Failure recorded, modal remains open                          |
| 5         | Lockout triggered, 60-second cooldown, notification emitted   |
| 6+        | `requestApproval()` returns `{ approved: false }` immediately |
| After 60s | Lockout expires, next `requestApproval()` proceeds normally   |

---

## 8. Component Traceability

| Requirement (summary)          | Component / Hook / Service                                 | Source File                                      |
| ------------------------------ | ---------------------------------------------------------- | ------------------------------------------------ |
| Permission checked             | `PermissionService.can`                                    | `services/permissions/PermissionService.ts`      |
| Cache checked for result       | `PermissionService.cache.get`                              | `services/permissions/PermissionService.ts`      |
| Permission resolved            | `PermissionService.resolve`                                | `services/permissions/PermissionService.ts`      |
| User retrieved from database   | `UserRepository.findById`                                  | `repositories/UserRepository.ts`                 |
| Admin bypass applied           | `PermissionService.resolve` (admin check)                  | `services/permissions/PermissionService.ts`      |
| Permission overrides retrieved | `PermissionRepository.findOverridesForUser`                | `repositories/PermissionRepository.ts`           |
| Admin ceiling enforced         | `PermissionService.resolve` (admin-only check)             | `services/permissions/PermissionService.ts`      |
| Action registry consulted      | `ACTION_MAP.get(action)`                                   | `utils/actionRegistry.ts`                        |
| Role rank compared             | `ROLE_RANK[user.role] >= ROLE_RANK[action.defaultMinRole]` | `utils/actionRegistry.ts`                        |
| Result cached                  | `PermissionService.cache.set`                              | `services/permissions/PermissionService.ts`      |
| Cache invalidated for user     | `PermissionService.invalidateCache`                        | `services/permissions/PermissionService.ts`      |
| Cache cleared globally         | `PermissionService.invalidateAll`                          | `services/permissions/PermissionService.ts`      |
| Role-only check performed      | `PermissionService.canByRole`                              | `services/permissions/PermissionService.ts`      |
| Manager approval requested     | `ManagerApprovalService.requestApproval`                   | `services/permissions/ManagerApprovalService.ts` |
| Lockout checked                | `ManagerApprovalService.lockoutUntil.get`                  | `services/permissions/ManagerApprovalService.ts` |
| Pending approval created       | `ManagerApprovalService.pending`                           | `services/permissions/ManagerApprovalService.ts` |
| Listeners notified             | `ManagerApprovalService.notifyListeners`                   | `services/permissions/ManagerApprovalService.ts` |
| Manager PIN submitted          | `ManagerApprovalService.submitManagerPin`                  | `services/permissions/ManagerApprovalService.ts` |
| Manager authenticated          | `AuthService.authenticate('pin', pin)`                     | `services/auth/AuthService.ts`                   |
| Failure recorded               | `ManagerApprovalService.recordFailure`                     | `services/permissions/ManagerApprovalService.ts` |
| Lockout triggered              | `ManagerApprovalService.lockoutUntil.set`                  | `services/permissions/ManagerApprovalService.ts` |
| Manager permission checked     | `PermissionService.can(managerId, actionKey)`              | `services/permissions/PermissionService.ts`      |
| Approval logged to database    | `PermissionRepository.logApproval`                         | `repositories/PermissionRepository.ts`           |
| Approval audit logged          | `auditLogService.log('permission:approved')`               | `services/audit/AuditLogService.ts`              |
| Failure count reset            | `ManagerApprovalService.failureCounts.delete`              | `services/permissions/ManagerApprovalService.ts` |
| Pending approval cleared       | `ManagerApprovalService.pending = null`                    | `services/permissions/ManagerApprovalService.ts` |
| Approval cancelled             | `ManagerApprovalService.cancel`                            | `services/permissions/ManagerApprovalService.ts` |
| Listener subscribed            | `ManagerApprovalService.subscribe`                         | `services/permissions/ManagerApprovalService.ts` |
| Listener unsubscribed          | Unsubscribe function returned by `subscribe`               | `services/permissions/ManagerApprovalService.ts` |

---

## 6. Hardening Additions (Round 3)

**6.1** When `resolve(userId, action)` finds the user but `is_active` is false, the system shall deny everything — deactivated staff, including admins, retain no permissions.

**6.2** When a user belongs to multiple permission sets and any set explicitly denies an action, the system shall deny the action — a deny always wins over a grant in another set.

**6.3** Cached permission results shall expire after 60 seconds so permission changes take effect even if explicit invalidation is missed.

**6.4** Screens that perform sensitive actions shall guard themselves with `PermissionGate` (or an equivalent `PermissionService.can` check) rather than relying on menu visibility — Settings, Users, PermissionSets, Reports, SyncQueue, Customers, CustomerProfile, and all procurement/inventory-configuration screens are gated in `MoreNavigator`.

**6.5** Credential-bearing settings tabs (Auth, Payment, E-commerce, Multi-register) shall require `settings:edit` (admin-only) via `SettingsTabComposer`; an undefined role resolves as cashier.

**6.6** User management (`useUsers`) shall check `user:create` / `user:edit` / `user:delete` at the data boundary. The only unauthenticated creation path is onboarding creating the first admin, and only while no active admin exists.

**6.7** The system shall refuse to demote, deactivate, or delete the last active admin (`UserRepository`).

| Requirement (summary)                   | Component / Service              | Source File                                  |
| --------------------------------------- | -------------------------------- | -------------------------------------------- |
| Deactivated users denied everything     | `PermissionService.resolve`      | `services/permissions/PermissionService.ts`  |
| Deny wins over grant across sets        | `PermissionService.resolve`      | `services/permissions/PermissionService.ts`  |
| Permission cache expires after 60 s     | `PermissionService.can`          | `services/permissions/PermissionService.ts`  |
| Screen-level permission gate            | `PermissionGate` in navigators   | `components/PermissionGate.tsx`              |
| Admin-only credential settings tabs     | `SettingsTabComposer` role-aware | `services/navigation/SettingsTabComposer.ts` |
| Data-boundary checks in user management | `useUsers`                       | `hooks/useUsers.ts`                          |
| Last active admin cannot be removed     | `UserRepository` guards          | `repositories/UserRepository.ts`             |

---

**Document Metadata**:

- **Author**: Kiro AI Agent
- **Date**: 2026-05-03
- **Version**: 1.0
- **Status**: Final
- **Related**: `docs/specs/auth/login.md`, `docs/specs/auth/logout.md`
