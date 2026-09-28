# Platform Credentials & Token Lifecycle – EARS Requirements

> **System**: RetailPOS – E-commerce Platform Authentication  
> **Actor**: Staff (any auth method), Service layer, Background sync  
> **Date**: 2026-09-28  
> **Source**: `services/config/PlatformCredentialsResolver.ts`, `services/token/TokenService.ts`, `services/token/TokenServiceFactory.ts`, `services/token/TokenInitializer.ts`, `services/token/TokenUtils.ts`, `services/clients/BaseApiClient.ts`, `services/clients/{shopify,commercefull,magento,sylius}/`, `navigation/RootNavigator.tsx`, `services/refunds/platforms/`

---

## Context

Online platforms (Shopify, WooCommerce, Magento, BigCommerce, Sylius, Wix, PrestaShop, Squarespace, Commercefull) require API credentials to serve catalog, order, inventory, customer, and refund operations. Credentials are entered once in Settings → E-commerce and stored as a single `config:ecommerceSettings` secret in the OS-protected secrets backend (Keychain / Electron `safeStorage`) via `ProtectedValueStore`.

The token layer sits on top: `TokenServiceFactory` registers a per-platform `TokenProviderFunction` that knows how to produce a token from the stored credentials — either by returning a long-lived key directly or by exchanging credentials at the platform's auth endpoint. `TokenService` persists acquired tokens under `token:<platform>:<tokenType>` in the secrets backend, keeps an in-memory cache, and deduplicates concurrent refreshes. API clients resolve the current token per request through `getPlatformToken()` inside `getAuthStrategy()`, so refreshed tokens propagate without client re-initialisation.

Staff authentication and platform tokens are deliberately decoupled: the platform credential is a device identity, not a staff identity. A successful staff login _warms up_ the token (audit-logged as `auth:platform_token`) so the first platform call is fast, but token reads are never gated on the session — `BackgroundSyncService` and multi-register peers must reach the platform while the till is locked.

### Credential resolution order

| Priority | Source                                                                  | Mechanism                                                |
| -------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| 1        | `config:ecommerceSettings` secret (Settings → E-commerce)               | `EcommerceSettingsStorage.load` → mapped per platform    |
| 2        | Legacy `<platform>_api_credentials` secret (external provisioning only) | Merged on top of settings values — non-empty strings win |
| 3        | Environment variables (Magento, Sylius exchanges only)                  | `MAGENTO_*`, `SYLIUS_*` fallbacks inside the providers   |

### Per-platform provider behaviour

| Platform     | Token source                                                                                         | Expiry             |
| ------------ | ---------------------------------------------------------------------------------------------------- | ------------------ |
| Shopify      | Stored `accessToken` (or `apiKey`) — permanent Admin API token                                       | None               |
| WooCommerce  | Stored `apiKey` (consumer key)                                                                       | None               |
| BigCommerce  | Stored `accessToken` (`X-Auth-Token`)                                                                | None               |
| Wix          | Stored `apiKey`                                                                                      | None               |
| PrestaShop   | Stored `apiKey`                                                                                      | None               |
| Squarespace  | Stored `apiKey`                                                                                      | None               |
| Magento      | Stored `accessToken`; else username/password → `integration/admin/token`                             | 1 h (24 h refresh) |
| Sylius       | Stored `apiToken`; else `SYLIUS_ACCESS_TOKEN`; else email/password → `shop/authentication-token` JWT | 1 h                |
| Commercefull | `apiKey`/`apiSecret` → `POST {storeUrl}/business/auth/token`; lone `apiKey` is a static token        | `expiresIn` or 1 h |
| Offline      | No provider registered                                                                               | n/a                |

---

## 1. Ubiquitous Requirements

**1.1** The system shall resolve platform credentials from the `config:ecommerceSettings` secret via `getPlatformCredentials(platform)`.

**1.2** When resolving credentials, the system shall merge values from the legacy `<platform>_api_credentials` secret on top of stored settings, ignoring absent or empty values.

**1.3** The system shall return `null` from `getPlatformCredentials` when no usable value exists, and shall not propagate storage-layer errors.

**1.4** The system shall never return fabricated token values — a provider shall either return a real stored credential, a token acquired from the platform, or throw.

