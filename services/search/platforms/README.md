# Platform-Specific Search Services

This directory contains the platform-specific implementations of the search service for different e-commerce platforms. Each platform implementation extends the abstract `BaseSearchService` class and implements the `PlatformSearchServiceInterface`.

## Architecture

The search service now follows a modular architecture that separates platform-specific concerns:

1. **PlatformSearchServiceInterface**: Defines the contract for platform-specific search services.
2. **BaseSearchService**: Abstract class providing common functionality for all platform implementations.
3. **Platform-specific implementations**:
   - `ShopifySearchService`
   - `BigCommerceSearchService`
   - (Additional platforms can be added by implementing new classes)
4. **CompositeSearchService**: Manages multiple platform implementations and delegates search operations to them.
5. **SearchServiceFactory**: Creates and configures the appropriate search service instances based on environment variables or explicit configuration.

## Usage

### Basic Usage

```typescript
import { SearchServiceFactory } from '../searchServiceFactory';
import { SearchService } from '../searchService';

// Get the search service using the singleton pattern
const searchService = SearchService.getInstance();

// Initialize the service (will auto-detect platforms based on environment variables)
await searchService.initialize();

// Search for products
const results = await searchService.searchProducts('t-shirt', {
  limit: 10,
  page: 1,
  inStock: true,
});

console.log(results.ecommerceResults); // Products from all active platforms
```

### Custom Configuration

```typescript
import { SearchServiceFactory } from '../searchServiceFactory';

// Get the factory
const factory = SearchServiceFactory.getInstance();

// Configure platform-specific services explicitly
factory.configureService({
  shopify: {
    apiKey: 'your-shopify-api-key',
    accessToken: 'your-shopify-access-token',
    storeUrl: 'https://your-store.myshopify.com',
  },
  bigcommerce: {
    clientId: 'your-bigcommerce-client-id',
    apiToken: 'your-bigcommerce-api-token',
    storeHash: 'your-store-hash',
    apiVersion: 'v3',
  },
});

// Get the configured service
const searchService = factory.getService();

// Initialize and use
await searchService.initialize();
const results = await searchService.searchProducts('shoes');
```

## Adding a New Platform

1. Create a new class that extends `BaseSearchService`
2. Implement all required abstract methods
3. Update the `SearchServiceFactory` to include your new platform

Example:

```typescript
// 1. Create a new implementation
export class WooCommerceSearchService extends BaseSearchService {
  // Implement required methods
  async initialize(): Promise<boolean> {
    /* ... */
  }
  getConfigRequirements(): PlatformConfigRequirements {
    /* ... */
  }
  async searchPlatformProducts(query: string, options: SearchOptions): Promise<SearchProduct[]> {
    /* ... */
  }
  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    /* ... */
  }
  async getCategories(): Promise<string[]> {
    /* ... */
  }
}

// 2. Update the factory to include the new platform
// In searchServiceFactory.ts:
import { WooCommerceSearchService } from './platforms/WooCommerceSearchService';

// Update configureService method
if (platformConfigs.woocommerce) {
  const wooConfig = platformConfigs.woocommerce || {};
  platformServices.push(new WooCommerceSearchService(wooConfig));
}

// Update createPlatformServices method
const hasWooConfig = process.env.WOOCOMMERCE_KEY && process.env.WOOCOMMERCE_SECRET;
if (hasWooConfig) {
  const wooConfig = {
    consumerKey: process.env.WOOCOMMERCE_KEY || '',
    consumerSecret: process.env.WOOCOMMERCE_SECRET || '',
    url: process.env.WOOCOMMERCE_URL || '',
  };
  platformServices.push(new WooCommerceSearchService(wooConfig));
}
```

## Environment Variables

The following environment variables are supported for automatic configuration:

### Shopify

- `SHOPIFY_API_KEY`
- `SHOPIFY_ACCESS_TOKEN`
- `SHOPIFY_STORE_URL`

### BigCommerce

- `BIGCOMMERCE_CLIENT_ID`
- `BIGCOMMERCE_API_TOKEN`
- `BIGCOMMERCE_STORE_HASH`
- `BIGCOMMERCE_API_VERSION` (optional, defaults to 'v3')
