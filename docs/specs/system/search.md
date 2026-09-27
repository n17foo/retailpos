# Search Service – EARS Requirements

> **System**: RetailPOS – Product Search Management  
> **Actor**: Cashier, System  
> **Date**: 2026-05-03  
> **Source**: `services/search/SearchServiceFactory.ts`, `services/search/SearchServiceInterface.ts`, `services/search/platforms/CompositeSearchService.ts`, `services/search/platforms/PlatformSearchServiceInterface.ts`

---

## Context

The search service provides unified product search across local inventory and multiple e-commerce platforms. It uses a composite pattern to aggregate results from platform-specific search implementations (Shopify, WooCommerce, BigCommerce, Magento, Sylius, Wix, Commercefull) and presents them in a unified format.

The service supports text search, barcode search, category filtering, and maintains a session-based search history. All platform services are initialized lazily and failures are isolated — one platform's search failure does not affect others.

### Actors

| Actor   | Role                                                                                   |
| ------- | -------------------------------------------------------------------------------------- |
| Cashier | Searches for products by name, SKU, or barcode; views search results; selects products |
| System  | Aggregates results from multiple platforms; maintains search history; handles failures |

### Search Fields

| Field     | Description                                           |
| --------- | ----------------------------------------------------- |
| `name`    | Search product names (default)                        |
| `sku`     | Search product SKUs                                   |
| `barcode` | Search product barcodes (EAN13, UPC-A, Code128, etc.) |
| `all`     | Search across all fields                              |

### Platform Services

| Platform     | Service Class                     | Status         |
| ------------ | --------------------------------- | -------------- |
| Shopify      | `ShopifySearchService`            | ✅ Implemented |
| WooCommerce  | `WooCommerceSearchService`        | ✅ Implemented |
| BigCommerce  | `BigCommerceSearchService`        | ✅ Implemented |
| Magento      | `MagentoSearchService`            | ✅ Implemented |
| Sylius       | `SyliusSearchService`             | ✅ Implemented |
| Wix          | `WixSearchService`                | ✅ Implemented |
| Commercefull | `CommercefullSearchService`       | ✅ Implemented |
| PrestaShop   | `OfflineSearchService` (fallback) | ✅ Implemented |
| Squarespace  | `OfflineSearchService` (fallback) | ✅ Implemented |
| Offline      | `OfflineSearchService`            | ✅ Implemented |

### Key Defaults

| Field                | Default             | Source                                     |
| -------------------- | ------------------- | ------------------------------------------ |
| Search history limit | 10                  | `CompositeSearchService.MAX_HISTORY_ITEMS` |
| Default limit        | (platform-specific) | `SearchOptions.limit`                      |
| Default page         | 1                   | `SearchOptions.page`                       |
| Include e-commerce   | `true`              | `SearchOptions.includeEcommerce`           |
| Include local        | `true`              | `SearchOptions.includeLocal`               |
| Search field         | `'all'`             | `SearchOptions.searchField`                |

---

## 1. Ubiquitous Requirements

**1.1** The system shall maintain a singleton instance of `SearchServiceFactory` exported as `SearchServiceFactory.getInstance()`.

**1.2** The system shall use `LoggerFactory` to create a child logger named `'CompositeSearchService'` for all log messages.

**1.3** The system shall aggregate results from all initialized platform services without blocking on failures.

**1.4** The system shall maintain a session-based search history limited to the 10 most recent unique queries.

**1.5** The system shall deduplicate search history entries — the same query is not added twice.

**1.6** The system shall extract unique categories from all search results and return them in the `categories` array.

**1.7** The system shall return empty results (`totalResults: 0`, `localResults: []`, `ecommerceResults: []`) when no platform services are initialized.

**1.8** The system shall never throw errors from individual platform search failures — failures are logged and ignored.

---

## 2. Event-Driven Requirements

### 2.1 Factory Initialization

**2.1.1** When `SearchServiceFactory.getInstance()` is called for the first time, the system shall create a new `SearchServiceFactory` instance.

**2.1.2** When the factory is created, the system shall call `createPlatformServices()` to build platform-specific search services based on environment variables.

**2.1.3** When platform services are created, the system shall create a `CompositeSearchService` with the platform services array.

**2.1.4** When the composite service is created, the system shall call `service.initialize()` to initialize all platform services.

**2.1.5** When `getInstance()` is called on subsequent calls, the system shall return the existing factory instance without re-initialization.

### 2.2 Get Service

