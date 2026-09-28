# Secrets Service – EARS Requirements

> **System**: RetailPOS – Secure Credential Storage  
> **Actor**: System, Admin  
> **Date**: 2026-05-03  
> **Source**: `services/secrets/SecretsService.ts`, `services/secrets/SecretsServiceInterface.ts`, `services/secrets/KeychainSecretsService.ts`, `services/secrets/mock/MemorySecretsService.ts`

---

## Context

The secrets service provides secure storage for sensitive credentials (API keys, access tokens, passwords) using platform-native secure storage mechanisms. On iOS, it uses Keychain Services. On Android, it uses EncryptedSharedPreferences. In development/testing environments, it uses an in-memory mock service.

The service follows a factory pattern with automatic selection between real keychain storage and mock storage based on the `USE_MOCK_SECRETS` environment variable. All secrets are stored with service-specific identifiers to prevent collisions.

### Actors

| Actor  | Role                                                                                |
| ------ | ----------------------------------------------------------------------------------- |
| System | Stores and retrieves credentials for platform APIs, payment providers, and services |
| Admin  | Configures platform credentials during onboarding; updates credentials in settings  |

### Storage Backends

| Backend                    | Platform       | Description                                                                   | Status         |
| -------------------------- | -------------- | ----------------------------------------------------------------------------- | -------------- |
| Keychain Services          | iOS            | Native iOS secure storage using `react-native-keychain`                       | ✅ Implemented |
| EncryptedSharedPreferences | Android        | Native Android secure storage using `react-native-keychain`                   | ✅ Implemented |
| Electron `safeStorage`     | Desktop        | OS-encrypted secrets via main-process IPC; only ciphertext is persisted       | ✅ Implemented |
| Browser                    | Web            | Plaintext only when `ALLOW_PLAINTEXT_SECRET_FALLBACK=true` (dev escape hatch) | ✅ Implemented |
| Memory (Mock)              | All (dev/test) | In-memory storage for Expo Go and testing, requires `USE_MOCK_SECRETS=true`   | ✅ Implemented |

### Secret Keys

The system defines a comprehensive enum of secret keys for all supported platforms and services:

| Category                 | Examples                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Payment Providers        | `STRIPE_PUBLISHABLE_KEY`, `STRIPE_API_KEY`, `SQUARE_APPLICATION_ID`, `ADYEN_API_KEY`, `TAP_PAYMENTS_API_KEY` |
| E-commerce (Shopify)     | `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_STORE_URL`                                                 |
| E-commerce (WooCommerce) | `WOOCOMMERCE_CONSUMER_KEY`, `WOOCOMMERCE_CONSUMER_SECRET`, `WOOCOMMERCE_STORE_URL`                           |
| E-commerce (Magento)     | `MAGENTO_ACCESS_TOKEN`, `MAGENTO_STORE_URL`, `MAGENTO_API_VERSION`                                           |
| E-commerce (BigCommerce) | `BIGCOMMERCE_CLIENT_ID`, `BIGCOMMERCE_ACCESS_TOKEN`, `BIGCOMMERCE_STORE_HASH`                                |
| E-commerce (Others)      | Sylius, Wix, PrestaShop, Squarespace, Commercefull                                                           |

### Key Defaults

| Field                  | Default                                          | Source                                      |
| ---------------------- | ------------------------------------------------ | ------------------------------------------- |
| Service identifier     | Secret key name                                  | `KeychainSecretsService.storeSecret`        |
| Keychain accessibility | `AccessibleAfterFirstUnlockThisDeviceOnly`       | `KeychainSecretsService.keychainOptions`    |
| Keychain access group  | None — secrets are never shared with other apps  | `KeychainSecretsService.keychainOptions`    |
| Mock service enabled   | `USE_MOCK_SECRETS === 'true'` env var            | `SecretsServiceFactory` constructor         |
| Initialization check   | Expo Go detection                                | `KeychainSecretsService.initializeKeychain` |
| Plaintext KV fallback  | Forbidden on production iOS/Android and Electron | `ProtectedValueStore`, `TokenService`       |