**1.5** Token-exchange HTTP calls (Magento admin token, Sylius JWT, Commercefull auth token) shall use raw `fetch` and shall not route through `BaseApiClient.request()`, so token acquisition can never re-enter `getAuthStrategy()`.

**1.6** The system shall persist tokens in the secrets backend under `token:<platform>:<tokenType>` and shall use the plaintext key-value store only when `allowsPlaintextFallback()` permits it.

**1.7** The system shall maintain an in-memory `TokenInfo` cache consistent with persistent storage — populated on store and read, evicted on clear.

**1.8** The system shall deduplicate concurrent token refreshes per `platform:tokenType` via `tokenRefreshPromises`.

**1.9** The system shall treat a token without `expiresAt` as non-expiring.

**1.10** The system shall register no token provider for the `offline` platform.

**1.11** The system shall never log token or credential values — only key names and outcomes.

**1.12** Token reads shall not be gated on staff authentication state; the platform credential is a device identity shared by the register.

---

## 2. Event-Driven Requirements

### 2.1 Staff login warm-up

**2.1.1** When a staff member authenticates successfully by any method (PIN, biometric, password, magstripe, RFID/NFC), the system shall call `warmUpPlatformToken()` without blocking the login transition.

**2.1.2** When `warmUpPlatformToken` resolves a configured online platform, the system shall initialise that platform's provider and acquire an access token.

**2.1.3** When a warm-up attempt targets an online platform, the system shall record `auth:platform_token` in the audit log with the user ID, user name, and whether a token was acquired.

**2.1.4** When no platform is configured or the platform is `offline`, the system shall skip warm-up and write no audit entry.

### 2.2 Token acquisition

**2.2.1** When `getToken` is called and a valid, non-expiring token (or one expiring in more than 60 s) exists in cache or storage, the system shall return it without invoking the provider.

**2.2.2** When `getToken` is called and no valid token exists, the system shall invoke the registered provider, persist the result via `storeToken`, and update the in-memory cache.

**2.2.3** When `getToken` is called while a refresh for the same `platform:tokenType` is in flight, the system shall await the existing refresh promise rather than invoking the provider again.

**2.2.4** When a provider throws, the system shall log the failure and `getToken` shall return the previously stored token if still valid, otherwise `null`.

### 2.3 Request-time resolution and refresh

**2.3.1** When a token-capable API client (Shopify, Commercefull, Magento, Sylius) builds request headers, the system shall resolve the current token via `getPlatformToken`, falling back to the client's configured credential.

**2.3.2** When a `withTokenRefresh`-wrapped call fails with an authentication error, the system shall force-refresh the token and retry — and the retried request shall use the refreshed token.

**2.3.3** When `clearToken` or `clearPlatformTokens` is called, the system shall delete the token from the secrets backend, the key-value store, and the in-memory cache.

### 2.4 Refund services

**2.4.1** When a platform refund service initialises, the system shall resolve credentials via `getPlatformCredentials(platform)` and mark itself initialised only when credentials exist.

---

## 3. Unwanted-Behaviour Requirements

**3.1** If secure storage is unavailable and the plaintext fallback is forbidden, `storeToken` shall refuse to persist and return `false`; the acquired token remains usable in memory for the current session.

**3.2** If a token-exchange endpoint returns a non-OK status or a response missing the token, the provider shall throw and no token shall be stored.

**3.3** If `getPlatformToken` yields no token, clients shall fall back to their configured static credential (e.g. `config.accessToken`, `config.apiKey`) rather than failing the request outright.

**3.4** If the Commercefull provider is given `apiKey` + `apiSecret` + `storeUrl`, it shall call the auth endpoint; if only `apiKey` is present, it shall treat it as a pre-issued static token and shall not call the endpoint.

**3.5** If no credentials are configured for a platform, `getToken` shall return `null` and `hasValidToken` shall return `false`.

---

## 4. Optional-Feature Requirements

**4.1** Where `MAGENTO_USERNAME`/`MAGENTO_PASSWORD`/`MAGENTO_STORE_URL` are set and no Magento access token is configured, the system may exchange them for an admin token.

