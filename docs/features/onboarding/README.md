# Onboarding & Platform Connection

## Purpose

First-run wizard that gates the entire app: it selects the e-commerce platform
(or offline mode), collects credentials or offline store basics, creates the
first admin user, offers optional peripheral setup, then unlocks the login
flow. It runs **exactly once** — `onboarding_status === 'completed'` in the
key-value store means it is never shown again.

## Scope

### Included

- The 3-phase wizard: platform_setup → admin_user_setup → peripherals_setup.
- Platform selection, per-platform credential forms, offline store setup
  (name, tax destination address, currency, starter categories/products).
- First admin user creation (name/email/PIN).
- Optional printer/scanner/payment-terminal baseline setup.
- Deferred-setup bookkeeping (`setup.progress`) surfaced later in More menu.

### Excluded

- Login / PIN auth itself (authentication feature).
- Settings screens where deferred tasks are completed (settings feature).
- The runtime platform services that _consume_ the saved credentials
  (`PlatformCredentialsResolver`, per-platform clients).

## Entry Points

- **App start, `onboarding_status` absent/pending** → `AuthNavigator` mounts
  `OnboardingScreen` as its initial route (`navigation/AuthNavigator.tsx:27-30`,
  `navigation/RootNavigator.tsx:87`). There is no other way in — no deep link,
  no menu entry, no re-run.
- Exit: `completeOnboarding()` → `setIsOnboarded(true)` → AuthNavigator swaps
  to `Login`; after login → `Main` stack.

## Feature Flow

```
App start
   │  OnboardingProvider reads KV 'onboarding_status'
   │  !== 'completed' ?
   ▼
┌─ Phase 1 platform_setup ────────────────────────────────┐
│ PlatformSelectionStep (8 cards)                         │
│   ├─ online → PlatformConfigurationStep (creds form)    │
│   └─ offline → OfflineSetupStep (store/catalogue)       │
│ saveSettings() → secrets; posConfig (offline only);     │
│ capability.setPlatform; completePhase('platform')       │
└──────────────────────────────────────────────────────────┘
   ▼
┌─ Phase 2 admin_user_setup ──────────────────────────────┐
│ AdminUserStep: info → 6-digit PIN → confirm PIN         │
│ createUser(role:'admin'); completePhase('user')         │
└──────────────────────────────────────────────────────────┘
   ▼
┌─ Phase 3 peripherals_setup ──────────── skippable ──────┐
│ PaymentProviderStep → PrinterSetupStep → ScannerSetupStep│
│ completePhase('peripherals')                             │
└──────────────────────────────────────────────────────────┘
   ▼
markOnboardingComplete(deferredFeatures)
setIsOnboarded(true) → 'completed' → Login
```

## Implementation Map

| Layer        | Responsibility                                 | Implementation                                                                                                                          |
| ------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Screens      | Wizard orchestration                           | `screens/OnboardingScreen.tsx`                                                                                                          |
| Screens      | Step UIs                                       | `screens/onboarding/{PlatformSelection,PlatformConfiguration,OfflineSetup,AdminUser,PrinterSetup,ScannerSetup,PaymentProvider}Step.tsx` |
| Contexts     | `isOnboarded` gate, KV persistence             | `contexts/OnboardingProvider.tsx`                                                                                                       |
| Hooks        | Settings save, users, hardware                 | `hooks/useEcommerceSettings.ts`, `useUsers.ts`, `usePrinterSettings.ts`, `useScannerSettings.ts`, `usePaymentSettings.ts`               |
| Services     | Progress tracking, capabilities, config        | `services/setup/SetupProgressService.ts`, `services/platform/PlatformCapabilityService.ts`, `services/config/POSConfigService.ts`       |
| Services     | Credential persistence                         | `services/config/EcommerceSettingsStorage.ts` → `ProtectedValueStore` → `secrets/` backend                                              |
| Repositories | KV keys, users table                           | `repositories/KeyValueRepository.ts` (`onboarding_status`, `setup.progress`), `repositories/UserRepository.ts`                          |
| Libs         | Currency table, PIN format                     | `utils/currency.ts`, `utils/userPin.utils.ts`, `utils/crypto.ts`                                                                        |
| Locales      | Step labels, validation, platform descriptions | `locales/*/…` (`onboarding.*`, `platformSelection.*`, `adminUser.*`)                                                                    |
| Docs         | EARS spec                                      | EARS wizard spec — retired into this feature                                                                                            |

## State Ownership

| State                                                  | Owner                      | Persistence                               | Reset condition               |
| ------------------------------------------------------ | -------------------------- | ----------------------------------------- | ----------------------------- |
| `isOnboarded`                                          | `OnboardingProvider`       | KV `onboarding_status`                    | Manual KV clear / reinstall   |
| Phase + sub-step                                       | `OnboardingScreen` local   | None                                      | Screen unmount / app kill     |
| `selectedPlatform`, `ecommerceConfig`, `offlineConfig` | `OnboardingScreen` local   | None until step-complete handler persists | App kill loses in-memory data |
| E-commerce settings (incl. credentials)                | `EcommerceSettingsStorage` | Secrets backend (KV legacy fallback)      | Re-onboard / settings edit    |
| `storeName/storeAddress/currencySymbol`                | `posConfig`                | POS config store                          | Settings edit                 |
| Setup progress + deferred features                     | `SetupProgressService`     | KV `setup.progress`                       | Feature completed in Settings |
| Admin user                                             | `UserRepository`           | `users` table                             | User deleted                  |

## Dependencies

- `KeyValueRepository` — `onboarding_status`, `setup.progress` gating.
- `SecretsService` backend — credentials land in Keychain / Electron
  safeStorage / browser store; plaintext KV fallback only where permitted.
- `PlatformCapabilityService` — `setPlatform` called on phase-1 complete;
  capabilities decide which features are deferred.
- `useUsers`/`UserRepository` — admin creation + `isPinUnique` resume check.
- `usePrinterSettings`/`useScannerSettings`/`usePaymentSettings` — peripherals
  steps save real settings through the same hooks Settings uses.
- `platformCapabilityService` + `posConfig` — offline tax-destination fields.

## Side Effects

- Writes secrets (whole `ecommerceSettings` blob incl. credentials).
- Writes POS config (offline only: storeName/storeAddress/currencySymbol).
- Creates `users` row (first admin) — sales/permissions depend on it.
- Writes `setup.progress` — drives "Finish setup" callouts in More menu.
- Sets the global platform on `platformCapabilityService` — gates feature
  menus for the rest of the session.
- Each peripheral step saves its real settings (test connection side effects
  live in the hardware services).
