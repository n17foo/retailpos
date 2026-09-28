# Settings Tabs – EARS Requirements

> **System**: RetailPOS – Settings Tab Content
> **Actor**: Manager, Admin
> **Date**: 2026-05-09
> **Source**: `screens/settings/GenericSettingsTab.tsx`, `screens/settings/POSConfigSettingsTab.tsx`, `screens/settings/AuthMethodSettingsTab.tsx`, `screens/settings/PaymentSettingsTab.tsx`, `screens/settings/EcommerceSettingsTab.tsx`, `screens/settings/OfflineManagementTab.tsx`, `screens/settings/InstoreApiSettingsTab.tsx`, `screens/settings/PrinterSettingsTab.tsx`, `screens/settings/ScannerSettingsTab.tsx`, `screens/settings/ReceiptSettingsTab.tsx`, `screens/settings/ThemeSettingsTab.tsx`

---

## Context

Each settings tab is an independent component rendered inside `SettingsScreen`. Tabs persist their own data — there is no shared save mechanism across tabs. The `FloatingSaveBar` in `SettingsScreen` is available but individual tabs manage their own dirty state and save actions.

Cross-references to other specs:

- Printer tab → `docs/specs/hardware/printer.md`
- Scanner tab → `docs/specs/hardware/scanner.md`
- Auth tab → `docs/specs/hardware/auth.md`
- Payment tab → `docs/specs/hardware/payment.md`

---

## Tab 1 — General (`GenericSettingsTab`)

**Purpose**: UI language selection. Date/time format is planned but not yet implemented.

**1.1** When `GenericSettingsTab` mounts, the system shall call `getCurrentLanguage()` and set `selectedLanguage` to the current locale code.

**1.2** When the user taps a language option, the system shall call `changeLanguage(langCode)` immediately — the change takes effect without a save button.

**1.3** The selected language option shall render with a primary-colour border, highlighted background, and a checkmark.

**1.4** The Date & Time section shall render a "Coming Soon" placeholder — no date format controls are implemented yet.

---

## Tab 2 — POS Config (`POSConfigSettingsTab`)

**Purpose**: Store identity, tax rate, currency, sync retries, and cash drawer behaviour. Persisted to `POSConfigService`.

**2.1** When `POSConfigSettingsTab` mounts, the system shall read current values from `posConfig.values` and populate all fields. Tax rate is displayed as a percentage (e.g. `0.08` → `'8'`).

**2.2** When any field changes, the system shall set `dirty = true` and show the Save button.

**2.3** When the user taps Save, the system shall validate:

- `storeName` is non-empty — if empty, show `Alert` with required message and abort
- `taxRate` parses to a number between 0 and 100 — if invalid, show `Alert` and abort

**2.4** When validation passes, the system shall call `posConfig.updateAll({ storeName, storeAddress, storePhone, taxRate: rate/100, currencySymbol, maxSyncRetries, drawerOpenOnCash })`, set `dirty = false`, and show a success alert.

**2.5** The currency selector shall render all options from `getCurrencyOptions()` as a grid of tappable chips. The selected currency shall render with primary-colour border and background.

**2.6** The `drawerOpenOnCash` toggle shall use a `Switch` component. Toggling it sets `dirty = true`.

**2.7** The Save button shall only be visible when `dirty === true`.

**2.8** While `saving` is `true`, the Save button shall show an `ActivityIndicator` and be disabled.

---

## Tab 3 — Authentication (`AuthMethodSettingsTab`)

**Purpose**: Enable/disable auth methods, set the primary (default) method. Persisted to `AuthConfigService`.

> See also: `docs/specs/hardware/auth.md` for the full auth method spec.

**3.1** When `AuthMethodSettingsTab` mounts, the system shall load `authConfig.primaryMethod` and `authConfig.allowedMethods`, then check `isAvailable()` for each method applicable to the current `authMode`.

**3.2** PIN and `platform_auth` shall always be shown with an "Always On" badge and their toggle disabled — they cannot be turned off.

**3.3** When the user toggles a non-PIN, non-platform method off, the system shall remove it from `enabledMethods`. If it was the primary method, the primary shall revert to `'pin'`.

**3.4** When the user taps "Set as Default" on an enabled method, the system shall set it as `primaryMethod` and mark `dirty = true`.

**3.5** When the user taps "Set as Default" on a disabled method, the system shall show an alert asking the user to enable it first.

**3.6** When the user taps Save, the system shall call `authConfig.setAllowedMethods(methods)`, `authConfig.setPrimaryMethod(primaryMethod)`, and update `setHardwareAvailable` on magstripe and RFID providers to match their enabled state.

**3.7** Methods whose `isAvailable()` returned `false` shall render at reduced opacity with a "Not available on this device" note.

---

## Tab 4 — Payment (`PaymentSettingsTab`)