---

## 1. Ubiquitous Requirements

**1.1** The system shall maintain a singleton instance of `SecretsServiceFactory` exported as `secretsServiceFactory`.

**1.2** The system shall use `LoggerFactory` to create a child logger named `'SecretsServiceFactory'` or `'KeychainSecretsService'` for all log messages.

**1.3** The system shall select between `KeychainSecretsService` and `MemorySecretsService` based on the `USE_MOCK_SECRETS` environment variable.

**1.4** The system shall store each secret with a service-specific identifier to prevent key collisions across different secrets.

**1.5** The system shall use platform-native secure storage (Keychain on iOS, EncryptedSharedPreferences on Android) when `USE_MOCK_SECRETS` is `false`.

**1.6** The system shall use in-memory storage when `USE_MOCK_SECRETS` is `true` or when running in Expo Go.

**1.7** The system shall never log secret values — only log success/failure and key names.

**1.8** The system shall return `null` for missing secrets rather than throwing errors.

---

## 2. Event-Driven Requirements

### 2.1 Factory Initialization

**2.1.1** When `SecretsServiceFactory` is constructed, the system shall create a logger with name `'SecretsServiceFactory'`.

**2.1.2** When the factory is constructed, the system shall log the value of `USE_MOCK_SECRETS` at debug level.

**2.1.3** When `USE_MOCK_SECRETS` is `true`, the system shall call `MemorySecretsService.getInstance()` and assign it to `currentService`.

**2.1.4** When `USE_MOCK_SECRETS` is `true`, the system shall log `'Using MemorySecretsService (mock)'` at debug level.

**2.1.5** When `USE_MOCK_SECRETS` is `false`, the system shall call `KeychainSecretsService.getInstance()` and assign it to `currentService`.

**2.1.6** When `USE_MOCK_SECRETS` is `false`, the system shall log `'Using KeychainSecretsService'` at debug level.

### 2.2 Get Factory Instance

**2.2.1** When `SecretsServiceFactory.getInstance()` is called for the first time, the system shall create a new `SecretsServiceFactory` instance.

**2.2.2** When the factory is created, the system shall store it in `SecretsServiceFactory.instance`.

**2.2.3** When `getInstance()` is called on subsequent calls, the system shall return the existing factory instance.

### 2.3 Get Service

**2.3.1** When `getService()` is called on the factory, the system shall return `currentService` without modification.

### 2.4 Keychain Service Initialization

**2.4.1** When `KeychainSecretsService` is constructed, the system shall call `initializeKeychain()` to load the native module.

**2.4.2** When `initializeKeychain()` is called, the system shall check if `process.env.EXPO_RUNTIME === 'expo'` or `global.__expo !== undefined`.

**2.4.3** When running in Expo Go, the system shall log `'Running in Expo Go - not loading native keychain module'` and set `initialized` to `false`.

**2.4.4** When not running in Expo Go, the system shall call `require('react-native-keychain')` to load the native module.

**2.4.5** When the module loads successfully, the system shall assign it to `this.keychain`, set `initialized` to `true`, and log `'Successfully initialized React Native Keychain'`.

**2.4.6** When the module fails to load, the system shall catch the error, log an error message, and set `initialized` to `false`.

### 2.5 Store Secret

**2.5.1** When `storeSecret(key, value)` is called on `KeychainSecretsService` and `initialized` is `false`, the system shall log an error message `'Cannot store secret: Keychain not initialized'` and return `false`.

**2.5.2** When `storeSecret()` is called and `initialized` is `true`, the system shall call `this.keychain.setGenericPassword(key, value, options)`.

**2.5.3** When `setGenericPassword()` is called, the system shall pass `{ service: key, accessible: ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }` as options.

**2.5.4** The system shall not pass an `accessGroup` on any platform — secrets are never shared with other apps or app groups.

**2.5.5** The `THIS_DEVICE_ONLY` accessibility variant shall be used so secrets never migrate through backups or to other devices.

**2.5.6** When `setGenericPassword()` resolves successfully, the system shall return `true`.

