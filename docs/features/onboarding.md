# Onboarding

## User Story

**As a** new user setting up RetailPOS for the first time  
**I want to** complete a guided setup process  
**So that** the system is properly configured before I start selling

## Rules

- Two paths: **online** (10 steps) and **offline** (11 steps) — determined by platform selection
- Progress indicator shows current step and total steps
- Settings persisted as user progresses — no data lost on back navigation
- Completion marks system as onboarded via `setIsOnboarded(true)`

---

## Flow 1: Online Platform Setup (10 steps)

1. **Welcome** → intro screen, tap "Get Started"
2. **Platform Selection** → choose Shopify, WooCommerce, BigCommerce, Magento, Sylius, Wix, PrestaShop, or Squarespace
3. **Platform Configuration** → enter API key, store URL, webhook secret → saved via `useEcommerceSettings`
4. **Payment Provider** → select Stripe/Square/Worldpay, enter API credentials
5. **Printer Setup** → discover and connect receipt printer
6. **Scanner Setup** → discover and connect barcode/QR scanner
7. **POS Config** → store name, address, phone, tax rate, currency, max sync retries, drawer-on-cash → saved via `posConfig.updateAll()`
8. **Auth Method Setup** → select login methods filtered by online mode (platform_auth always on) → `selectedPlatform` passed to determine `authMode`
9. **Admin User** → create initial admin account with full permissions
10. **Summary** → review all settings, back navigation to edit, tap "Complete" → `setIsOnboarded(true)`

## Flow 2: Offline Store Setup (11 steps)

1. **Welcome** → intro screen, tap "Get Started"
2. **Platform Selection** → choose "Offline"
3. **Offline Store Setup** → enter store name, categories, currency → saved via `useEcommerceSettings`
4. **Admin User** → create initial admin account (earlier in flow for offline)
5. **Staff Setup** → add cashier accounts with usernames and PINs
6. **Payment Provider** → select payment terminal provider
7. **Printer Setup** → discover and connect receipt printer
8. **Scanner Setup** → discover and connect barcode/QR scanner
9. **POS Config** → store name, address, phone, tax rate, currency
10. **Auth Method Setup** → select login methods filtered by offline mode (PIN always on)
11. **Summary** → review and complete

## Flow 3: Step Navigation

1. **Progress indicator** → shows step N of M with labels
2. **Next** → each step has "Next" or "Complete" button → validates before advancing
3. **Back** → each step has "Back" button → returns to previous step, data preserved
4. **Skip** → hardware steps (printer, scanner) can be skipped if no devices available
5. **Progress bar hidden** on Welcome step

## Questions

- What happens if the user exits onboarding midway through?
- How can onboarding be restarted or reset after completion?
- What validation occurs for platform API credentials during setup?
- How are hardware connectivity issues communicated during setup?