**2.2.1** When `getService()` is called and `this.service` is `null`, the system shall call `createPlatformServices()` to create platform services.

**2.2.2** When platform services are created, the system shall create a new `CompositeSearchService` with the services array.

**2.2.3** When the composite service is created, the system shall call `service.initialize()` to initialize it.

**2.2.4** When initialization completes, the system shall store the service in `this.service`.

**2.2.5** When `getService()` is called and `this.service` is not `null`, the system shall return the existing service instance.

### 2.3 Configure Service

**2.3.1** When `configureService(platformConfigs)` is called, the system shall iterate over the provided platform configurations.

**2.3.2** When a Shopify config is provided, the system shall create a new `ShopifySearchService` with the config and add it to the platform services array.

**2.3.3** When a BigCommerce config is provided, the system shall create a new `BigCommerceSearchService` with the config and add it to the platform services array.

**2.3.4** When a WooCommerce config is provided, the system shall create a new `WooCommerceSearchService` with the config and add it to the platform services array.

**2.3.5** When a Wix config is provided, the system shall create a new `WixSearchService` with the config and add it to the platform services array.

**2.3.6** When a Sylius config is provided, the system shall create a new `SyliusSearchService` with the config and add it to the platform services array.

**2.3.7** When a Magento config is provided, the system shall create a new `MagentoSearchService` with the config and add it to the platform services array.

**2.3.8** When a PrestaShop or Squarespace config is provided, the system shall create a new `OfflineSearchService` and add it to the platform services array.

**2.3.9** When a Commercefull config is provided, the system shall create a new `CommercefullSearchService` with the config and add it to the platform services array.

**2.3.10** When an Offline config is provided, the system shall create a new `OfflineSearchService` and add it to the platform services array.

**2.3.11** When all platform services are created, the system shall create a new `CompositeSearchService` with the services array.

**2.3.12** When the composite service is created, the system shall call `service.initialize()` to initialize it.

**2.3.13** When initialization completes, the system shall store the service in `this.service`.

### 2.4 Composite Service Initialization

**2.4.1** When `CompositeSearchService.initialize()` is called and `platformServices.length` is `0`, the system shall log a warning message `'No platform search services provided'` and return `false`.

**2.4.2** When `initialize()` is called and platform services exist, the system shall call `Promise.all()` to initialize all platform services in parallel.

**2.4.3** When all initialization promises resolve, the system shall check if at least one service initialized successfully.

**2.4.4** When at least one service initialized successfully, the system shall set `initialized` to `true` and return `true`.

**2.4.5** When no services initialized successfully, the system shall set `initialized` to `false` and return `false`.

### 2.5 Search Products

**2.5.1** When `searchProducts(query, options)` is called and `isInitialized()` returns `false`, the system shall throw `'Search service is not initialized'`.

**2.5.2** When `searchProducts()` is called and the service is initialized, the system shall call `addToSearchHistory(query)` to record the query.

**2.5.3** When the query is recorded, the system shall filter `platformServices` to get only initialized services.

**2.5.4** When no active services are found, the system shall return `{ query, totalResults: 0, localResults: [], ecommerceResults: [], categories: [] }`.

**2.5.5** When active services are found and `options.searchField` is `'barcode'` and the service has a `searchByBarcode` method, the system shall call `service.searchByBarcode(query)`.

**2.5.6** When active services are found and `options.searchField` is not `'barcode'` or the service lacks `searchByBarcode`, the system shall call `service.searchPlatformProducts(query, options)`.

**2.5.7** When all search promises are created, the system shall call `Promise.all(searchPromises)` to execute searches in parallel.

**2.5.8** When all searches complete, the system shall flatten the results array using `allResults.flat()`.

**2.5.9** When results are flattened, the system shall extract unique categories by iterating over `ecommerceResults` and collecting `product.category` values in a `Set`.

**2.5.10** When categories are extracted, the system shall return `{ query, totalResults: ecommerceResults.length, localResults: [], ecommerceResults, categories: Array.from(allCategories) }`.

### 2.6 Search By Barcode

**2.6.1** When `searchByBarcode(barcode)` is called and `isInitialized()` returns `false`, the system shall throw `'Search service is not initialized'`.

**2.6.2** When `searchByBarcode()` is called and the service is initialized, the system shall filter `platformServices` to get only initialized services.

**2.6.3** When active services are found and a service has a `searchByBarcode` method, the system shall call `service.searchByBarcode(barcode)`.

