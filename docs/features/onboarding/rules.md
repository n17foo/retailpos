# Onboarding & Platform Connection — Rules

**Spec:** EARS wizard spec — retired into this feature (EARS §1A authoritative)

---

## R1 — The wizard gates the app until `onboarding_status === 'completed'`

**Rule**
`OnboardingProvider` reads the KV key on mount; `AuthNavigator` mounts the
wizard as its initial route when not completed. Once `'completed'`, the wizard
is unreachable — no re-run path exists in UI.

**Evidence** — `contexts/OnboardingProvider.tsx`, `navigation/AuthNavigator.tsx:27`,
`navigation/RootNavigator.tsx:87`; spec §1.1/2.3/2.4.

🟢 **E1.1 — First launch**
Given `onboarding_status` absent
When the app starts
Then the wizard shows at `platform_setup` and Login is unreachable.

📱 **E1.2 — Kill mid-wizard**
Given the app was killed during `admin_user_setup`
When it restarts
Then `isOnboarded` is still false → the wizard restarts at `platform_setup`;
in-memory platform selection is lost, but persisted phase data (settings,
admin user) survives — see E6.3.

🔴 **E1.3 — KV write failure at completion**
`setIsOnboarded` catches and logs; `setIsOnboardedState` is _inside_ the try,
so a failed KV write leaves `isOnboarded` false → wizard reappears next launch
even though onboarding data was saved. Observed: `OnboardingProvider.tsx:40-47`.

## R2 — Exactly 3 mandatory phases; sub-steps are internal

**Rule**
`platform_setup` → `admin_user_setup` → `peripherals_setup`; a
`ProgressIndicator` shows `n/3`. Phase-1 has `platform_selection →
platform_configuration|offline_setup` sub-steps; phase-3 has
`payment → printer → scanner`.

**Evidence** — `screens/OnboardingScreen.tsx:47-61`; spec §1A, §2.1.

🟢 **E2.1** — selecting an online platform shows the credential form;
selecting `offline` shows `OfflineSetupStep` instead — never both.
🟠 **E2.2 — Back from admin** — `onBack` on `AdminUserStep` returns to
`platform_setup` _and_ resets the sub-step to `platform_selection`; entered
config (`ecommerceConfig`/`offlineConfig`) is preserved in screen state —
spec §1.3 holds.

## R3 — Online platform = per-platform required-field validation only

**Rule**
Each platform form checks its required fields are non-empty
(shopify: storeUrl+accessToken; woocommerce: +apiKey+apiSecret;
bigcommerce: storeHash+accessToken; magento/sylius/prestashop:
storeUrl+token/key; wix: apiKey+siteId) then completes — **no connection test
is performed**.

**Evidence** — `screens/onboarding/PlatformConfigurationStep.tsx:25-76`.

🟢 **E3.1** — all required fields filled → `Finish Setup` saves settings and
advances.
🔴 **E3.2 — Bad credentials pass** — wrong-but-nonempty credentials validate
and save; failure only surfaces later when platform services call the API.
⚠️ **Contradiction C1** — spec §1A.1.2 says online setup "shall … allow
connection test before continue"; no test exists in the step.

## R4 — Offline setup = store basics + starter catalogue + tax destination

**Rule**
`storeName` required; `storeAddress` (free text) is the **tax destination**
(D10) and is persisted to `posConfig` on complete; currency picked from the
55-code table; ≥1 category and ≥1 product required to continue.

**Evidence** — `screens/onboarding/OfflineSetupStep.tsx:126-141`;
`screens/OnboardingScreen.tsx:147-169` (`posConfig.updateAll`).

🟢 **E4.1** — store name + 1 category + 1 product + address → Continue →
settings saved, `storeName/storeAddress/currencySymbol` written to posConfig.
🔴 **E4.2 — No address** — validation does **not** require `storeAddress`;
spec §1A.1.3 says country is _required_. Free-text address ≠ structured
country — Contradiction C2 (partial D10).
� **E4.3 — Entered catalogue is seeded** — `handleOfflineSetupComplete`
writes each category via `offlineCategoryService.addCategory` and each
product via `offlineProductService.createProduct` (`productType` set to the
category name — the offline category-matching convention in
`utils/categoryFilter.ts`). Per-category failures are logged, not fatal.
🟠 **E4.4** — duplicate category names (case-insensitive) rejected; category
removal cascades to its products with a confirm dialog.