**2.5.7** When `setGenericPassword()` throws an error, the system shall catch it, log an error message, and return `false`.

### 2.6 Store Secrets (Batch)

**2.6.1** When `storeSecrets(secrets)` is called on `KeychainSecretsService` and `initialized` is `false`, the system shall log an error message `'Cannot store secrets: Keychain not initialized'` and return immediately.

**2.6.2** When `storeSecrets()` is called and `initialized` is `true`, the system shall log a debug message with the number of secrets being stored.

**2.6.3** When the debug message is logged, the system shall call `Object.entries(secrets)` to get key-value pairs.

**2.6.4** When entries are retrieved, the system shall map each entry to `this.storeSecret(key, value)` to create an array of promises.

**2.6.5** When promises are created, the system shall call `Promise.all(promises)` to store all secrets in parallel.

**2.6.6** When `Promise.all()` resolves, the system shall return without throwing.

**2.6.7** When `Promise.all()` rejects, the system shall catch the error, log an error message, and return without throwing.

### 2.7 Get Secret

**2.7.1** When `getSecret(key)` is called on `KeychainSecretsService` and `initialized` is `false`, the system shall log an error message `'Cannot get secret: Keychain not initialized'` and return `null`.

**2.7.2** When `getSecret()` is called and `initialized` is `true`, the system shall call `this.keychain.getGenericPassword({ service: key })` — retrieval options carry no `accessGroup`.

**2.7.5** When `getGenericPassword()` returns credentials, the system shall return `credentials.password`.

**2.7.6** When `getGenericPassword()` returns `false` or `null`, the system shall return `null`.

**2.7.7** When `getGenericPassword()` throws an error, the system shall catch it, log an error message, and return `null`.

### 2.8 Delete Secret

**2.8.1** When `deleteSecret(key)` is called on `KeychainSecretsService` and `initialized` is `false`, the system shall log an error message `'Cannot delete secret: Keychain not initialized'` and return `false`.

**2.8.2** When `deleteSecret()` is called and `initialized` is `true`, the system shall call `this.keychain.resetGenericPassword({ service: key })`.

**2.8.5** When `resetGenericPassword()` resolves successfully, the system shall return `true`.

**2.8.6** When `resetGenericPassword()` throws an error, the system shall catch it, log an error message, and return `false`.

### 2.9 Has Secret

**2.9.1** When `hasSecret(key)` is called, the system shall call `this.getSecret(key)` to retrieve the secret value.

**2.9.2** When `getSecret()` returns a non-null value, the system shall return `true`.

**2.9.3** When `getSecret()` returns `null`, the system shall return `false`.

### 2.10 Memory Service Operations

**2.10.1** When any method is called on `MemorySecretsService`, the system shall use an in-memory `Map<string, string>` to store secrets.

**2.10.2** When `storeSecret(key, value)` is called on `MemorySecretsService`, the system shall call `this.secrets.set(key, value)` and return `true`.

**2.10.3** When `getSecret(key)` is called on `MemorySecretsService`, the system shall call `this.secrets.get(key)` and return the value or `null` if not found.

**2.10.4** When `deleteSecret(key)` is called on `MemorySecretsService`, the system shall call `this.secrets.delete(key)` and return `true`.

**2.10.5** When `hasSecret(key)` is called on `MemorySecretsService`, the system shall call `this.secrets.has(key)` and return the result.

---

## 3. State-Driven Requirements

**3.1** While `USE_MOCK_SECRETS === 'true'` (exact match — any other populated value is ignored), the system shall use `MemorySecretsService` for all secret operations.

**3.2** While `USE_MOCK_SECRETS` is not `'true'`, the system shall select the runtime backend: `ElectronSecretsService` under Electron, `BrowserSecretsService` on web, and `KeychainSecretsService` on native mobile (outside Expo Go).

**3.3** While running in Expo Go, the system shall not attempt to load the native keychain module and shall set `initialized` to `false`.

**3.4** While `KeychainSecretsService.initialized` is `false`, all secret operations shall log an error and return failure values (`false` or `null`).

