# Settings

## User Story

**As a** store administrator  
**I want to** configure all aspects of the POS system from one screen  
**So that** the system matches my store's requirements

## Rules

- 10 tabs: General, POS Config, Authentication, Payment, Printer, Scanner, E-Commerce, Offline, Receipt, Multi-Register
- Responsive layout: side nav (desktop), scrollable tabs (tablet), dropdown (mobile)
- Floating save bar appears when unsaved changes exist
- Each tab manages its own persistence
- Settings changes audit-logged

---

## Flow 1: Navigate & Edit Settings

1. **Admin opens More → Settings** → SettingsScreen loads
2. **Layout adapts** → desktop: side nav with all 10 tabs; tablet: horizontal scrollable tabs; mobile: dropdown selector
3. **Select tab** → e.g. "Authentication" → AuthMethodSettingsTab component loads
4. **Modify settings** → toggle methods, enter values, select options
5. **Floating save bar appears** → "Save" and "Discard" buttons shown at bottom
6. **Tap Save** → settings persisted to KeyValueRepository / POSConfigService
7. **Audit logged** → settings:changed event with userId and changed fields
8. **Tap Discard** → reverts to last saved state

## Flow 2: Authentication Settings

1. **Select "Authentication" tab** → reads authConfig.authMode (online/offline)
2. **Methods filtered by mode** → online shows platform + offline methods; offline shows offline only
3. **Toggle methods on/off** → PIN and platform_auth toggles locked (cannot disable)
4. **Hardware methods** → MagStripe/RFID only shown if hardware detected
5. **Save** → persists to AuthConfigService → affects login screen

## Flow 3: Payment Settings

1. **Select "Payment" tab** → PaymentSettingsTab loads
2. **Choose provider** → Stripe, Stripe NFC, Square, Worldpay, mock
3. **Enter API keys** → securely stored via KeyValueRepository
4. **Terminal config** → default terminal ID, auto-connect preferences
5. **Save** → payment service reconfigured on next use

## Flow 4: E-Commerce Settings

1. **Select "E-Commerce" tab** → EcommerceSettingsTab loads
2. **Choose platform** → Shopify, WooCommerce, BigCommerce, Magento, etc.
3. **Enter credentials** → API keys, store URL, webhook secrets
4. **Test connection** → validates credentials against platform API
5. **Save** → platform services re-initialized

## Flow 5: Hardware Settings (Printer / Scanner)

1. **Select "Printer" or "Scanner" tab** → respective settings component loads
2. **Discover devices** → scans for available hardware
3. **Select device** → connect and test
4. **Configure** → receipt layout, paper size (printer); scan mode, sensitivity (scanner)
5. **Save** → hardware service reconfigured

## Flow 6: Multi-Register Settings

1. **Select "Multi-Register" tab** → LocalApiSettingsTab loads
2. **Choose mode** → standalone, server, or client
3. **Server mode** → configure port, shared secret, register name
4. **Client mode** → enter server address or scan network for servers
5. **Test connection** → validates connectivity to server
6. **Save** → local API services restart in new mode

## Questions

- How are sensitive settings (API keys) protected in storage?
- Can settings be exported/imported for backup or multi-store deployment?
- What validation prevents saving invalid configurations?
- How does the system handle concurrent settings changes from multiple admins?
