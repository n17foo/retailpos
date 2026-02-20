# E-commerce Integration

## User Story

**As a** retail store owner  
**I want to** integrate my POS with online sales platforms  
**So that** inventory, orders, and customer data stay synchronized

## Rules

- 8 platforms: Shopify, WooCommerce, BigCommerce, Magento, Sylius, Wix, PrestaShop, Squarespace
- Token types: ACCESS, REFRESH, ID, API_KEY, SESSION — with automatic renewal
- PlatformServiceRegistry provides unified access to product, order, customer, discount, gift card services
- Platform-specific mappers normalize API responses to unified interfaces
- Exponential backoff on rate limits (429) and transient errors
- All platform operations go through `withTokenRefresh` wrapper

---

## Flow 1: Platform Setup & Token Storage

1. **Onboarding or Settings → E-Commerce tab** → admin selects platform (e.g. Shopify)
2. **Enter credentials** → API key, store URL, webhook secret
3. **storeToken(platform, TokenType.ACCESS, token, expiresIn)** → stored securely with expiration
4. **registerTokenProvider(platform, refreshFn)** → refresh function stored for auto-renewal
5. **hasValidToken()** → returns true until expiration
6. **Platform services initialized** → product, order, customer services ready

## Flow 2: Automatic Token Refresh

1. **API call needs token** → getToken(platform, TokenType.ACCESS) called
2. **Token valid** → returned immediately
3. **Token expired** → registered token provider called automatically
4. **Refresh token used** → new access token obtained from platform OAuth
5. **New token stored** → storeToken() with updated expiration
6. **API call proceeds** → with fresh token
7. **Refresh fails** → error propagated, user prompted to re-authenticate

## Flow 3: Platform Service Registry

1. **Service needed** → e.g. registry.getProductService(ECommercePlatform.SHOPIFY)
2. **Registry checks** → returns cached instance or creates new ShopifyProductService
3. **Service initialized** → configured with platform credentials via TokenService
4. **Authenticated calls** → all API requests include valid token headers
5. **Same pattern** → for order, customer, discount, gift card services

## Flow 4: Data Mapping (Platform → Unified)

1. **Platform API returns data** → e.g. Shopify product JSON
2. **mapToUnifiedProducts()** → converts platform-specific fields
3. **Variants normalized** → price, SKU, barcode, inventory mapped to ProductVariant
4. **Options normalized** → size/color options mapped to ProductOption
5. **Images normalized** → URLs, alt text, position mapped to ProductImage
6. **Unified interface** → same data structure regardless of source platform

## Flow 5: Order Sync (POS → Platform)

1. **Local order paid** → BackgroundSyncService picks it up
2. **Platform order service** → orderServiceFactory creates platform-specific service
3. **Data mapped** → local order converted to platform format (line items, customer, discounts)
4. **API call** → createOrder() sent to platform
5. **Success** → platformOrderId stored, local status → "synced"
6. **Rate limited (429)** → exponential backoff, retry after delay
7. **Failure** → status → "failed", error stored, notification pushed

## Flow 6: Discount & Gift Card Validation

1. **Cashier enters coupon code** → applyDiscount(code) on basket
2. **Platform discount service** → validates code against platform API
3. **Valid** → returns discount type (percentage/fixed) and amount
4. **Applied to basket** → total recalculated
5. **Gift card** → checkBalance(code) returns balance, redeemGiftCard() deducts amount
6. **Platform-specific** → each platform has its own API format (cart_rules, gift_cards, etc.)

## Questions

- How are API credentials secured in storage?
- What happens when platform APIs change their data structures?
- How does the system handle extended platform outages?
- How are sync conflicts resolved when data differs between POS and platform?