**3.5** While `KeychainSecretsService.initialized` is `true`, the system shall use the native keychain module for all secret operations.

**3.6** While `KeychainSecretsService` is active, all keychain operations shall use `ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` for storage and no `accessGroup` — secrets are device-bound and never shared.

**3.7** While running on Electron, the system shall use `ElectronSecretsService` (main-process `safeStorage` via IPC, ciphertext-only persistence). While running in a browser without the explicit `ALLOW_PLAINTEXT_SECRET_FALLBACK` opt-in, plaintext persistence shall be refused.

---

## 4. Optional Feature Requirements

**4.1** Where keychain sharing is ever required in the future, an `accessGroup` matching the app's bundle identifier must be declared in the iOS entitlements — the app currently configures none, and secrets are intentionally device-only.

**4.2** Where a secret key is defined in `SecretKeys` enum, the system shall use the enum value as the service identifier.

**4.3** Where `storeSecrets()` is called with multiple secrets, the system shall store them in parallel using `Promise.all()`.

---

## 5. Unwanted Behaviour / Edge Cases

### 5.1 Uninitialized Keychain

**5.1.1** If `storeSecret()` is called when `initialized` is `false`, then the system shall log an error and return `false` without attempting to store.

**5.1.2** If `getSecret()` is called when `initialized` is `false`, then the system shall log an error and return `null` without attempting to retrieve.

**5.1.3** If `deleteSecret()` is called when `initialized` is `false`, then the system shall log an error and return `false` without attempting to delete.

### 5.2 Expo Go Detection

**5.2.1** If the app is running in Expo Go, then `initializeKeychain()` shall detect it via `process.env.EXPO_RUNTIME` or `global.__expo` and skip native module loading.

**5.2.2** If native module loading is skipped, then `initialized` shall be set to `false` and all secret operations shall fail gracefully.

### 5.3 Native Module Load Failure

**5.3.1** If `require('react-native-keychain')` throws an error, then the system shall catch it, log an error message, set `initialized` to `false`, and continue — the app does not crash.

### 5.4 Keychain Operation Failure

**5.4.1** If `setGenericPassword()` throws an error (e.g. keychain locked, permission denied), then the system shall catch it, log an error message, and return `false`.

**5.4.2** If `getGenericPassword()` throws an error, then the system shall catch it, log an error message, and return `null`.

**5.4.3** If `resetGenericPassword()` throws an error, then the system shall catch it, log an error message, and return `false`.

### 5.5 Missing Secret

**5.5.1** If `getSecret()` is called for a key that does not exist, then the system shall return `null` without throwing an error.

**5.5.2** If `hasSecret()` is called for a key that does not exist, then the system shall return `false`.

### 5.6 Batch Store Failure

**5.6.1** If `storeSecrets()` is called and one or more `storeSecret()` calls fail, then `Promise.all()` shall reject — the system catches the error, logs it, and returns without throwing.

**5.6.2** If `storeSecrets()` is called when `initialized` is `false`, then the system shall log an error and return immediately without attempting to store any secrets.

### 5.7 Memory Service Persistence

**5.7.1** If the app is restarted while using `MemorySecretsService`, then all secrets shall be lost — memory storage is not persistent.

---

## 6. Complex Requirements

**6.1** When `storeSecret()` is called on `KeychainSecretsService`, the system shall check initialization, build the keychain options (`service` + `THIS_DEVICE_ONLY` accessibility, no `accessGroup`), call `setGenericPassword()`, catch any errors, log the result, and return success/failure — the caller never sees exceptions.

**6.2** When `getSecret()` is called on `KeychainSecretsService`, the system shall check initialization, call `getGenericPassword({ service: key })`, extract the password from credentials, catch any errors, log the result, and return the value or `null` — the caller never sees exceptions.

**6.3** When `storeSecrets()` is called, the system shall check initialization, log the batch size, create an array of `storeSecret()` promises, execute them in parallel with `Promise.all()`, catch any errors, log the result, and return without throwing — partial failures are logged but do not propagate.

