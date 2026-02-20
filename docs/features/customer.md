# Customers

## User Story

**As a** retail cashier  
**I want to** search and attach customer information to orders  
**So that** purchases are tracked and customers receive personalized service

## Rules

- Customer data lives on the e-commerce platform — POS only reads, never creates
- Supports 8 platforms: Shopify, WooCommerce, BigCommerce, Magento, Sylius, Wix, PrestaShop, Squarespace
- Offline mode: no customer service available, orders created without customer attachment
- Search is debounced (300ms) with stale-response cancellation
- Service factory caches platform service instances for performance

---

## Flow 1: Search & Attach Customer to Order

1. **Cashier taps "Add Customer"** in basket → CustomerSearchModal opens
2. **Type name or email** → useCustomerSearch hook debounces input (300ms)
3. **API call** → platform-specific customer service queries platform API
4. **Results displayed** → list shows name, email, phone, orderCount, totalSpent
5. **Pagination** → if hasMore is true, "Load More" fetches next page via cursor
6. **Select customer** → setCustomer(email, name) attaches to basket
7. **Customer badge** → shown in basket header with option to remove
8. **Order created** → customerId included in LocalOrder for platform sync

## Flow 2: Platform Service Initialization

1. **App starts** → customerServiceFactory singleton created
2. **Platform configured** → e.g. ECommercePlatform.SHOPIFY
3. **getService(platform)** → creates ShopifyCustomerService (or cached instance)
4. **service.initialize()** → sets up API credentials via TokenService
5. **Ready** → searchCustomers() and getCustomer() available

## Flow 3: Individual Customer Lookup

1. **Customer ID known** → e.g. from order history or scanned loyalty card
2. **getCustomer(platformId)** → fetches full customer record from platform API
3. **PlatformCustomer returned** → id, email, firstName, lastName, phone, tags, orderCount, totalSpent, currency, createdAt
4. **Platform mapping** → each platform service normalizes its API response to the standard PlatformCustomer interface

## Flow 4: Offline Mode

1. **No e-commerce platform selected** → offline mode
2. **customerServiceFactory.getService()** → returns null
3. **"Add Customer" button hidden** → customer search disabled in UI
4. **Orders still work** → created without customer attachment
5. **No API calls** → fully offline operation

## Questions

- How are customer search results cached to reduce API calls?
- What happens when the platform API is temporarily unavailable during search?
- How does the system handle GDPR compliance for customer data?
- What happens if a customer is deleted from the platform while attached to a local order?
