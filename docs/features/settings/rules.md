# Settings — Rules

## R1 — Cashiers can never reach settings, from any entry path

**Rule.** Menu item hidden via `canAccessMoreMenuItem`, **and** the screen
itself returns an access-denied view when `role` is `cashier`/undefined —
defence in depth, not just menu hiding.

**Evidence.** `utils/roleAccess.ts`, `screens/SettingsScreen.tsx:58`.

🔴 **E1.1** — cashier deep-links/deep-navigates → denied screen, not a crash.

🟠 **E1.2 — `visibleTabs.length === 0`** — even a manager sees denied/empty
when the composer yields nothing (edge — PG1).

## R2 — Tab availability = role × platform capability

**Rule.** `composeSettingsTabs({userRole, platform, capabilities})` returns
ordered tabs each with `MenuItemStatus`: core tabs always enabled;
capability-keyed tabs `enabled | disabled(+reason) | hidden`.
`hidden` tabs never render; `disabled` render with a reason but no content.

**Evidence.** `services/navigation/SettingsTabComposer.ts`,
`utils/menuCapabilityAccess.ts` (A-R3).

🟢 **E2.1** — platform with `payment: not_recommended` → Payment tab hidden.

🟠 **E2.2 — Custom adapter not ready** → tab `disabled` with
`getUnavailableReason` text.

🟢 **E2.3** — Theme is a core tab — always present regardless of platform.

## R3 — Settings persist immediately and optimistically

**Rule.** `updateSetting(key, value)` writes `KeyValueRepository` first, then
updates the in-memory map; failure → refetch all + rethrow.

**Evidence.** `hooks/useSettings.ts:44`, spec §1.4-1.5.

🟢 **E3.1** — save store name → KV row + map update; UI reflects instantly.

🔴 **E3.2 — write fails** → full refetch restores consistency; error
propagates to the caller (no silent swallow).

## R4 — Tabs adapt to form factor

**Rule.** Tab navigation is side-nav on desktop, scrollable tab bar on
tablet, modal dropdown on phone.

**Evidence.** `screens/SettingsScreen.tsx` layout code.

📱 **E4.1** — rotate phone → nav style switches with the layout class.

## R5 — Management screens (Users, Permission sets) live under the same gate

**Rule.** `UsersScreen`, `UsersSettingsTab`, `PermissionSetsScreen` share
admin-level gating — user CRUD + permission-set editing is manager/admin
surface; `Users` menu item is admin-only (`manager` loses it per A-R1).

**Evidence.** `screens/{UsersScreen,settings/UsersSettingsTab,
settings/PermissionSetsScreen}.tsx`, `utils/roleAccess.ts`.

🟢 **E5.1** — admin edits a PIN → `validatePinFormat` 6-digit rule applies
(C-R2).

## R6 — Credential-bearing settings tabs may require extra action

**Rule.** Composer marks tabs `requiresAction` beyond `settings:view` —
credential fields (payment keys, API secrets, shared secret) have a second
gate.

**Evidence.** `SettingsTabComposer.ts:41`.

🟠 **E6.1** — verify each credential tab enforces it (Q1).

## ❓ Open Questions

- **Q1** — Which concretely require `requiresAction` beyond view, and what
  enforces it per tab?
- **Q2** — `GenericSettingsTab` storeName/currency — do they feed
  `posConfig.values` (receipt headers, default currency) or a separate store?
- **Q3** — Offline tab "sync controls" — what exactly does
  `OfflineManagementTab` control vs orders-sync's queue?

## ⚠️ Potential Gaps

- **PG1** — `visibleTabs.length === 0` renders denied view — a manager on a
  broken capability profile loses settings access entirely rather than
  seeing core tabs (composer should always include core tabs; verify).
- **PG2** — Optimistic map + failure-refetch: a failed write leaves other
  components' cached reads stale until refetch completes.
- **PG3** — Some tabs (instoreapi, payment) trigger live reconfiguration —
  no explicit "restart required" signalling if a change needs re-init.
- **PG4** — Per-tab `isLoading`/`saveStatus` handling is per-component — an
  un-saved tab switching loses edits unless FloatingSaveBar tracks it.

## Test Coverage Mapping

| Example             | Coverage                            |
| ------------------- | ----------------------------------- |
| R1 role gate        | Indirect via roleAccess/nav tests   |
| R2 composer         | Not found for `composeSettingsTabs` |
| R3 optimistic write | Not found                           |

## Feature Context Summary

**Feature**: Settings & configuration
**Responsibility**: Role-gated, capability-composed tabbed settings hub over
the SQLite KV store; users/permission-sets/product/category management.

**Core rules**

- R1 Cashier → denied (menu + screen, both).
- R2 Tabs = role × capability (enabled/disabled/hidden).
- R3 `updateSetting` persists immediately; failure → refetch + throw.
- R4 Adaptive tab nav per form factor.
- R5 Users/permission sets under same gate (Users = admin).
- R6 Credential tabs may carry `requiresAction`.

**Primary happy path**: admin opens Settings → picks tab → edits → persists
instantly.

**Critical unhappy paths**: cashier denied; capability-hidden features don't
render; write failure → refetch + error.

**Dependencies**: `roleAccess`, `menuCapabilityAccess` + capability matrix,
`KeyValueRepository`, translations.

**Gaps**: zero-tab edge; stale reads during refetch; unsaved-edit loss on
tab switch.
