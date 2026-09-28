# ADR-016: Platform Token Lifecycle — Stored Credentials, Real Providers, Login Warm-Up

**Date**: 2026-09-28  
**Status**: Accepted  
**Deciders**: Engineering Team

## Context

Platform API clients need credentials to call Shopify, Commercefull, and the other online platforms. The original design stored credentials in the `config:ecommerceSettings` secret (via `ProtectedValueStore`), but the token layer had drifted: providers read `<platform>_api_credentials` secrets that nothing wrote, three providers returned fabricated `platform-<timestamp>` tokens, Commercefull had no provider at all, and acquired tokens lived only in client memory with no persistence or refresh. Separately, `withTokenRefresh` force-refreshed the stored token on a 401 but the retry reused the client's stale in-memory token, so retries failed again. Staff authentication (PIN, biometric, magstripe, …) had no relationship to platform token acquisition.

## Decision

- **Single credential source.** `PlatformCredentialsResolver.getPlatformCredentials(platform)` maps the stored `config:ecommerceSettings` blob into per-platform credentials. Legacy `<platform>_api_credentials` secrets are merged on top as an override for externally provisioned devices, but nothing in the app is required to write them.
- **Real token providers.** `TokenServiceFactory` registers a provider per online platform. Static-key platforms (Shopify, BigCommerce, Wix, WooCommerce, PrestaShop, Squarespace) return the stored credential directly — no fabricated tokens. Exchange platforms do a real call: Magento `fetchAdminToken`, Sylius `authentication-token` JWT, Commercefull `POST /business/auth/token`. Token-exchange calls use raw `fetch`, never the client's `request()` path, so acquisition can't recurse into `getAuthStrategy()`.
- **Request-time token resolution.** `BaseApiClient.getAuthStrategy()` may be async; the Shopify, Commercefull, Magento, and Sylius clients resolve `getPlatformToken()` on every request. Combined with an in-memory cache inside `TokenService`, a forced refresh in `withTokenRefresh` now reaches the retried request — the retry actually uses the new token.
- **Warm-up on staff login, not gating.** After a successful staff login, `RootNavigator.handleLogin` calls `warmUpPlatformToken()` (fire-and-forget) and records `auth:platform_token` in the audit log. The platform credential is a _device_ identity, not a staff identity — token reads are deliberately not gated on the staff session so background sync and multi-register peers keep working while the till is locked. The keystore cannot enforce staff-level gating anyway (keychain `AFTER_FIRST_UNLOCK`, Electron `safeStorage` has no per-item ACL).

## Consequences

Platform credentials only ever live in the OS-protected secrets backend; acquired tokens are persisted there too under `token:<platform>:<type>` and cached in memory. Refund services share the same resolver — the 8 dead `*_api_credentials` reads now work from configured settings. Adding a platform means adding a credentials mapping and (for exchange platforms) one provider. The trade-off accepted: warm-up on login improves perceived performance and auditability but is not a security boundary — anyone with code-level access to the app process can use the platform credential regardless of login state.