**Purpose**: Select payment provider and configure provider-specific credentials. Persisted to `usePaymentSettings`.

> See also: `docs/specs/hardware/payment.md` for the full payment terminal spec.

**4.1** When `PaymentSettingsTab` mounts, the system shall call `loadSettings()` to populate `paymentSettings` from storage.

**4.2** The provider selector shall render radio buttons for all `PaymentProvider` enum values. Selecting a provider updates `paymentSettings.provider`.

**4.3** The system shall render the provider-specific credential form only for the selected provider:

- `STRIPE_NFC` → API key (secure), publishable key, location ID, backend URL, direct API toggle, NFC enable toggle, simulated reader toggle, connection timeout; includes a "Test Terminal Connection" button
- `STRIPE` → API key (secure), location ID
- `SQUARE` → application ID, location ID, access token (secure)
- `ADYEN` → API key (secure), client key, merchant account, environment selector (test / live)
- `TAP_PAYMENTS` → API key (secure), publishable key, merchant ID

> **Note**: Non-SDK provider must be configured through the Instore API layer. There is no Electron-specific payment form.

**4.4** When the user taps "Test Connection", the system shall call `testConnection(provider)` and show a success or error alert.

**4.5** When the user taps Save, the system shall call `saveSettings(paymentSettings)` and show a success status message.

**4.6** The Save and Cancel buttons shall be disabled when `saveStatus !== 'unsaved'` or `isLoading` is `true`.

---

## Tab 5 — E-commerce (`EcommerceSettingsTab`)

**Purpose**: Enable e-commerce integration, select platform, and configure platform-specific API credentials. Persisted to `useEcommerceSettings` → `ServiceConfigBridge`.

**5.1** When the E-commerce toggle is `OFF`, all platform and credential fields shall be hidden.

**5.2** When the E-commerce toggle is turned `ON`, the platform selector and credential fields shall appear.

**5.3** The platform selector shall render radio buttons for all supported platforms: Shopify, WooCommerce, BigCommerce, Magento, Sylius, Wix, PrestaShop, Squarespace, Commercefull, Offline.

**5.3.a** When a platform is selected, the system shall render a **Platform Capability Summary** panel showing feature status for at least: catalog, customers, inventory, order sync, draft orders, discounts, gift cards, and refunds.

**5.3.b** The capability summary shall use the standard levels `supported`, `custom`, and `not_recommended`, and shall include short explanatory text for any feature not marked `supported`.

**5.4** When the selected platform is `offline`, the system shall show an info box explaining local-only mode and a store name field. No API credential fields are shown.

**5.5** When the selected platform is `wix` or `squarespace`, the Store URL field shall be hidden (these platforms use API key + site ID only).

**5.6** Platform-specific extra fields shall be shown based on the selected platform:

- `woocommerce` → consumer secret
- `commercefull` → API secret
- `bigcommerce` → store hash, client ID
- `wix` → site ID, account ID
- `squarespace` → site ID

**5.7** When the user taps "Test Connection", the system shall call `testEcommerceConnection()`. For `offline` platform, an info alert is shown instead.

**5.8** When the user taps Save, the system shall call `saveChanges()` and show a success alert.

**5.9** The Save button shall be disabled when `!hasUnsavedChanges` or `!ecommerceSettings.enabled`.

**5.10** The system shall persist the selected platform's capability profile identifier (or version marker) with the platform settings so runtime menu and settings composition can remain deterministic.

**5.11** Capability summary content shall be read from the centralized capability source (`platformCapabilities` / `PlatformCapabilityService`), not hardcoded in the tab component.

### Capability-driven visibility for settings tabs

**5.12** `SettingsScreen` shall support capability-driven tab visibility. Core tabs (`generic`, `pos`, `auth`, `payment`, `printer`, `scanner`, `ecommerce`) remain visible; advanced tabs and feature actions may be hidden or disabled based on selected platform capability.

**5.13** Where a feature is `custom`, settings UI may render as disabled with a "requires adapter setup" note unless adapter readiness is true.

**5.14** Where a feature is `not_recommended`, corresponding setup controls shall be hidden by default or rendered disabled with a non-actionable informational message.

---

## Tab 6 — Offline Management (`OfflineManagementTab`)

**Purpose**: Manage local SQLite data — products, categories, and users — for offline-first operation. Acts as a sub-navigator with an overview and three sub-sections.

**6.1** When `OfflineManagementTab` mounts, the system shall render the overview with three cards: Products, Categories, Users.

**6.2** When the user taps a card, the system shall render the corresponding sub-tab (`ProductManagementTab`, `CategoryManagementTab`, or `UsersSettingsTab`) and show a back button.

**6.3** When the user taps the back button, the system shall return to the overview.