**6.4** When `initializeKeychain()` is called, the system shall detect Expo Go, skip native module loading if detected, attempt to load `react-native-keychain` if not in Expo Go, catch any load errors, set `initialized` accordingly, and log the result — initialization failure is non-fatal.

**6.5** When the factory is constructed, the system shall check `USE_MOCK_SECRETS`, create the appropriate service instance (`MemorySecretsService` or `KeychainSecretsService`), log the selection, and store it in `currentService` — the service is selected once at factory creation and never changes.

---

## 7. Secrets Service Lifecycle Summary

### Factory Initialization Flow

```
App startup
  → SecretsServiceFactory constructor
    → logger = LoggerFactory.getInstance().createLogger('SecretsServiceFactory')
    → logger.debug('USE_MOCK_SECRETS', USE_MOCK_SECRETS)
    → If USE_MOCK_SECRETS === true:
      → currentService = MemorySecretsService.getInstance()
      → logger.debug('Using MemorySecretsService (mock)')
    → Else:
      → currentService = KeychainSecretsService.getInstance()
      → logger.debug('Using KeychainSecretsService')
```

### Keychain Service Initialization Flow

```
KeychainSecretsService.getInstance()
  → If instance exists: return instance
  → Else:
    → new KeychainSecretsService()
      → initializeKeychain()
        → Check if Expo Go (process.env.EXPO_RUNTIME === 'expo' || global.__expo !== undefined)
          → If Expo Go:
            → logger.info('Running in Expo Go - not loading native keychain module')
            → initialized = false
            → return
          → Else:
            → Try:
              → this.keychain = require('react-native-keychain')
              → initialized = true
              → logger.info('Successfully initialized React Native Keychain')
            → Catch error:
              → logger.error('Failed to initialize React Native Keychain', error)
              → initialized = false
```

### Store Secret Flow

```
Admin configures Shopify API key
  → secretsService.storeSecret('SHOPIFY_API_KEY', 'sk_live_...')
    → If !initialized: log error, return false
    → options = {
        service: 'SHOPIFY_API_KEY',
        accessible: ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY  // no accessGroup
      }
    → Try:
      → await this.keychain.setGenericPassword('SHOPIFY_API_KEY', 'sk_live_...', options)
      → return true
    → Catch error:
      → logger.error('Error storing secret', error)
      → return false
```

### Get Secret Flow

```
System retrieves Shopify API key
  → secretsService.getSecret('SHOPIFY_API_KEY')
    → If !initialized: log error, return null
    → options = { service: 'SHOPIFY_API_KEY' }  // no accessGroup
    → Try:
      → credentials = await this.keychain.getGenericPassword(options)
      → If credentials: return credentials.password
      → Else: return null
    → Catch error:
      → logger.error('Error retrieving secret', error)
      → return null
```

### Store Secrets Batch Flow

```
Onboarding stores multiple Shopify credentials
  → secretsService.storeSecrets({
      SHOPIFY_API_KEY: 'sk_live_...',
      SHOPIFY_API_SECRET: 'sk_secret_...',
      SHOPIFY_STORE_URL: 'mystore.myshopify.com'
    })
    → If !initialized: log error, return
    → logger.debug('Storing 3 secrets in batch')
    → promises = [
        storeSecret('SHOPIFY_API_KEY', 'sk_live_...'),
        storeSecret('SHOPIFY_API_SECRET', 'sk_secret_...'),
        storeSecret('SHOPIFY_STORE_URL', 'mystore.myshopify.com')
      ]
    → Try:
      → await Promise.all(promises)
    → Catch error:
      → logger.error('Error storing secrets batch', error)
```

### Delete Secret Flow

```
Admin removes Shopify integration
  → secretsService.deleteSecret('SHOPIFY_API_KEY')
    → If !initialized: log error, return false
    → options = { service: 'SHOPIFY_API_KEY' }  // no accessGroup
    → Try:
      → await this.keychain.resetGenericPassword(options)
      → return true
    → Catch error:
      → logger.error('Error deleting secret', error)
      → return false
```

### Has Secret Flow

