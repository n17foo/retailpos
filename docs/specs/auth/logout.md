# Authentication – Logout EARS Requirements

> **System**: RetailPOS – Logout
> **Actor**: Cashier, Manager, Admin
> **Date**: 2026-04-13
> **Source**: `navigation/MoreNavigator.tsx`, `navigation/RootNavigator.tsx`, `contexts/AuthProvider.tsx`

---

## Context

Logout clears the authenticated session and returns the user to the login screen. It is always available at the bottom of the More menu regardless of role — every authenticated user can log out.

The logout flow is intentionally minimal: it clears `user` and `isAuthenticated` in `AuthProvider`, which causes `RootNavigator` to switch from the `Main` stack to the `Auth` stack. No API calls are made, no local data is cleared, and no confirmation is required.

### Logout Flow

```
User taps "Logout" in More menu
  → onLogout() callback fires
    → RootNavigator.handleLogout()
      → setUser(null)
      → setIsAuthenticated(false)
  → RootNavigator re-renders
    → isAuthenticated === false → renders Auth stack
  → LoginScreen shown
```

---

## 1. Ubiquitous Requirements

**1.1** The Logout item shall always be visible in the More menu for all authenticated users regardless of role — it is appended after the role-filtered items and is never subject to `canAccessMoreMenuItem`.

**1.2** Logout shall clear `user` to `null` and `isAuthenticated` to `false` in `AuthProvider` — no other local state, SQLite data, or key-value store entries are cleared.

**1.3** Logout shall not make any network or platform API calls — it is a purely local session reset.

**1.4** After logout, the `RootNavigator` shall render the `Auth` stack (login screen) because `isAuthenticated === false`.

---

## 2. Event-Driven Requirements

**2.1** When the user taps "Logout" in `MoreMenuScreen`, the system shall call the `onLogout` callback immediately without a confirmation dialog.

**2.2** When `onLogout` is called, `RootNavigator.handleLogout` shall call `setUser(null)` then `setIsAuthenticated(false)` on the `AuthContext`.

**2.3** When `isAuthenticated` becomes `false`, `RootNavigator` shall render the `Auth` stack — the `Main` stack (and all its screens) is unmounted.

**2.4** When the `Auth` stack renders, the system shall show `LoginScreen` (or the onboarding flow if `!isOnboarded`, but that state is unaffected by logout).

**2.5** When an authenticated session has been idle for `pos.autoLockMinutes` minutes (default `DEFAULT_AUTO_LOCK_MINUTES = 5`; `0` disables), the system shall call `onLogout` with reason `'Session locked after inactivity'`. Touches captured at the root navigator and web/Electron `keydown` events count as activity; time in the background counts towards the idle period, so returning to an unattended register requires re-login.

---

## 3. State-Driven Requirements

**3.1** While `isAuthenticated` is `true`, the `Main` stack is rendered and the Logout item is visible in the More menu.

**3.2** While `isAuthenticated` is `false`, the `Auth` stack is rendered — the More menu and all protected screens are inaccessible.

---

## 4. Unwanted Behaviour / Edge Cases

**4.1** Logout does not clear the basket, order history, settings, or any persisted data — the next user who logs in will see the same SQLite state. Cashiers should complete or cancel any open orders before logging out.

**4.2** If an order sync is in progress when logout occurs, the sync operation continues in the background service (`BackgroundSyncService`) — it is not cancelled by logout. The result will not be surfaced to the UI since the authenticated session is gone.

**4.3** There is no confirmation dialog before logout — tapping "Logout" immediately clears the session. This is intentional for fast cashier switching at a shared terminal.

**4.4** The `onLogout` callback is passed down through `MainTabNavigator` → `MoreNavigator` → `MoreMenuScreen` as a prop chain. If any component in the chain fails to forward it, the Logout button will have no effect — this is a prop-drilling risk noted for future context migration.

---

## 5. Component Traceability

| Requirement (summary)                                | Component / Service                                                          | Source File                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Logout always visible, not role-filtered             | `MoreMenuScreen` menu construction (appended after filter)                   | `navigation/MoreNavigator.tsx`                                    |
| Tap Logout → `onLogout()` callback                   | `MoreMenuScreen` Logout item `onPress`                                       | `navigation/MoreNavigator.tsx`                                    |
| `onLogout` forwarded through navigator chain         | `MainTabNavigator` → `MoreNavigator` → `MoreMenuScreen` props                | `navigation/MainTabNavigator.tsx`, `navigation/MoreNavigator.tsx` |
| `handleLogout` clears user + isAuthenticated         | `RootNavigator.handleLogout` → `setUser(null)` + `setIsAuthenticated(false)` | `navigation/RootNavigator.tsx`                                    |
| Auth stack rendered when `isAuthenticated === false` | `RootNavigator` conditional stack render                                     | `navigation/RootNavigator.tsx`                                    |
| `user` and `isAuthenticated` state in context        | `AuthProvider` useState                                                      | `contexts/AuthProvider.tsx`                                       |
| Auto-lock after inactivity                           | `useInactivityLock` + root touch capture                                     | `hooks/useInactivityLock.ts`, `navigation/RootNavigator.tsx`      |
| Idle timeout setting (`pos.autoLockMinutes`)         | `POSConfigService` / `AUTO_LOCK_TIMEOUT_MS`                                  | `services/config/POSConfigService.ts`                             |