**6.4** The overview shall include an info box explaining that offline data is stored locally in SQLite and used when no e-commerce platform is connected.

---

## Tab 7 — Receipt (`ReceiptSettingsTab`)

**Purpose**: Configure receipt header (business name, address, phone, tax ID), footer lines, print options (paper width, cut, QR code), and printer model preset.

> See also: `docs/specs/hardware/printer.md` section 2.6 for `ReceiptConfigService` details.

**7.1** When `ReceiptSettingsTab` mounts, the system shall call `receiptConfigService.initialize()` and populate all fields from the loaded config.

**7.2** When the user changes any field, the system shall mark the form dirty and show the Save button.

**7.3** When the user taps Save, the system shall call `receiptConfigService.updateConfig(updates)` and show a success message.

**7.4** The printer model selector shall call `receiptConfigService.setPrinterModel(modelType)` on selection, which adjusts `characterWidth` for 58mm paper automatically.

---

## Tab 8 — Printer (`PrinterSettingsTab`)

**Purpose**: Add, connect, and test thermal printer connections (network, USB, Bluetooth).

> Full spec: `docs/specs/hardware/printer.md`

**8.1** When `PrinterSettingsTab` mounts, the system shall call `printerService.loadPrinters()` and display the list of configured printers.

**8.2** When the user taps "Connect", the system shall call `printerService.connectToPrinter(name)`.

**8.3** When the user taps "Test Connection", the system shall call `printerService.testConnection(config)`.

**8.4** When the user adds or edits a printer, the system shall call `printerService.updatePrinterConfig(name, config)`.

---

## Tab 9 — Scanner (`ScannerSettingsTab`)

**Purpose**: Configure barcode/QR scanner type, device ID, and BLE UUIDs.

> Full spec: `docs/specs/hardware/scanner.md`

**9.1** When `ScannerSettingsTab` mounts, the system shall load persisted scanner settings from `keyValueRepository` under `'scannerSettings'`.

**9.2** When the user changes scanner type, device ID, or BLE UUIDs, the system shall mark the form dirty.

**9.3** When the user taps Save, the system shall call `saveSettings(settings)` to persist to `keyValueRepository`.

**9.4** When the user taps "Test Connection", the system shall call `testConnection(settings)` and show a success or failure result.

---

## Tab 10 — Multi-Register (`InstoreApiSettingsTab`)

