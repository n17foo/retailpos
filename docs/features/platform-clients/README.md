# Platform Clients, Credentials, Tokens & Tax

## Purpose

The plumbing that lets the POS talk to 8 ecommerce platforms: per-platform
API clients (`features/platform-clients/services/clients/*`), credential storage + resolution
(`features/platform-clients/services/config/*`), token acquisition/refresh (`features/platform-clients/services/token/*`), and
offline tax resolution (`features/platform-clients/services/tax/*`).

## Scope

### Included

- `BaseApiClient` + per-platform client packages (shopify, woocommerce,
  magento, bigcommerce, sylius, wix, prestashop, commercefull, instoreapi,
  stripe) — each provides `getAuthStrategy()` resolved per request.
- `ProtectedValueStore` — credentials stored either in the secrets backend or
  KV (per-entry `storageMode`).
- `EcommerceSettingsStorage` — the single `config:ecommerceSettings` secret
  entered in Settings → E-commerce.
- `PlatformCredentialsResolver` — merges settings vs legacy
  `<platform>_api_credentials` secrets.
- `TokenService`/`TokenServiceFactory`/`TokenInitializer` — per-platform
  `TokenProviderFunction`; cached tokens (`token:<platform>:<tokenType>`),
  deduplicated concurrent refresh, audit `auth:platform_token` on login
  warm-up.
- `POSConfigService` + `ServiceConfigBridge` — runtime `posConfig.values`.
- `StoreCurrency` — configured currency helpers.
- `OfflineTaxResolver` + `TaxProfileService` — offline tax resolution order:
  product profile → default profile → store tax.

### Excluded

- What features _do_ with the clients (catalog, orders, customers…) — each
  feature doc.
- The capability matrix itself — shared-libs `platform.md`.
- Onboarding credential capture — onboarding feature.

## Entry Points

- Any feature service → `OrderServiceFactory`/`ProductServiceFactory`/… →
  platform client → `BaseApiClient.request` → `getAuthStrategy()` →
  `tokenService.getPlatformToken()`.
- Staff login → token warm-up (unblocks fast first calls while the till is
  locked — tokens are _device_ identity, not staff).
- Offline checkout → `resolveOfflineTaxRate(taxProfileId)`.

## Feature Flow

```
Client request → getAuthStrategy()
   → getPlatformToken(platform, type)
      ├─ valid cached token → use it
      ├─ refresh in-flight → await the shared promise (dedup)
      └─ else refreshTokenUsingProvider → persist under token:<p>:<t>
   → sign request → platform API

Offline tax:
product.taxProfileId? → profile.rate
   else default profile → rate
   else store address tax (posConfig storeAddress)
```

## Implementation Map

| Layer        | Responsibility       | Implementation                                                                                                                                                                           |
| ------------ | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Services     | API clients          | `features/platform-clients/services/clients/*`                                                                                                                                           |
| Services     | Config + credentials | `features/platform-clients/services/config/{EcommerceSettingsStorage,PlatformCredentialsResolver,ProtectedValueStore,POSConfigService,ServiceConfigBridge,StoreCurrency,apiVersions}.ts` |
| Services     | Tokens               | `features/platform-clients/services/token/{TokenService,TokenServiceFactory,TokenInitializer,TokenIntegration}.ts`                                                                       |
| Services     | Tax                  | `features/platform-clients/services/tax/{OfflineTaxResolver,TaxProfileService}.ts`                                                                                                       |
| Services     | Capability runtime   | `features/platform-clients/services/platform/PlatformCapabilityService.ts`                                                                                                               |
| Repositories | Tax profiles         | `features/platform-clients/repositories/TaxProfileRepository.ts`                                                                                                                         |
| Secrets      | Credential storage   | `shared/services/secrets/*` (see system-infra)                                                                                                                                           |

## State Ownership

| State                | Owner                                          | Persistence                              | Reset condition |
| -------------------- | ---------------------------------------------- | ---------------------------------------- | --------------- |
| Platform credentials | `EcommerceSettingsStorage`/ProtectedValueStore | Secrets backend or KV                    | User edit       |
| Tokens               | `TokenService`                                 | secrets (`token:<p>:<t>`) + memory cache | Expiry/refresh  |
| Tax profiles         | `TaxProfileRepository`                         | SQLite                                   | User edit       |
| `posConfig.values`   | `POSConfigService`                             | Settings                                 | User edit       |

## Dependencies

- `shared/services/secrets/*` — credential/token backends.
- `shared/services/audit` — `auth:platform_token` warm-up event.
- `shared/utils/platforms.ts`, `platformCapabilities.ts` — platform identity.
- Store address (onboarding-captured) — offline tax destination.

## Side Effects

- Token exchange calls to platform auth endpoints (network).
- Token + credential writes into OS-secured storage — never logged.
- Tax profiles mutate local SQLite; resolution reads per sale line.