## R5 — First admin user: name required, 6-digit PIN, resume-safe

**Rule**
`info → pin → confirm` sub-steps. PIN via on-screen keypad, auto-advances at
6 digits; mismatch clears both and returns to PIN entry. `isPinUnique`
guards uniqueness — **but** if the taken PIN already belongs to an admin,
the step treats onboarding as resumed and advances without creating a
duplicate user.

**Evidence** — `screens/onboarding/AdminUserStep.tsx:77-134`.

🟢 **E5.1** — name + 6-digit PIN + matching confirm → `createUser(role:
'admin')` → alert → peripherals.
🔴 **E5.2 — PIN mismatch** → inline error, both fields cleared, back to PIN.
🔴 **E5.3 — PIN taken by non-admin** → `adminUser.pinInUse` error, reset.
🟠 **E5.4 — PIN taken by an existing admin** → advance (idempotent resume
after a kill between user creation and completion).
🔴 **E5.5 — createUser throws** → error shown, PIN cleared, back to entry.

## R6 — Peripherals are skippable and save through real settings hooks

**Rule**
Order: `payment → printer → scanner`. Printer/scanner have explicit Skip;
the payment step has only Back/Next (advancing without selecting a provider
is the implicit skip). Skipped or not, `completePhase('peripherals')` runs
and onboarding completes. Settings entered save via the same
`use*Settings` hooks Settings uses — no separate code path.

**Evidence** — `screens/OnboardingScreen.tsx:185-200`; the three step files.
Spec §2.2, §3.1–3.3 (mock flags).

🟢 **E6.1** — skip printer and scanner → onboarding completes.
🟠 **E6.2 — Kill inside peripherals** — `peripherals` phase incomplete →
next launch re-runs the whole wizard from phase 1, but admin/platform data
persisted (phases save eagerly at each boundary).

## R7 — Completion writes progress, deferred features, and the gate key

**Rule**
`markOnboardingComplete(deferred)` where `deferred` = capability-driven
feature keys (discounts/giftcards/refunds/loyalty/store_credit when
`supported|custom`) + always `staff`, `pos_config`, `auth_methods`. Then
`setIsOnboarded(true)` → KV `'completed'` → Login.

**Evidence** — `screens/OnboardingScreen.tsx:68-93,204-209`;
`services/setup/SetupProgressService.ts`.

🟢 **E7.1** — offline platform → `loyalty`+`store_credit` deferred (both
`supported` on offline), refunds deferred, giftcards **not** (=
`not_recommended`) — discoverable as "finish setup" items in More menu.

## R8 — Credentials live in the secrets backend, not plain KV

**Rule**
`EcommerceSettingsStorage` wraps `ProtectedValueStore`: writes go to the
platform secret backend under `config:ecommerceSettings`; a plaintext KV
blob is only a permitted legacy/dev fallback and is migrated to secrets on
next read where the backend exists; platforms without fallback permission
fail closed and the legacy blob is **deleted**.

**Evidence** — `services/config/EcommerceSettingsStorage.ts`,
`services/config/ProtectedValueStore.ts`, `services/config/PlatformCredentialsResolver.ts`.

🟢 **E8.1** — save → `secrets.storeSecret`; later reads by
`PlatformCredentialsResolver`/`TokenUtils` come back from the secret backend.
🟠 **E8.2 — Legacy blob migration** — reading a pre-secrets install migrates
`ecommerceSettings` KV → secrets and removes the plaintext row.
🔴 **E8.3 — Fallback forbidden** — where `allowsPlaintextFallback()` is false
and only a legacy blob exists, it is deleted and the platform must be
reconfigured (credentials effectively lost).

## ❓ Open Questions

- **Q1** — Spec §1A.1.2 requires a connection test before continuing on
  online platforms — intentionally not implemented yet, or missed? Nothing in
  the step calls the platform API.
- ~~**Q2**~~ — resolved: `commercefull` was an omission. Now in the picker
  with a Store URL + email/key + password/secret form (token-auth client).