**4.2** Where `SYLIUS_ACCESS_TOKEN` is set, the Sylius provider may return it directly without calling the platform.

**4.3** Where `SYLIUS_EMAIL`/`SYLIUS_PASSWORD`/`SYLIUS_API_URL` (or a configured store URL) are available and no token is configured, the Sylius provider may exchange them for a shop JWT.

---

## 5. Flows

### Staff-login warm-up

```
Staff member authenticates (pin / biometric / magstripe / …)
  → RootNavigator.handleLogin(user)
  → setUser / setIsAuthenticated (UI unlocks immediately)
  → warmUpPlatformToken()                      (fire-and-forget)
    → EcommerceSettingsStorage.load → platform
    → getPlatformToken(platform, ACCESS)
      → TokenServiceFactory.initializePlatformProvider
      → TokenService.getToken → provider → storeToken
  → auditLogService.log('auth:platform_token', { userId, details })
```

### Lazy acquisition on first API call

```
Service calls client.get/post/…
  → buildHeaders → getAuthStrategy
    → getPlatformToken(platform)
      → memory cache hit? → return token
      → secrets/KV read → valid? → cache + return
      → provider → storeToken (secrets + cache) → return
  → request sent with fresh header
```

### 401 refresh

```
API call fails with 401 inside withTokenRefresh
  → getPlatformToken(platform, ACCESS, forceRefresh = true)
  → provider acquires new token → storeToken → cache updated
  → retry → getAuthStrategy resolves the new token
```

---

## 6. Component Traceability

| Requirement (summary)                | Component / Service                                                         | Source File                                                          |
| ------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Credential resolution from settings  | `getPlatformCredentials`                                                    | `services/config/PlatformCredentialsResolver.ts`                     |
| Legacy secret override merge         | `readLegacyCredentials`                                                     | `services/config/PlatformCredentialsResolver.ts`                     |
| Per-platform provider registration   | `TokenServiceFactory.initializePlatformProvider`                            | `services/token/TokenServiceFactory.ts`                              |
| Static-key providers (6 platforms)   | `registerStaticTokenProvider`                                               | `services/token/TokenServiceFactory.ts`                              |
| Magento token exchange               | `setupMagentoTokenProvider` → `MagentoApiClient.fetchAdminToken`            | `services/clients/magento/MagentoApiClient.ts`                       |
| Sylius JWT exchange                  | `setupSyliusTokenProvider` → `shop/authentication-token`                    | `services/token/TokenServiceFactory.ts`                              |
| Commercefull token exchange          | `setupCommercefullTokenProvider` → `CommercefullApiClient.fetchAccessToken` | `services/clients/commercefull/CommercefullApiClient.ts`             |
| Token persistence + plaintext policy | `TokenService.storeToken` / `getTokenFromStorage`                           | `services/token/TokenService.ts`                                     |
| In-memory token cache                | `TokenService.tokenCache`                                                   | `services/token/TokenService.ts`                                     |
| Refresh deduplication                | `TokenService.tokenRefreshPromises`                                         | `services/token/TokenService.ts`                                     |
| Lazy provider init                   | `TokenInitializer.initializePlatformToken`                                  | `services/token/TokenInitializer.ts`                                 |
| Login warm-up + audit                | `warmUpPlatformToken` → `RootNavigator.handleLogin`                         | `services/token/TokenUtils.ts`, `navigation/RootNavigator.tsx`       |
| Request-time token resolution        | `getAuthStrategy` (async)                                                   | `services/clients/BaseApiClient.ts` + platform clients               |
| 401 refresh + retry                  | `withTokenRefresh`                                                          | `services/token/TokenIntegration.ts`, `services/token/TokenUtils.ts` |
| Refund-service credential resolution | `get<Platform>Credentials` → `getPlatformCredentials`                       | `services/refunds/platforms/`                                        |
| Audit action                         | `'auth:platform_token'`                                                     | `services/audit/AuditLogService.ts`                                  |

---

**Document Metadata**:

- **Author**: Devin
- **Date**: 2026-09-28
- **Version**: 1.0
- **Status**: Final
- **Related**: `docs/specs/system/secrets.md`, `docs/specs/auth/login.md`, `docs/adr/ADR-016-platform-token-lifecycle.md`
