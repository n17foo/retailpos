# Platform Clients, Credentials, Tokens & Tax — Rules

## PC-R1 — Tokens are device identity, never staff-gated

**Rule.** Platform credentials/tokens belong to the device: background sync
and multi-register peers reach the platform while the till is locked. Staff
login _warms_ the token (audit `auth:platform_token`) but never gates reads.

**Evidence.** spec `platform-tokens` Context; `TokenService`, auth doc.

🟢 **E1.1** — locked till + background sync → still reaches the platform.

🟠 **E1.2 — Staff logout ≠ token invalidation** — logging out a user does not
clear platform credentials (by design; is that the intended security model?
Q1).

## PC-R2 — Token fetch dedups concurrent refreshes and caches

**Rule.** `getPlatformToken`: valid cached → return; refresh already
in-flight → await the shared promise (`tokenRefreshPromises` keyed
`platform:type:refresh`); else `refreshTokenUsingProvider` → persist
`token:<platform>:<tokenType>` in the secrets backend + memory cache.

**Evidence.** `features/platform-clients/services/token/TokenService.ts:73-101,188`.

🟢 **E2.1** — 5 parallel calls needing a refreshed token → one exchange
request, all await the same promise.

🔴 **E2.2 — Exchange fails** → the rejection propagates to all waiters;
next call retries fresh (promise evicted in `finally`-style delete — verify
error-path cleanup, PG1).

## PC-R3 — Credential resolution has a defined fallback order

**Rule.** Priority: (1) `config:ecommerceSettings` secret → mapped per
platform; (2) legacy `<platform>_api_credentials` secrets merged on top —
non-empty wins; (3) env vars (`MAGENTO_*`, `SYLIUS_*` providers only).

**Evidence.** `PlatformCredentialsResolver.ts`, spec.

🟠 **E3.1** — a legacy secret silently overrides a settings field — a stale
provisioned value can shadow an operator's edit (PG2).

## PC-R4 — Token lifetimes are per-platform

**Rule.** Each platform's `TokenProviderFunction` decides: Shopify = stored
access token (permanent, no expiry); others exchange credentials per their
auth model with platform-defined expiry.

**Evidence.** `features/platform-clients/services/token/TokenServiceFactory.ts`, spec table.

🟠 **E4.1** — a platform with no provider registered → token resolution
fails → its API calls can't authenticate (Q2).

## PC-R5 — Offline tax resolves profile → default → store

**Rule.** `resolveOfflineTaxRate(taxProfileId)`: product's profile → default
profile → store tax. Online platforms compute tax themselves (POS doesn't
replicate it — see checkout "tax comes from the platform").

**Evidence.** `features/platform-clients/services/tax/OfflineTaxResolver.ts:10-15`,
`TaxProfileService.ts`.

🟢 **E5.1** — line with profile "Reduced 8%" → 8% regardless of default.

🟠 **E5.2 — No profiles + no store address** — resolves `undefined` →
line items send no taxRate to the sync payload ("platform applies its own"
in OrderSyncService). For offline there's no platform → tax may be 0 (PG3).

## PC-R6 — `posConfig.values` is the runtime config surface

**Rule.** `POSConfigService` exposes typed values (sync retries, scan dedup
ms, sale modes, note chips, currency…) consumed across features; settings
write through `ServiceConfigBridge`.

**Evidence.** `features/platform-clients/services/config/{POSConfigService,ServiceConfigBridge}.ts`.

## ❓ Open Questions

- **Q1** — Confirm intended: staff logout never invalidates device tokens —
  is there a "disconnect platform" flow for de-provisioning a register?
- **Q2** — Per-platform provider registration coverage: which of the 8
  platforms lack a `TokenProviderFunction`, and what's their fallback?
- **Q3** — `ProtectedValueStore` `storageMode` per entry — who chooses
  secret-vs-KV per key, and can a key migrate modes?

## ⚠️ Potential Gaps

- **PG1** — Refresh-promise cleanup on rejection — a wedged entry would
  poison subsequent reads until restart.
- **PG2** — Legacy secret silently overrides settings edits (E3.1).
- **PG3** — Offline with no profiles/address → `undefined` tax → 0-tax sales
  with no warning.
- **PG4** — Token theft surface: tokens in safeStorage are device-readable —
  no attestation/pinning (LAN threat model documented in multi-register).
- **PG5** — `getAuthStrategy` resolves per request — a token rotating
  mid-request-sequence could mix credentials across retries.

## Test Coverage Mapping

| Example        | Coverage                                                       |
| -------------- | -------------------------------------------------------------- |
| PC-R3 resolver | `PlatformCredentialsResolver.test.ts`                          |
| PC-R2 factory  | `TokenServiceFactory.test.ts`                                  |
| PC-R6 config   | `POSConfigService.test.ts`, `EcommerceSettingsStorage.test.ts` |
| PC-R5 tax      | Not found                                                      |

## Feature Context Summary

**Feature**: Platform clients/credentials/tokens/tax
**Responsibility**: Per-platform API clients with per-request auth; merged
credential resolution; cached+deduped token lifecycle; offline tax
resolution chain; `posConfig.values` runtime config.

**Core rules**

- PC-R1 Tokens are device identity (never staff-gated).
- PC-R2 Cached tokens; single-flight refresh; secret-backed persistence.
- PC-R3 Resolution order: settings secret → legacy secret → env.
- PC-R4 Token lifetime per platform provider.
- PC-R5 Offline tax: product profile → default → store.
- PC-R6 `posConfig.values` is the config surface.

**Critical unhappy paths**: exchange failure propagates to all waiters;
legacy secret shadowing; missing provider → unauthenticated calls.

**Offline**: credentials/tokens persist in OS storage; offline tax fully
local; online platforms obviously need connectivity for the API itself.

**Gaps**: refresh-failure cleanup, shadowing, 0-tax silent path, mixed
credentials mid-retry.