**2.6.4** When active services are found and a service lacks `searchByBarcode`, the system shall call `service.searchPlatformProducts(barcode, { searchField: 'barcode', limit: 5 })`.

**2.6.5** When all search promises are created, the system shall call `Promise.all()` to execute searches in parallel.

**2.6.6** When all searches complete, the system shall flatten the results array.

**2.6.7** When results are flattened, the system shall return `{ query: barcode, totalResults: ecommerceResults.length, localResults: [], ecommerceResults, categories: [] }`.

### 2.7 Get Search History

**2.7.1** When `getSearchHistory()` is called, the system shall return a shallow copy of `searchHistory` using spread syntax.

### 2.8 Clear Search History

**2.8.1** When `clearSearchHistory()` is called, the system shall set `searchHistory` to an empty array.

### 2.9 Add To Search History

**2.9.1** When `addToSearchHistory(query)` is called, the system shall call `query.trim()` to remove leading/trailing whitespace.

**2.9.2** When the query is trimmed and is empty, the system shall return immediately without adding to history.

**2.9.3** When the query is trimmed and already exists in `searchHistory`, the system shall return immediately without adding a duplicate.

**2.9.4** When the query is trimmed and is unique, the system shall call `searchHistory.unshift(trimmedQuery)` to add it to the beginning of the array.

**2.9.5** When the query is added and `searchHistory.length > MAX_HISTORY_ITEMS`, the system shall call `searchHistory.pop()` to remove the oldest entry.

### 2.10 Get Platform Services

**2.10.1** When `getPlatformServices()` is called, the system shall return a shallow copy of `platformServices` using spread syntax.

### 2.11 Add Platform Service

**2.11.1** When `addPlatformService(service)` is called and the service is not already in `platformServices`, the system shall call `platformServices.push(service)` to add it.

**2.11.2** When the service is added and `initialized` is `true`, the system shall call `service.initialize()` to initialize the new service.

**2.11.3** When `initialize()` throws an error, the system shall catch it, log an error message, and continue without throwing.

**2.11.4** When `addPlatformService()` is called and the service is already in `platformServices`, the system shall return immediately without adding a duplicate.

---

## 3. State-Driven Requirements

**3.1** While `initialized` is `false`, all search methods shall throw `'Search service is not initialized'`.

**3.2** While `initialized` is `true`, the system shall accept search requests and aggregate results from active platform services.

**3.3** While `platformServices` is empty, `initialize()` shall return `false` and log a warning.

**3.4** While `searchHistory.length` is less than `MAX_HISTORY_ITEMS`, new queries shall be added without removing old entries.

**3.5** While `searchHistory.length` equals `MAX_HISTORY_ITEMS`, adding a new query shall remove the oldest entry via `pop()`.

**3.6** While a platform service is not initialized, it shall be excluded from search operations via `filter(service => service.isInitialized())`.

---

## 4. Optional Feature Requirements

**4.1** Where `options.limit` is provided, the system shall pass it to platform services to limit the number of results per platform.

**4.2** Where `options.page` is provided, the system shall pass it to platform services to support pagination.

**4.3** Where `options.categories` is provided, the system shall pass it to platform services to filter results by category.

**4.4** Where `options.minPrice` and `options.maxPrice` are provided, the system shall pass them to platform services to filter results by price range.

**4.5** Where `options.inStock` is provided, the system shall pass it to platform services to filter results by stock availability.

**4.6** Where `options.searchField` is provided, the system shall pass it to platform services to search specific fields (name, SKU, barcode, all).

**4.7** Where a platform service has a dedicated `searchByBarcode` method, the system shall use it for barcode searches instead of `searchPlatformProducts`.

---

## 5. Unwanted Behaviour / Edge Cases

### 5.1 Uninitialized Service

**5.1.1** If `searchProducts()` is called before `initialize()`, then the system shall throw `'Search service is not initialized'` without attempting to search.

**5.1.2** If `searchByBarcode()` is called before `initialize()`, then the system shall throw `'Search service is not initialized'` without attempting to search.

### 5.2 No Platform Services

**5.2.1** If `initialize()` is called with an empty `platformServices` array, then the system shall log a warning and return `false` — the service remains uninitialized.

**5.2.2** If `searchProducts()` is called and no platform services are initialized, then the system shall return empty results without throwing.

### 5.3 Platform Search Failure

**5.3.1** If a platform service's `searchPlatformProducts()` throws an error, then the error shall propagate to `Promise.all()` which will reject — the composite service does not catch individual platform errors.