**Purpose**: Configure the local API for multi-register setups. Three modes: standalone (no networking), server (this register hosts the API), client (this register connects to another register's API).

**10.1** When `InstoreApiSettingsTab` mounts, the system shall call `instoreApiConfig.load()` and populate mode, port, shared secret, register name, and server address.

**10.2** The mode selector shall render three cards: Standalone, Server, Client. The active mode shall render with a primary-colour border.

**10.3** When mode is `standalone`, the configuration fields (port, shared secret, register name) shall be hidden.

**10.4** When mode is `server` or `client`, the system shall show register name, port, and shared secret fields.

**10.5** When mode is `client`, the system shall additionally show the server address field, a "Test Connection" button, a "Scan Network" button, and the discovered servers list.

**10.6** When the user taps "Test Connection", the system shall call `instoreApiClient.testConnection()` and update `connectionStatus` to `'connected'` or `'failed'`.

**10.7** When the user taps "Scan Network", the system shall call `instoreApiDiscovery.scanSubnet()` with a progress callback, update `scanProgress` (0–100%), and populate `discoveredServers` on completion.

**10.8** When the user taps a discovered server, the system shall set `serverAddress` and `port` from the server entry, save the config, switch mode to `client`, and test the connection.

**10.9** When the user taps Save, the system shall call `instoreApiConfig.save(config)`. If mode is `server`, it shall also call `instoreApiServer.start()`. If mode is `client` or `standalone`, it shall call `instoreApiServer.stop()`.

---

## Tab 11 — Theme (`ThemeSettingsTab`)

**Purpose**: Select a color theme that aligns the POS to the business's brand. The selected theme is applied immediately across the entire UI and persisted across restarts.

**11.1** When `ThemeSettingsTab` mounts, the system shall read the active theme id from `ThemeProvider` via `useTheme()` and render all available presets.

**11.2** The system shall render each theme as a card showing: three color swatches (primary, secondary, background), the theme name, a description, and a dark-mode indicator where applicable.

**11.3** When the user taps a theme card, the system shall call `setTheme(id)` immediately — the change takes effect without a separate save button.

**11.4** `setTheme(id)` shall persist the selected theme id to `keyValueRepository` under the key `'app.theme'` and update the `ThemeProvider` context so all components re-render with the new palette.

**11.5** The active theme card shall render with a primary-colour border and a checkmark icon.

**11.6** The `default` theme shall match the original RetailPOS color palette exactly — selecting it restores the original appearance.

**11.7** Theme colors shall be derived from `utils/themes.ts`. The `ThemeColors` type is `typeof lightColors` from `utils/theme.ts` — `utils/theme.ts` remains the single source of truth for the base palette.

**11.8** `ThemeSettingsTab` is a core tab — it is always visible to authorized roles and is not subject to platform capability gating.

### Available Presets

| Theme id  | Name    | Description                                     | Dark |
| --------- | ------- | ----------------------------------------------- | ---- |
| `default` | Default | Clean blue and orange — original RetailPOS look | No   |
| `dark`    | Dark    | Easy on the eyes in low-light environments      | Yes  |
| `ocean`   | Ocean   | Deep teal and blue — calm and professional      | No   |
| `forest`  | Forest  | Natural greens — food and wellness businesses   | No   |
| `sunset`  | Sunset  | Warm coral and amber — energetic and inviting   | No   |
| `slate`   | Slate   | Neutral grey-blue — understated and corporate   | No   |
| `rose`    | Rose    | Elegant pink and plum — boutique and beauty     | No   |
| `amber`   | Amber   | Warm gold and brown — artisan and café          | No   |

---

## Edge Cases

**E.1** `POSConfigSettingsTab` — if `posConfig.values` has no values yet (first run before onboarding completes), all fields will be empty. The save validation will catch the missing store name.

**E.2** `AuthMethodSettingsTab` — if `authService.getProvider(method)` returns `undefined` for a method in `applicableMethods`, `availability[method]` is set to `false` and the card renders at reduced opacity.

**E.3** `EcommerceSettingsTab` — the API key field maps to different platform-specific fields depending on the selected platform. Switching platforms does not clear previously entered credentials for other platforms.

**E.4** `InstoreApiSettingsTab` — if `instoreApiDiscovery.scanSubnet()` finds no servers, an alert is shown: "No servers found on the local network."

**E.5** `OfflineManagementTab` — the sub-tabs (`ProductManagementTab`, `CategoryManagementTab`, `UsersSettingsTab`) manage their own state independently. Navigating back to the overview does not reset their state.

---

## Component Traceability

| Tab            | Key action                                              | Source File                                  |
| -------------- | ------------------------------------------------------- | -------------------------------------------- |
| General        | `changeLanguage(code)`                                  | `screens/settings/GenericSettingsTab.tsx`    |
| POS Config     | `posConfig.updateAll(values)`                           | `screens/settings/POSConfigSettingsTab.tsx`  |
| POS Config     | Tax rate validation (0–100)                             | `screens/settings/POSConfigSettingsTab.tsx`  |
| Auth           | `authConfig.setAllowedMethods` + `setPrimaryMethod`     | `screens/settings/AuthMethodSettingsTab.tsx` |
| Auth           | `setHardwareAvailable` on magstripe/RFID                | `screens/settings/AuthMethodSettingsTab.tsx` |
| Payment        | `saveSettings(paymentSettings)`                         | `screens/settings/PaymentSettingsTab.tsx`    |
| Payment        | `testConnection(provider)`                              | `screens/settings/PaymentSettingsTab.tsx`    |
| E-commerce     | `saveChanges()` → `ServiceConfigBridge`                 | `screens/settings/EcommerceSettingsTab.tsx`  |
| E-commerce     | `testEcommerceConnection()`                             | `screens/settings/EcommerceSettingsTab.tsx`  |
| E-commerce     | `CapabilitySummaryPanel` reads `platformCapabilities`   | `screens/settings/EcommerceSettingsTab.tsx`  |
| Offline        | Sub-navigator: products / categories / users            | `screens/settings/OfflineManagementTab.tsx`  |
| Receipt        | `receiptConfigService.updateConfig`                     | `screens/settings/ReceiptSettingsTab.tsx`    |
| Printer        | `printerService.connectToPrinter` / `testConnection`    | `screens/settings/PrinterSettingsTab.tsx`    |
| Scanner        | `saveSettings` to `keyValueRepository`                  | `screens/settings/ScannerSettingsTab.tsx`    |
| Multi-Register | `instoreApiConfig.save` + `instoreApiServer.start/stop` | `screens/settings/InstoreApiSettingsTab.tsx` |
| Multi-Register | `instoreApiDiscovery.scanSubnet` with progress          | `screens/settings/InstoreApiSettingsTab.tsx` |
| Multi-Register | `instoreApiClient.testConnection`                       | `screens/settings/InstoreApiSettingsTab.tsx` |
| Theme          | `useTheme().setTheme(id)` → persists to `app.theme`     | `screens/settings/ThemeSettingsTab.tsx`      |
| Theme          | `ThemeProvider` context re-renders entire UI            | `contexts/ThemeProvider.tsx`                 |
| Theme          | Preset registry + `ThemeColors` type                    | `utils/themes.ts`                            |
