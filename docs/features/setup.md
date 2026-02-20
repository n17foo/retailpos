# Setup

## User Story

**As a** store employee  
**I want to** access administrative and operational screens from a single menu  
**So that** I can manage orders, settings, hardware, and reports without leaving the app

## Rules

- Role-based menu filtering: cashier, manager, admin see different items
- All screens lazy-loaded via React Suspense for performance
- Stack-based navigation with back button support
- Logout always visible at bottom of menu
- Menu items color-coded with distinct icons

---

## Flow 1: Role-Based Menu Access

1. **Employee taps "More" tab** → MoreMenuScreen loads
2. **User role checked** → roleAccess utility filters menu items
3. **Cashier sees** → Daily Orders, Settings, Refunds, Printer, Payment Terminal, Logout
4. **Manager sees** → all cashier items + Reports, Sync Queue
5. **Admin sees** → all manager items + Users
6. **Menu renders** → filtered items with icons, colors, and labels

## Flow 2: Navigate to Screen

1. **Tap menu item** → e.g. "Reports"
2. **Suspense fallback** → loading indicator shown while component loads
3. **Lazy import resolves** → ReportingScreen component loaded
4. **Screen renders** → proper header title, back navigation available
5. **Back button** → returns to More menu

## Flow 3: Screen Destinations

| Menu Item        | Screen                | Roles          |
| ---------------- | --------------------- | -------------- |
| Daily Orders     | DailyOrdersScreen     | all            |
| Settings         | SettingsScreen        | all            |
| Refunds          | RefundScreen          | all            |
| Printer          | PrinterScreen         | all            |
| Payment Terminal | PaymentTerminalScreen | all            |
| Reports          | ReportingScreen       | manager, admin |
| Sync Queue       | SyncQueueScreen       | manager, admin |
| Users            | UsersScreen           | admin          |

## Flow 4: Logout

1. **Tap "Logout"** → always visible at bottom of menu
2. **onLogout callback fired** → clears user session
3. **Navigate to LoginScreen** → authentication required to re-enter

## Questions

- How does the menu handle dynamic permission changes mid-session?
- What happens if a lazy-loaded screen fails to load?
- Can menu item order be customized per store?
- How does navigation handle deep linking from external sources?