**5.3.2** If `Promise.all()` rejects due to a platform error, then the error shall propagate to the caller — search failures are not silently ignored.

### 5.4 Duplicate Search History

**5.4.1** If `addToSearchHistory()` is called with a query that already exists in `searchHistory`, then the system shall return immediately without adding a duplicate or reordering the history.

### 5.5 Empty Query

**5.5.1** If `addToSearchHistory()` is called with an empty or whitespace-only query, then the system shall return immediately without adding to history.

### 5.6 Barcode Search Without Dedicated Method

**5.6.1** If `searchByBarcode()` is called and a platform service lacks a `searchByBarcode` method, then the system shall fall back to `searchPlatformProducts(barcode, { searchField: 'barcode', limit: 5 })`.

### 5.7 Add Duplicate Platform Service

**5.7.1** If `addPlatformService()` is called with a service that is already in `platformServices`, then the system shall return immediately without adding a duplicate.

### 5.8 Initialize Added Service Failure

**5.8.1** If `addPlatformService()` is called while `initialized` is `true` and `service.initialize()` throws an error, then the system shall catch the error, log it, and continue — the service is added but remains uninitialized.

---

## 6. Complex Requirements

**6.1** When `searchProducts()` is called, the system shall add the query to history, filter for initialized services, create search promises (using `searchByBarcode` for barcode searches when available), execute all searches in parallel, flatten results, extract categories, and return aggregated results — if any step fails, the error propagates to the caller.

**6.2** When `searchByBarcode()` is called, the system shall filter for initialized services, create search promises (using `searchByBarcode` when available or falling back to `searchPlatformProducts`), execute all searches in parallel, flatten results, and return aggregated results without category extraction — barcode searches do not populate categories.

**6.3** When `addToSearchHistory()` is called, the system shall trim the query, check for empty/duplicate, add to the beginning of the array, and remove the oldest entry if the history exceeds `MAX_HISTORY_ITEMS` — the history is always capped at 10 entries.

**6.4** When `initialize()` is called, the system shall initialize all platform services in parallel, check if at least one succeeded, set `initialized` accordingly, and return the result — partial initialization is acceptable as long as one service succeeds.

**6.5** When `configureService()` is called, the system shall create platform-specific services based on the provided configs, create a new composite service, initialize it, and store it in `this.service` — the previous service is replaced entirely.

---

## 7. Search Service Lifecycle Summary

### Initialization Flow

```
App startup or configuration change
  → SearchServiceFactory.getInstance()
    → If first call:
      → new SearchServiceFactory()
      → createPlatformServices()
        → Check environment variables for each platform
        → Create platform-specific services (Shopify, WooCommerce, etc.)
        → Return platformServices array
      → new CompositeSearchService(platformServices)
      → compositeService.initialize()
        → Promise.all(platformServices.map(s => s.initialize()))
        → Check if at least one service initialized
        → Set initialized = true/false
        → Return result
    → If subsequent call:
      → Return existing factory instance
```

### Search Products Flow

```
Cashier searches for "laptop"
  → searchService.searchProducts('laptop', { limit: 20 })
    → Check if initialized → throw if false
    → addToSearchHistory('laptop')
      → Trim query
      → Check if empty or duplicate → return if true
      → searchHistory.unshift('laptop')
      → If searchHistory.length > 10: searchHistory.pop()
    → Filter platformServices for initialized services
    → If no active services: return empty results
    → Create search promises:
      → For each service:
        → If options.searchField === 'barcode' && service.searchByBarcode exists:
          → service.searchByBarcode('laptop')
        → Else:
          → service.searchPlatformProducts('laptop', options)
    → Promise.all(searchPromises)
    → Flatten results: allResults.flat()
    → Extract categories:
      → allCategories = new Set()
      → For each product in ecommerceResults:
        → If product.category: allCategories.add(product.category)
    → Return {
        query: 'laptop',
        totalResults: ecommerceResults.length,
        localResults: [],
        ecommerceResults,
        categories: Array.from(allCategories)
      }
```

### Search By Barcode Flow

```
Cashier scans barcode "1234567890123"
  → searchService.searchByBarcode('1234567890123')
    → Check if initialized → throw if false
    → Filter platformServices for initialized services
    → Create search promises:
      → For each service:
        → If service.searchByBarcode exists:
          → service.searchByBarcode('1234567890123')
        → Else:
          → service.searchPlatformProducts('1234567890123', { searchField: 'barcode', limit: 5 })
    → Promise.all(searchPromises)
    → Flatten results: results.flat()
    → Return {
        query: '1234567890123',
        totalResults: ecommerceResults.length,
        localResults: [],
        ecommerceResults,
        categories: []
      }
```

