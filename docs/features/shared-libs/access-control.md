# Access Control

**Files:** `utils/roleAccess.ts`, `utils/actionRegistry.ts`,
`utils/menuCapabilityAccess.ts`
**Docs:** permissions + menu-capability rules — retired into `access-control.md` and `docs/features/authentication`
**Tests:** none for these files
**Parent:** [`rules.md`](rules.md)

---

## A-R1 — Tab/menu visibility is a hardcoded role matrix

**Rule**
`canAccessTab(role, tab)` / `canAccessMoreMenuItem(role, item)` consult static
matrices: admin gets all; manager loses `Users`; cashier gets `Sale`, `More`
plus `OrderHistory`/`Printer`/`PaymentTerminal` only. `role === undefined` ⇒
`cashier`.

**Evidence** — `utils/roleAccess.ts` (TAB_ACCESS, MORE_MENU_ACCESS);
consumers: `navigation/MainTabNavigator.tsx`, `screens/sale/MainMenu.tsx`,
More navigator.

🟢 **E1.1** — cashier sees `Sale`+`More`; `canAccessMoreMenuItem('cashier','Users')` → `false`.

🔴 **E1.2 — Unknown/undefined role** — resolves as cashier, never admin
(least-privilege; parent R4).

## A-R2 — Sensitive actions have a default minimum role

**Rule**
`ACTION_REGISTRY` declares ~25 dot-namespaced actions
(`discount:manual`, `order:void`, `settings:edit`, …) each with
`defaultMinRole`; `ROLE_RANK` ranks cashier<manager<admin. PermissionService
resolves the effective role against overrides/manager-approval.

**Evidence** — `utils/actionRegistry.ts`; consumed by
`services/permissions/PermissionService`, `ManagerApprovalService`.

🟢 **E2.1** — `discount:apply` min `cashier` (no approval); `discount:manual`
min `manager` → cashier triggers the approval flow.

🟠 **E2.2** — Adding a sensitive action = one registry row; forgetting to
register means the action is unguarded — there is no "deny unregistered"
fallback visible here. Open question.

## A-R3 — Menu items are gated by role **and** platform capability

**Rule**
`evaluateCombinedAccess`: role-denied ⇒ `hidden`; capability
`not_recommended` ⇒ `hidden`; `supported` ⇒ `enabled`; `custom` ⇒ `enabled`
only when `adapterReady`, else `disabled` + reason.

**Evidence** — `utils/menuCapabilityAccess.ts` (spec rule quoted in header);
consumers: More-menu composer, settings tabs.

🟢 **E3.1** — WooCommerce `giftCards: custom` + adapter not ready → menu item
`disabled` with `getUnavailableReason` text.

🔴 **E3.2** — `not_recommended` hides the entry entirely — users never see
why a feature is absent (by design: hidden, not disabled).

🟠 **E3.3** — `evaluateRoleOnlyAccess` covers features with no capability key.

## ❓ Questions

- **A-Q1** — Is there a deny-by-default path for actions missing from
  `ACTION_REGISTRY`, or does an unregistered sensitive action execute
  unchecked? Needs `PermissionService` resolution to confirm.
- **A-Q2** — `UserRole` type comes from `repositories/UserRepository` —
  should the role enum live in a shared types module instead (parent Q1)?

## Coverage

| Example       | Coverage                                                  |
| ------------- | --------------------------------------------------------- |
| A-R1 matrices | Not found (indirect via permission/menu tests)            |
| A-R2 registry | `PermissionService` tests cover resolution, not the table |
| A-R3 gating   | Not found                                                 |