```
System checks if Shopify API key exists
  → secretsService.hasSecret('SHOPIFY_API_KEY')
    → value = await this.getSecret('SHOPIFY_API_KEY')
    → return value !== null
```

### Memory Service Flow (Mock)

```
Development/testing with USE_MOCK_SECRETS=true
  → secretsService.storeSecret('TEST_KEY', 'test_value')
    → this.secrets.set('TEST_KEY', 'test_value')
    → return true
  → secretsService.getSecret('TEST_KEY')
    → return this.secrets.get('TEST_KEY') || null
  → secretsService.deleteSecret('TEST_KEY')
    → this.secrets.delete('TEST_KEY')
    → return true
  → secretsService.hasSecret('TEST_KEY')
    → return this.secrets.has('TEST_KEY')
```

---

## 8. Component Traceability

| Requirement (summary)                    | Component / Hook / Service                         | Source File                                     |
| ---------------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| Singleton factory instance               | `SecretsServiceFactory.getInstance`                | `services/secrets/SecretsService.ts`            |
| Factory selects service based on env var | `SecretsServiceFactory` constructor                | `services/secrets/SecretsService.ts`            |
| Factory returns service                  | `SecretsServiceFactory.getService`                 | `services/secrets/SecretsService.ts`            |
| Keychain service singleton               | `KeychainSecretsService.getInstance`               | `services/secrets/KeychainSecretsService.ts`    |
| Keychain initialized                     | `KeychainSecretsService.initializeKeychain`        | `services/secrets/KeychainSecretsService.ts`    |
| Expo Go detected                         | `process.env.EXPO_RUNTIME` / `global.__expo` check | `services/secrets/KeychainSecretsService.ts`    |
| Native module loaded                     | `require('react-native-keychain')`                 | `services/secrets/KeychainSecretsService.ts`    |
| Secret stored                            | `KeychainSecretsService.storeSecret`               | `services/secrets/KeychainSecretsService.ts`    |
| Secrets stored in batch                  | `KeychainSecretsService.storeSecrets`              | `services/secrets/KeychainSecretsService.ts`    |
| Secret retrieved                         | `KeychainSecretsService.getSecret`                 | `services/secrets/KeychainSecretsService.ts`    |
| Secret deleted                           | `KeychainSecretsService.deleteSecret`              | `services/secrets/KeychainSecretsService.ts`    |
| Secret existence checked                 | `KeychainSecretsService.hasSecret`                 | `services/secrets/KeychainSecretsService.ts`    |
| Keychain password set                    | `this.keychain.setGenericPassword`                 | `react-native-keychain` (native module)         |
| Keychain password retrieved              | `this.keychain.getGenericPassword`                 | `react-native-keychain` (native module)         |
| Keychain password reset                  | `this.keychain.resetGenericPassword`               | `react-native-keychain` (native module)         |
| Platform detected                        | `Platform.OS`                                      | `react-native` (core module)                    |
| Memory service singleton                 | `MemorySecretsService.getInstance`                 | `services/secrets/mock/MemorySecretsService.ts` |
| Memory secret stored                     | `MemorySecretsService.storeSecret`                 | `services/secrets/mock/MemorySecretsService.ts` |
| Memory secret retrieved                  | `MemorySecretsService.getSecret`                   | `services/secrets/mock/MemorySecretsService.ts` |
| Memory secret deleted                    | `MemorySecretsService.deleteSecret`                | `services/secrets/mock/MemorySecretsService.ts` |
| Memory secret existence checked          | `MemorySecretsService.hasSecret`                   | `services/secrets/mock/MemorySecretsService.ts` |
| Secret keys enum defined                 | `SecretKeys` enum                                  | `services/secrets/SecretsServiceInterface.ts`   |
| Logger created                           | `LoggerFactory.getInstance().createLogger`         | `services/logger/LoggerFactory.ts`              |

---

**Document Metadata**:

- **Author**: Kiro AI Agent
- **Date**: 2026-05-03
- **Version**: 1.0
- **Status**: Final
- **Related**: `docs/specs/onboarding/wizard.md`, `docs/specs/settings/settings-tabs.md`