### Configure Service Flow

```
Admin configures Shopify credentials
  → searchServiceFactory.configureService({ shopify: { apiKey, accessToken, storeUrl } })
    → platformServices = []
    → If shopify config provided:
      → platformServices.push(new ShopifySearchService(shopifyConfig))
    → If bigcommerce config provided:
      → platformServices.push(new BigCommerceSearchService(bigCommerceConfig))
    → ... (repeat for all platforms)
    → this.service = new CompositeSearchService(platformServices)
    → this.service.initialize()
```

### Add Platform Service Flow

```
Runtime addition of new platform
  → compositeService.addPlatformService(newService)
    → If platformServices.includes(newService): return
    → platformServices.push(newService)
    → If initialized === true:
      → newService.initialize()
        → Catch and log any errors
```

---

## 8. Component Traceability

| Requirement (summary)                     | Component / Hook / Service                               | Source File                                              |
| ----------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| Singleton factory instance                | `SearchServiceFactory.getInstance`                       | `services/search/SearchServiceFactory.ts`                |
| Factory creates platform services         | `SearchServiceFactory.createPlatformServices`            | `services/search/SearchServiceFactory.ts`                |
| Factory returns service                   | `SearchServiceFactory.getService`                        | `services/search/SearchServiceFactory.ts`                |
| Factory configures service                | `SearchServiceFactory.configureService`                  | `services/search/SearchServiceFactory.ts`                |
| Composite service created                 | `new CompositeSearchService(platformServices)`           | `services/search/platforms/CompositeSearchService.ts`    |
| Composite service initialized             | `CompositeSearchService.initialize`                      | `services/search/platforms/CompositeSearchService.ts`    |
| Platform services initialized in parallel | `Promise.all(platformServices.map(s => s.initialize()))` | `services/search/platforms/CompositeSearchService.ts`    |
| Products searched                         | `CompositeSearchService.searchProducts`                  | `services/search/platforms/CompositeSearchService.ts`    |
| Barcode searched                          | `CompositeSearchService.searchByBarcode`                 | `services/search/platforms/CompositeSearchService.ts`    |
| Search history retrieved                  | `CompositeSearchService.getSearchHistory`                | `services/search/platforms/CompositeSearchService.ts`    |
| Search history cleared                    | `CompositeSearchService.clearSearchHistory`              | `services/search/platforms/CompositeSearchService.ts`    |
| Query added to history                    | `CompositeSearchService.addToSearchHistory`              | `services/search/platforms/CompositeSearchService.ts`    |
| Platform services retrieved               | `CompositeSearchService.getPlatformServices`             | `services/search/platforms/CompositeSearchService.ts`    |
| Platform service added                    | `CompositeSearchService.addPlatformService`              | `services/search/platforms/CompositeSearchService.ts`    |
| Shopify service created                   | `new ShopifySearchService(config)`                       | `services/search/platforms/ShopifySearchService.ts`      |
| WooCommerce service created               | `new WooCommerceSearchService(config)`                   | `services/search/platforms/WooCommerceSearchService.ts`  |
| BigCommerce service created               | `new BigCommerceSearchService(config)`                   | `services/search/platforms/BigCommerceSearchService.ts`  |
| Magento service created                   | `new MagentoSearchService(config)`                       | `services/search/platforms/MagentoSearchService.ts`      |
| Sylius service created                    | `new SyliusSearchService(config)`                        | `services/search/platforms/SyliusSearchService.ts`       |
| Wix service created                       | `new WixSearchService(config)`                           | `services/search/platforms/WixSearchService.ts`          |
| Commercefull service created              | `new CommercefullSearchService(config)`                  | `services/search/platforms/CommercefullSearchService.ts` |
| Offline service created                   | `new OfflineSearchService()`                             | `services/search/platforms/OfflineSearchService.ts`      |
| Logger created                            | `LoggerFactory.getInstance().createLogger`               | `services/logger/LoggerFactory.ts`                       |

---

**Document Metadata**:

- **Author**: Kiro AI Agent
- **Date**: 2026-05-03
- **Version**: 1.0
- **Status**: Final
- **Related**: `docs/specs/catalog/products.md`, `docs/specs/inventory/inventory.md`