- **Q3** — `ecommerceConfig` is stored under key `[platform.toLowerCase()]` —
  platform ids are already lowercase; is the transform defensive or leftover?
- ~~**Q4**~~ — resolved: onboarding now seeds the offline catalogue (see
  E4.3).

## ⚠️ Potential Coverage Gaps

- ~~**PG1**~~ **RESOLVED** — `handleOfflineSetupComplete` now seeds the
  offline catalogue via `offlineCategoryService`/`offlineProductService`
  (see E4.3).
- ~~**PG2**~~ **RESOLVED** — `commercefull` added to the picker, config form,
  validation, and all four locales.
- **PG3** — No credential connection test — first failure surface is a
  post-login service call.
- **PG4** — `storeAddress` free text, optional; spec wants a required
  structured country → tax destination may be empty/unusable for
  `OfflineTaxResolver`.
- **PG5** — `handlePlatformConfigComplete` awaits `saveSettings()` without
  try/catch — a secrets-backend failure aborts the phase transition with an
  unhandled rejection (the phase does not advance; no user-facing error).
- **PG6** — `PaymentProviderStep` has no Skip/Next-disabled state — pressing
  Next with nothing selected silently stores the default provider.

## ⚠️ Contradictions

- **C1** — Spec requires a connection test (1A.1.2); implementation only
  checks non-empty fields.
- **C2** — Spec requires a structured, required tax-destination country
  (1A.1.3, 1A.1.4–1A.1.5 "design, not yet implemented"); implementation has
  an optional free-text `storeAddress` for offline and nothing for online.
- **C3** — `PlatformConfigurationStep` hardcodes English UI strings and
  `Alert` titles while `platformSelection.*`/`adminUser.*` locales exist —
  this step is unlocalized.

## Test Coverage Mapping

| Example                                     | Coverage                                                                       |
| ------------------------------------------- | ------------------------------------------------------------------------------ |
| R1–R8                                       | Not found — no onboarding tests discovered (`tests/` has no onboarding suites) |
| `ProtectedValueStore` migration/fail-closed | `PlatformCredentialsResolver.test.ts` (indirect)                               |

---

## Feature Context Summary

**Feature** — Onboarding & Platform Connection
**Responsibility** — One-shot gated wizard: pick platform, save credentials
(secrets) or offline basics + tax destination, create first admin, optional
peripherals, mark `onboarding_status` and deferred features.
**Entry Points** — App start only; `AuthNavigator` when
`onboarding_status !== 'completed'`. No re-run path.
**Core Rules** — R1 completed-gate; R2 3 phases; R3 per-platform field
validation (no connection test); R4 offline basics + D10 address + required
starter catalogue; R5 admin PIN flow w/ resume; R6 skippable peripherals;
R7 progress + deferred features; R8 secrets-backed credential storage.
**Primary Happy Path** — 8-card selection → creds or offline setup → admin
PIN → peripherals → `completed` → Login.
**Critical Unhappy Paths** — field validation blocks; secrets write failure
stalls the transition (PG5); credentials stored but invalid only surface at
first platform call (C1).
**Important Edge Cases** — kill mid-wizard restarts from phase 1 but data
persisted per-phase; admin-PIN resume; starter offline catalogue is seeded
into the local catalogue (E4.3).
**Offline Behaviour** — First-class: `offline` is a full platform path with
store basics; app is fully usable without credentials.
**Lifecycle Behaviour** — `isLoading` null-render until KV read; completed
state survives restart; in-memory step data does not.
**State Ownership** — `isOnboarded`→KV; step data→screen state (lost on
kill); settings→secrets; progress→KV; admin→DB.
**Dependencies** — KV repo, secrets backend, `platformCapabilityService`,
`posConfig`, settings hooks, `useUsers`.
**Side Effects** — secrets write, posConfig write, users row, `setup.progress`,
capability platform set.
**Open Questions** — Q1 connection test; Q3 lowercase key.
**Potential Gaps** — PG3 no connection test; PG4 unstructured tax destination;
PG5 unhandled save failure; PG6 silent default payment provider.
(Former PG1 seeding gap and PG2 missing commercefull are resolved.)
**Contradictions** — C1 no connection test vs spec; C2 optional free-text
address vs required country; C3 unlocalized configuration step.
