# Settings & Configuration

## Purpose

The admin/manager configuration hub — a tabbed screen whose tabs are
composed from role + platform capability. All settings persist to the SQLite
key-value store and are read app-wide via `SettingsProvider`/`posConfig`.

## Scope

### Included

- `SettingsScreen` — role gate (cashier → access denied), adaptive tab nav
  (side nav desktop / tab bar tablet / modal phone), `FloatingSaveBar` for
  unsaved changes.
- `composeSettingsTabs` — ordered tab list with `enabled|disabled|hidden`
  status from role + capability matrix.
- Tabs: General (`GenericSettingsTab`), POS Config, Authentication, Payment,
  Hardware, Hardware Status, E-commerce, Offline, Receipt, Multi-Register,
  Theme — plus Users (`UsersSettingsTab`/`UsersScreen`), Permission sets
  (`PermissionSetsScreen`), Product and Category management tabs.
- `useSettings` — `Record<string,unknown>` map over `KeyValueRepository`;
  optimistic `updateSetting` with refetch-on-failure.
- `SettingsProvider` — context wrapper exposing `useSettingsData()`.

### Excluded

- The _behaviour_ the settings control lives in each owning feature
  (payments, hardware, auth, multi-register, theme…).
- `posConfig.values` — the runtime-config facade used by code paths
  (`features/platform-clients/services/config/POSConfigService.ts`).

## Entry Points

- **More → Settings** — role-gated menu item (`canAccessMoreMenuItem` hides
  it for cashiers) → `Settings` route in `MoreNavigator`.
- **More → Users / Permission Sets** — `UsersScreen`, `PermissionSetsScreen`.
- Deep links into `More → Settings` tab — the screen itself re-checks role.

## Feature Flow

```
Open Settings → role check (cashier → denied screen)
   → composeSettingsTabs({role, platform, capabilities})
      → core tabs always enabled; capability-gated tabs
        enabled | disabled(+reason) | hidden
   → tap tab → independent tab component edits via useSettings
      → updateSetting → KV write + optimistic map
        (failure → refetch all + throw)
   → FloatingSaveBar shows while unsaved changes pending
```

## Implementation Map

| Layer        | Responsibility                           | Implementation                                                                                                                                                                            |
| ------------ | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Screens      | Hub + tab components + Users/Permissions | `features/settings/screens/SettingsScreen.tsx`, `features/settings/screens/*Tab.tsx`, `features/settings/screens/{UsersScreen}.tsx`, `features/settings/screens/PermissionSetsScreen.tsx` |
| Hooks        | KV read/write                            | `features/settings/hooks/useSettings.ts`                                                                                                                                                  |
| Contexts     | Settings context                         | `features/settings/contexts/SettingsProvider.tsx`                                                                                                                                         |
| Services     | Tab composition                          | `features/settings/services/SettingsTabComposer.ts`                                                                                                                                       |
| Repositories | KV store                                 | `shared/repositories/KeyValueRepository.ts`                                                                                                                                               |
| Libs         | Role + capability gating                 | `shared/utils/{roleAccess,menuCapabilityAccess}.ts`                                                                                                                                       |
| Locales      | Tab labels `settings.tabs.*`             | `locales/*`                                                                                                                                                                               |

## State Ownership

| State                | Owner                              | Persistence | Reset condition |
| -------------------- | ---------------------------------- | ----------- | --------------- |
| All settings         | `KeyValueRepository`               | SQLite KV   | User edit       |
| Settings map         | `useSettings` → `SettingsProvider` | mirrors KV  | Reload          |
| Active tab           | `SettingsScreen`                   | None        | Remount         |
| Unsaved-changes flag | tab components → `FloatingSaveBar` | None        | Save/discard    |

## Dependencies

- `shared/utils/roleAccess.ts` — cashier denial (screen AND menu item).
- `shared/utils/menuCapabilityAccess.ts` + `platformCapabilities` — tab status.
- `KeyValueRepository` — every setting is a KV row.
- `t()` translations for tab labels.

## Side Effects

- Immediate KV writes per `updateSetting` (optimistic UI).
- Some tabs trigger live reconfiguration (e.g. payment provider switch,
  theme preset, instore-api restart on mode change).
- Access-denied rendering for cashiers regardless of entry path.
