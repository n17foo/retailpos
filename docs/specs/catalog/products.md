# Catalog – Products & Categories EARS Requirements

> **System**: RetailPOS – Product Catalog & Category Navigation  
> **Actor**: Cashier, Admin  
> **Date**: 2026-04-12  
> **Source**: `screens/OrderScreen.tsx`, `screens/order/ProductGrid.tsx`, `screens/order/ProductCard.tsx`, `screens/order/Category.tsx`, `screens/order/CategoryList.tsx`, `hooks/useProducts.ts`, `hooks/useCategories.ts`, `hooks/useOfflineProducts.ts`, `hooks/useOfflineCategories.ts`, `services/product/types.ts`, `services/product/mappers.ts`, `services/product/ProductServiceFactory.ts`, `services/category/types.ts`, `services/category/CategoryServiceInterface.ts`, `contexts/CategoryProvider.tsx`, `components/VariantPicker.tsx`, `services/tax/TaxProfileService.ts`, `repositories/TaxProfileRepository.ts`

---

## Context

The product catalog is the central selling surface of the POS. It loads products from the configured e-commerce platform (or local SQLite in offline mode), normalises them to a `UnifiedProduct` schema via platform-specific mappers, and renders them in a responsive `ProductGrid`. Categories are loaded in parallel and drive filtering via `CategoryProvider` context shared between the category sidebar/panel and the product grid.

Products with multiple variants expose a `VariantPicker` modal. Products without variants are added directly to the basket on tap. The catalog supports page-based pagination (all platforms except Shopify) and cursor-based pagination (Shopify). Local search filters the loaded product list client-side on `OrderScreen`; deeper search delegates to the platform API via `searchProducts()`.

Offline mode uses `OfflineProductService` backed by SQLite. Online mode uses the platform-specific service resolved by `PlatformServiceRegistry`.

**Tax resolution** is handled by `TaxProfileService`. In offline mode, each product carries an optional `taxProfileId` that references a named `TaxProfile` (e.g. "Standard 20%", "Reduced 5%", "Zero Rate") stored in SQLite via `TaxProfileRepository`. When a product has no `taxProfileId`, the default profile is used. In online mode, the platform mapper extracts the tax class or tax code from the platform API response and resolves it to a local `TaxProfile` by name match; if no match is found, the default profile applies. The resolved `taxRate` is stored on each `BasketItem` at add-to-cart time so that `BasketService.calculateTotals()` can apply per-item rates instead of a single flat `DEFAULT_TAX_RATE()`.

### Actors

| Actor   | Role                                                                                      |
| ------- | ----------------------------------------------------------------------------------------- |
| Cashier | Browses, searches, and filters products; adds items to basket                             |
| Admin   | Manages offline products and categories via `useOfflineProducts` / `useOfflineCategories` |
| System  | Fetches, maps, and paginates products; manages category navigation state                  |

### Platform Support Matrix

| Platform       | Pagination   | Mapper                  | Service class                |
| -------------- | ------------ | ----------------------- | ---------------------------- |
| `offline`      | Page-based   | `mapGenericProduct`     | `OfflineProductService`      |
| `shopify`      | Cursor-based | `mapShopifyProduct`     | `ShopifyProductService`      |
| `woocommerce`  | Page-based   | `mapWooCommerceProduct` | `WooCommerceProductService`  |
| `bigcommerce`  | Page-based   | `mapBigCommerceProduct` | `BigCommerceProductService`  |
| `magento`      | Page-based   | `mapGenericProduct`     | `MagentoProductService`      |
| `sylius`       | Page-based   | `mapGenericProduct`     | `SyliusProductService`       |
| `wix`          | Page-based   | `mapGenericProduct`     | `WixProductService`          |
| `prestashop`   | Page-based   | `mapGenericProduct`     | `PrestaShopProductService`   |
| `squarespace`  | Page-based   | `mapGenericProduct`     | `SquarespaceProductService`  |
| `commercefull` | Page-based   | `mapGenericProduct`     | `CommercefullProductService` |

### Category Navigation State Machine

| State                       | Transition                                                        |
| --------------------------- | ----------------------------------------------------------------- |
| Root (no category selected) | Tap category → `navigateTo(id)`, set `selectedCategory`           |
| Category with children      | Tap → `navigateTo(id)`, display children; `canNavigateUp = true`  |
| Category without children   | Tap → set `selectedCategory`, close mobile panel                  |
| Navigated into subcategory  | Tap Back → `navigateUp()`, restore parent selection               |
| Any level                   | Tap "All Products" → `navigateToRoot()`, clear `selectedCategory` |

### Key Configuration Defaults

| `useProductsForDisplay` option | Default | Notes                              |
| ------------------------------ | ------- | ---------------------------------- |
| `page`                         | `1`     | Reset on category/search change    |
| `limit`                        | `100`   | Products per page for display hook |
| `useUnifiedProducts` limit     | `50`    | Default for raw hook               |
| `initialNumToRender` (grid)    | `12`    | FlatList virtual rendering         |
| `maxToRenderPerBatch` (grid)   | `8`     | FlatList batch size                |
| Low stock threshold            | `≤ 5`   | `ProductCard` shows "N left" badge |

### Tax Profile Defaults (seeded by `TaxProfileService.seedDefaults()`)

| Profile name    | Rate | Default | Description          |
| --------------- | ---- | ------- | -------------------- |
| `Standard Rate` | 20%  | Yes     | UK standard VAT rate |
| `Reduced Rate`  | 5%   | No      | UK reduced VAT rate  |
| `Zero Rate`     | 0%   | No      | Zero-rated goods     |

---

## 1. Ubiquitous Requirements

**1.1** The system shall normalise all platform-specific product data to `UnifiedProduct` via `mapToUnifiedProducts()` before passing it to any UI component.

**1.2** The system shall normalise all platform-specific category data to `UnifiedCategory` via `mapToUnifiedCategories()` before passing it to any UI component.

**1.3** The system shall generate a platform-prefixed app ID for every product in the format `{platform}-{platformId}` and for every variant in the format `{platform}-{platformId}-{variantId}`.

**1.4** The system shall always identify the default variant of a product as the first variant where `isAvailable === true`, falling back to `variants[0]` if none are available.

**1.5** The system shall always identify the primary image of a product as the first image where `isPrimary === true`, falling back to `images[0]` if none are marked primary.

**1.6** The system shall share `selectedCategory`, `selectedCategoryName`, and `isLeftPanelOpen` state across all catalog components via `CategoryProvider` context.

**1.7** The system shall reset pagination to page 1 whenever a search query or category filter changes.

**1.8** The system shall store a `taxProfileId` field on every offline `UnifiedProduct` to reference the `TaxProfile` that applies to that product.

**1.9** The system shall store a `taxCode` field on every online `UnifiedProduct` to carry the platform's native tax class or tax code string (e.g. Shopify `taxable` + `tax_code`, WooCommerce `tax_class`).

**1.10** The system shall resolve the effective tax rate for a product at add-to-cart time by calling `TaxProfileService` and store the resolved `taxRate` on the `BasketItem` so that `BasketService.calculateTotals()` uses per-item rates.

---

## 2. Event-Driven Requirements

### 2.1 Order Screen Mount

**2.1.1** When `OrderScreen` mounts, the system shall call `useProductsForDisplay(currentPlatform, selectedCategory, selectedCategoryName)` with `{ page: 1, limit: 100, categoryId: categoryName }` to fetch the initial product list.

**2.1.2** When `OrderScreen` mounts, the system shall call `useUnifiedCategories(platform)` via `useCategoryNavigation()` to fetch and build the category tree.

### 2.2 Product Tap (No Variants)

**2.2.1** When the cashier taps a `ProductCard` that is not out of stock, the system shall increment the product's quantity by 1 and call `onAddToCart(id, newQuantity)`.

**2.2.2** When the cashier taps the increment button on a `ProductCard` already in the cart, the system shall increment the quantity by 1 and call `onAddToCart(id, newQuantity)`.

**2.2.3** When the cashier taps the decrement button on a `ProductCard` with quantity > 0, the system shall decrement the quantity by 1 and call `onAddToCart(id, newQuantity)`.

### 2.3 Search

**2.3.1** When the cashier types in the search bar on `OrderScreen`, the system shall filter the already-loaded `products` array client-side by matching the query against `product.name` (case-insensitive) and update `filteredProducts`.

**2.3.2** When the cashier clears the search bar, the system shall restore `filteredProducts` to the full unfiltered `products` array.

### 2.4 Category Selection (Mobile Panel)

**2.4.1** When the cashier taps a category in the `Category` panel that has no children, the system shall call `setSelectedCategory(category.id)`, `setSelectedCategoryName(category.name)`, and `setIsLeftPanelOpen(false)`.

**2.4.2** When the cashier taps a category in the `Category` panel that has children, the system shall call `setSelectedCategory(category.id)`, `setSelectedCategoryName(category.name)`, and `navigateTo(category.id)` — keeping the panel open to show subcategories.

**2.4.3** When the cashier taps "All Products" in the `Category` panel, the system shall call `setSelectedCategory(null)`, `setSelectedCategoryName(null)`, `navigateToRoot()`, and `setIsLeftPanelOpen(false)`.

**2.4.4** When the cashier taps the Back button in the `Category` panel while navigated into a subcategory with a parent, the system shall call `navigateUp()`, set `selectedCategory` to the parent category ID, and set `selectedCategoryName` to the parent category name.

**2.4.5** When the cashier taps the Back button in the `Category` panel while at a root-level category, the system shall call `navigateUp()`, `setSelectedCategory(null)`, and `setSelectedCategoryName(null)`.

### 2.5 Category Selection (Desktop Sidebar — `CategoryList`)

**2.5.1** When the cashier taps a category in `CategoryList` that has children, the system shall call `setSelectedCategory(category.id)`, `setSelectedCategoryName(category.name)`, and `navigateTo(category.id)` — the sidebar remains visible.

**2.5.2** When the cashier taps a category in `CategoryList` that has no children, the system shall call `setSelectedCategory(category.id)` and `setSelectedCategoryName(category.name)`.

**2.5.3** When the cashier taps "All Products" in `CategoryList`, the system shall call `setSelectedCategory(null)`, `setSelectedCategoryName(null)`, and `navigateToRoot()`.

**2.5.4** When the cashier taps the Back button in `CategoryList`, the system shall call `navigateUp()` and restore the parent category selection or clear it if at root level.

**2.5.5** When the cashier taps a breadcrumb item in `CategoryList`, the system shall call `navigateTo(id)`, `setSelectedCategory(id)`, and `setSelectedCategoryName(name)` for the tapped item, or call `handleShowAll()` if the root breadcrumb is tapped.

### 2.6 Category Filter Applied to Product Grid

**2.6.1** When `selectedCategoryName` changes in `CategoryProvider`, the system shall re-call `useProductsForDisplay` with the new `categoryName` as `categoryId` in the query options, resetting to page 1.

**2.6.2** When the cashier taps the active category chip's close button on `OrderScreen`, the system shall call `setSelectedCategory(null)`, `setSelectedCategoryName(null)`, and reload products without a category filter.

### 2.7 Pagination

**2.7.1** When `loadMore()` is called and `hasMore` is `true` and `isLoading` is `false`, the system shall call `fetchProducts({ ...currentOptions, page: currentPage + 1 })` and append the results to the existing product list.

**2.7.2** When `fetchProducts()` is called with `page === 1`, the system shall replace the product list with the new results rather than appending.

**2.7.3** When `fetchProducts()` is called with `page > 1`, the system shall append the new results to the existing product list.

### 2.8 Product Sync (Offline Admin)

**2.8.1** When `syncProducts(products)` is called on a platform service, the system shall send the product batch to the platform API and return a `SyncResult` with `successful`, `failed`, and `errors` counts.

**2.8.2** When a product sync fails for an individual product, the system shall record the `productId` and `error` message in `SyncResult.errors` and continue syncing remaining products.

### 2.9 Offline Product Management

**2.9.1** When `createProduct(data)` is called via `useOfflineProducts`, the system shall call `offlineProductService.createProduct()`, reload the product list, and return the created `Product`.

**2.9.2** When `updateProduct(id, data)` is called via `useOfflineProducts`, the system shall call `offlineProductService.updateProduct()`, reload the product list, and return the updated `Product`.

**2.9.3** When `deleteProduct(id)` is called via `useOfflineProducts`, the system shall call `offlineProductService.deleteProduct()`, reload the product list, and return a boolean result.

**2.9.4** When `createCategory(data)` is called via `useOfflineCategories`, the system shall call `offlineCategoryService.addCategory()`, reload the category list, and return the created `Category`.

**2.9.5** When `deleteCategory(id)` is called via `useOfflineCategories`, the system shall call `offlineCategoryService.deleteCategory()`, reload the category list, and return a boolean result.

### 2.10 Tax Profile Management (Admin — Offline Mode)

**2.10.1** When the admin calls `TaxProfileService.createProfile({ name, rate, isDefault, region, description })`, the system shall persist the profile to `tax_profiles` via `TaxProfileRepository.create()` and return the created `TaxProfile`.

**2.10.2** When `isDefault: true` is passed to `createProfile()` or `updateProfile()`, the system shall first unset `is_default` on any existing default profile before setting the new one.

**2.10.3** When the admin calls `TaxProfileService.updateProfile(id, input)`, the system shall update the matching row in `tax_profiles` and return the updated `TaxProfile`.

**2.10.4** When the admin calls `TaxProfileService.deleteProfile(id)`, the system shall delete the profile unless it is the current default, in which case the system shall log a warning and return `false`.

**2.10.5** When `TaxProfileService.seedDefaults()` is called and no profiles exist, the system shall create three profiles: "Standard Rate" (20%, default), "Reduced Rate" (5%), and "Zero Rate" (0%).

**2.10.6** When `TaxProfileService.seedDefaults()` is called and profiles already exist, the system shall return without creating any new profiles.

### 2.11 Tax Resolution at Add-to-Cart

**2.11.1** When a cashier adds an offline product to the basket, the system shall call `TaxProfileService.getProfileById(product.taxProfileId)` to resolve the tax rate; if `taxProfileId` is absent or the profile is not found, the system shall call `TaxProfileService.getDefaultProfile()` and use its rate.

**2.11.2** When a cashier adds an online product to the basket, the system shall call `TaxProfileService.resolveRateForTaxCode(product.taxCode)` to find a matching profile by `taxCode` name match; if no match is found, the system shall fall back to `TaxProfileService.getDefaultProfile()`.

**2.11.3** When the resolved tax rate is determined, the system shall pass `taxRate: resolvedRate` to `BasketProvider.addToCart()` so it is stored on the `BasketItem` and used by `BasketService.calculateTotals()`.

---

## 3. State-Driven Requirements

**3.1** While `isLoading` is `true` in `OrderScreen`, the system shall render an `ActivityIndicator` and "Loading products..." label in place of the `ProductGrid`.

**3.2** While `filteredProducts` is empty and `searchQuery` is non-empty, the system shall render a "No results found" empty state with the query echoed back and a "Clear filters" button.

**3.3** While `filteredProducts` is empty and `selectedCategoryName` is set and `searchQuery` is empty, the system shall render a "No products in [category]" empty state with a "Clear filters" button.

**3.4** While `filteredProducts` is empty and both `searchQuery` and `selectedCategoryName` are empty, the system shall render an "Add products to your catalogue to get started" empty state without a "Clear filters" button.

**3.5** While a product's `stock` is `0` or less, `ProductCard` shall render an "Out of Stock" overlay, disable the tap gesture, and set `accessibilityState.disabled = true`.

**3.6** While a product's `stock` is between 1 and 5 inclusive, `ProductCard` shall render a low-stock badge showing "{stock} left".

**3.7** While a product is in the cart (`quantity > 0`), `ProductCard` shall render a quantity badge in the top-right corner, a highlighted border, and a quantity control bar below the product info.

**3.8** While `canNavigateUp` is `true` in `useCategoryNavigation`, both `Category` and `CategoryList` shall render a Back button showing the current category name.

**3.9** While `isTabletOrDesktop` is `true` in `OrderScreen`, the system shall render the three-panel layout: `CategoryList` sidebar (left), `ProductGrid` (centre), `BasketContent` sidebar (right).

**3.10** While `isTabletOrDesktop` is `false` in `OrderScreen`, the system shall render the single-panel layout with `Category` and `Basket` as swipeable panels.

**3.11** While `selectedCategoryName` is set in `OrderScreen`, the system shall render an active category chip bar above the product grid showing the category name and a dismiss button.

**3.12** While `hasMore` is `false` in `useUnifiedProducts`, the system shall not trigger any further `loadMore()` calls.

**3.13** While `showBreadcrumb` is `true` and `breadcrumbItems` is non-empty in `CategoryList`, the system shall render the `Breadcrumb` component above the category list.

**3.14** While an offline product has a `taxProfileId` set, the admin product edit screen shall display the assigned tax profile name and allow reassignment from the list of active profiles.

**3.15** While no tax profiles exist in `tax_profiles`, the system shall call `TaxProfileService.seedDefaults()` on first launch to ensure a default rate is always available.

---

## 4. Optional Feature Requirements

**4.1** Where the configured platform is `'shopify'`, the system shall use cursor-based pagination — passing `nextCursor` from the previous result as `cursor` in the next `fetchProducts()` call instead of incrementing `page`.

**4.2** Where the configured platform is `'offline'`, the system shall use `OfflineProductService` backed by SQLite and `OfflineCategoryService` for all product and category operations.

**4.3** Where `USE_MOCK_PRODUCTS` is `'true'` in the environment, the system shall use mock product data instead of calling the platform API.

**4.4** Where a product has `options.length > 0` and `variants.length > 1`, the system shall render a `VariantPicker` modal instead of adding the product directly to the basket on tap.

**4.5** Where a variant has `compareAtPrice > price`, `VariantPicker` shall render the `compareAtPrice` with a strikethrough alongside the current price.

**4.6** Where `numColumns` changes (responsive breakpoint), `ProductGrid` shall re-render with a new `key` prop (`grid-{numColumns}`) to force `FlatList` to rebuild the column layout.

**4.7** Where the configured platform is `'shopify'` and a product variant has `taxable: false`, the system shall map the product's `taxCode` to `'exempt'` so `TaxProfileService.resolveRateForTaxCode('exempt')` returns a zero-rate profile.

**4.8** Where the configured platform is `'woocommerce'` and a product has `tax_class: 'reduced-rate'` or `tax_class: 'zero-rate'`, the system shall map the `taxCode` to the corresponding string so `TaxProfileService` can resolve it to the correct profile.

**4.9** Where `TaxProfileService.getDefaultProfile()` returns `null` (no default set), the system shall fall back to `DEFAULT_TAX_RATE()` from `POSConfigService` to ensure tax is always calculated.

---

## 5. Unwanted Behaviour / Edge Cases

### 5.1 Service Unavailable

**5.1.1** If `PlatformServiceRegistry.getProductService(platform)` returns `null` or `undefined`, then `useUnifiedProducts` shall set `error` to "Product service not available" and leave `products` as an empty array.

**5.1.2** If `CategoryServiceFactory.getService(platform)` returns `null` or `undefined`, then `useUnifiedCategories` shall set `error` to "Category service not available" and leave `categories` as an empty array.

### 5.2 Fetch Errors

**5.2.1** If `service.getProducts()` throws, then `useUnifiedProducts` shall catch the error, set `error` to the error message or "Failed to fetch products", set `isLoading` to `false`, and leave the existing product list unchanged.

**5.2.2** If `service.getCategories()` throws, then `useUnifiedCategories` shall catch the error, set `error` to the error message or "Failed to fetch categories", and set `isLoading` to `false`.

### 5.3 Pagination Boundary

**5.3.1** If `loadMore()` is called while `isLoading` is `true`, then the system shall return immediately without making a second fetch.

**5.3.2** If `loadMore()` is called while `hasMore` is `false`, then the system shall return immediately without making a fetch.

### 5.4 Variant Picker Edge Cases

**5.4.1** If a variant has `trackInventory === true` and `inventoryQuantity <= 0` and `allowBackorder === false`, then `VariantPicker` shall render the variant row as disabled with an "Out of Stock" label and prevent selection.

**5.4.2** If the selected option combination matches no variants, then `VariantPicker` shall render the empty state "No matching variants" in the variant list.

**5.4.3** If the cashier deselects an already-selected option chip (taps it again), then `VariantPicker` shall clear that option's selection and expand the filtered variant list accordingly.

### 5.5 Offline CRUD Errors

**5.5.1** If `offlineProductService.createProduct()` throws, then `useOfflineProducts.createProduct()` shall set `error` to the error message and re-throw so the caller can handle it.

**5.5.2** If `offlineProductService.updateProduct()` throws, then `useOfflineProducts.updateProduct()` shall set `error` to the error message and re-throw.

**5.5.3** If `offlineProductService.deleteProduct()` throws, then `useOfflineProducts.deleteProduct()` shall set `error` to the error message and return `false`.

### 5.6 Empty Catalog

**5.6.1** If `getProducts()` returns an empty `products` array on page 1, then the system shall set `totalPages` to the value from pagination, `hasMore` to `false`, and render the appropriate empty state in `OrderScreen`.

### 5.7 Platform Not Supported

**5.7.1** If `ProductServiceFactory.getService()` is called with an unrecognised platform, then the system shall log a warning and return `offlineDefaultService` as the fallback.

### 5.8 Tax Profile Edge Cases

**5.8.1** If `TaxProfileService.deleteProfile(id)` is called on the default profile, then the system shall return `false` and log a warning without deleting the profile.

**5.8.2** If `TaxProfileService.getProfileById(taxProfileId)` returns `null` when resolving tax at add-to-cart time, then the system shall fall back to `getDefaultProfile()` and log a warning with the missing `taxProfileId`.

**5.8.3** If `TaxProfileService.resolveRateForTaxCode(taxCode)` finds no profile matching the tax code, then the system shall fall back to `getDefaultProfile()` and log the unresolved tax code.

**5.8.4** If `TaxProfileService.getDefaultProfile()` returns `null` and `DEFAULT_TAX_RATE()` is also `0`, then the system shall apply a `taxRate` of `0` to the basket item and log a warning that no tax configuration is available.

---

## 6. Complex Requirements

**6.1** When `selectedCategoryName` changes in `CategoryProvider` while `OrderScreen` is mounted, the system shall re-memoize `useProductsForDisplay` options with the new `categoryId` value, triggering a fresh `fetchProducts({ page: 1, limit: 100, categoryId: newCategoryName })` call and replacing the product list.

**6.2** When the cashier taps a category in `CategoryList` that has children while `showBreadcrumb` is `true`, the system shall simultaneously call `navigateTo(category.id)`, update `selectedCategory` and `selectedCategoryName` in `CategoryProvider`, and re-render the `Breadcrumb` component with the updated trail.

**6.3** When `mapToUnifiedProducts()` is called for a Shopify product, the system shall parse `tags` from a comma-separated string to a `string[]`, map `body_html` to `description`, map `product_type` to `productType`, and set `categoryIds` to an empty array (Shopify collections are mapped separately).

**6.4** When `mapToUnifiedProducts()` is called for a WooCommerce product with `variations.length > 0`, the system shall map each variation to a `UnifiedProductVariant` with `optionValues` derived from `variation.attributes[].option`, and set `compareAtPrice` to `regular_price` when `sale_price` is present.

**6.5** When `mapToUnifiedProducts()` is called for a WooCommerce simple product (no variations), the system shall create a single default variant using product-level `price`, `stock_quantity`, `sku`, and `manage_stock` fields.

**6.6** When `toProductSummary()` is called on a `UnifiedProduct`, the system shall compute `price` as the minimum price across all variants, `totalInventory` as the sum of all variant `inventoryQuantity` values, and `inStock` as `true` if any variant has `isAvailable === true` and `inventoryQuantity > 0`.

**6.7** When an offline product is added to the basket while its `taxProfileId` resolves to an active `TaxProfile`, the system shall pass the profile's `rate` as `taxRate` on the `BasketItem`, overriding the flat `DEFAULT_TAX_RATE()` — ensuring that products with different tax tiers (standard, reduced, zero) are taxed correctly within the same order.

**6.8** When `BasketService.calculateTotals()` is called, the system shall use each `BasketItem.taxRate` (if set) rather than `DEFAULT_TAX_RATE()` for that item's tax contribution, so that a basket containing mixed-rate products produces the correct total tax.

---

## 7. Catalog Lifecycle Summary

### Product load flow

```
OrderScreen mounts
  → useProductsForDisplay(platform, categoryId, categoryName)
    → useUnifiedProducts(platform, { page: 1, limit: 100, categoryId: categoryName })
      → PlatformServiceRegistry.getProductService(platform)
      → service.getProducts({ page, limit, category, search, cursor })
      → mapToUnifiedProducts(result.products, platform)
      → setProducts / setCurrentPage / setTotalPages
    → displayProducts = products.map(p → DisplayProduct)
  → ProductGrid renders DisplayProduct[]
```

### Category load flow

```
OrderScreen mounts
  → useCategoryNavigation(platform)
    → useUnifiedCategories(platform)
      → CategoryServiceFactory.getService(platform)
      → service.getCategories()
      → mapToUnifiedCategories(result, platform)
      → setCategories
    → buildCategoryTree(categories)
    → displayCategories = root categories (or children of currentCategoryId)
  → CategoryList / Category renders displayCategories
```

### Category filter → product reload

```
Cashier taps category
  → setSelectedCategory(id) + setSelectedCategoryName(name) [CategoryProvider]
  → OrderScreen re-renders with new selectedCategoryName
  → useProductsForDisplay options re-memoized with categoryId = categoryName
  → fetchProducts({ page: 1, categoryId: categoryName })
  → ProductGrid re-renders with filtered products
```

### Variant selection flow

```
Cashier taps product with variants
  → VariantPicker modal opens
  → Cashier selects option chips → filteredVariants narrows
  → Cashier taps variant row → onSelect(variant) → addToCart
  → VariantPicker closes, selectedOptions reset
```

### Pagination flow (page-based)

```
Scroll to bottom → loadMore()
  → hasMore check (currentPage < totalPages)
  → fetchProducts({ ...currentOptions, page: currentPage + 1 })
  → products appended (setProducts(prev => [...prev, ...newProducts]))
  → currentPage incremented
```

### Pagination flow (cursor-based — Shopify)

```
Scroll to bottom → loadMore()
  → fetchProducts({ ...currentOptions, cursor: pagination.nextCursor })
  → products appended
  → nextCursor updated for subsequent calls
```

---

## 8. Component Traceability

| Requirement (summary)                             | Component / Hook / Service                                            | Source File                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| Products fetched on mount                         | `useProductsForDisplay` → `useUnifiedProducts` → `fetchProducts`      | `hooks/useProducts.ts`                                        |
| Platform service resolved                         | `PlatformServiceRegistry.getProductService`                           | `services/platform/PlatformServiceRegistry.ts`                |
| Products mapped to unified schema                 | `mapToUnifiedProducts`                                                | `services/product/mappers.ts`                                 |
| Default variant extracted                         | `getDefaultVariant`                                                   | `services/product/types.ts`                                   |
| Primary image extracted                           | `product.images.find(img => img.isPrimary) \|\| images[0]`            | `hooks/useProducts.ts`                                        |
| Display products formatted for grid               | `useProductsForDisplay` → `displayProducts` memo                      | `hooks/useProducts.ts`                                        |
| Product grid rendered                             | `ProductGrid` → `FlatList` of `ProductCard`                           | `screens/order/ProductGrid.tsx`                               |
| Product card tap → add to cart                    | `ProductCard.handleCardPress` → `onAddToCart`                         | `screens/order/ProductCard.tsx`                               |
| Out-of-stock overlay + disabled state             | `ProductCard` (`isOutOfStock` guard)                                  | `screens/order/ProductCard.tsx`                               |
| Low-stock badge (≤ 5)                             | `ProductCard` (`isLowStock` guard)                                    | `screens/order/ProductCard.tsx`                               |
| Quantity badge + controls when in cart            | `ProductCard` (`isInCart` guard)                                      | `screens/order/ProductCard.tsx`                               |
| Client-side search filter                         | `OrderScreen` → `filteredProducts` memo                               | `screens/OrderScreen.tsx`                                     |
| Active category chip + dismiss                    | `OrderScreen` → `activeCategoryBar` + clear handler                   | `screens/OrderScreen.tsx`                                     |
| Categories fetched on mount                       | `useCategoryNavigation` → `useUnifiedCategories` → `fetchCategories`  | `hooks/useCategories.ts`                                      |
| Category tree built from flat list                | `buildCategoryTree`                                                   | `services/category/types.ts`                                  |
| Display categories (root or children)             | `useCategoryNavigation.displayCategories` memo                        | `hooks/useCategories.ts`                                      |
| Category selected (mobile panel)                  | `Category.handleCategorySelect`                                       | `screens/order/Category.tsx`                                  |
| Category selected (desktop sidebar)               | `CategoryList.handleCategorySelect`                                   | `screens/order/CategoryList.tsx`                              |
| Navigate into subcategory                         | `navigateTo(category.id)`                                             | `hooks/useCategories.ts`                                      |
| Navigate up to parent                             | `navigateUp()`                                                        | `hooks/useCategories.ts`                                      |
| Navigate to root                                  | `navigateToRoot()`                                                    | `hooks/useCategories.ts`                                      |
| Breadcrumb navigation                             | `CategoryList.handleBreadcrumbNavigate` → `Breadcrumb`                | `screens/order/CategoryList.tsx`, `components/Breadcrumb.tsx` |
| Category filter drives product reload             | `CategoryProvider` → `useProductsForDisplay` options memo             | `contexts/CategoryProvider.tsx`, `hooks/useProducts.ts`       |
| Pagination — load next page                       | `useUnifiedProducts.loadMore`                                         | `hooks/useProducts.ts`                                        |
| Pagination — append results                       | `fetchProducts` (page > 1 branch)                                     | `hooks/useProducts.ts`                                        |
| Cursor-based pagination (Shopify)                 | `fetchProducts({ cursor: nextCursor })`                               | `hooks/useProducts.ts`                                        |
| Variant picker opened for multi-variant products  | `VariantPicker` (visible prop)                                        | `components/VariantPicker.tsx`                                |
| Option chip filter narrows variant list           | `VariantPicker.filteredVariants` memo                                 | `components/VariantPicker.tsx`                                |
| Out-of-stock variant disabled in picker           | `VariantPicker.renderVariantItem` (`isOutOfStock` guard)              | `components/VariantPicker.tsx`                                |
| Product summary computed from unified product     | `toProductSummary`                                                    | `services/product/types.ts`                                   |
| Shopify product mapped                            | `mapShopifyProduct`                                                   | `services/product/mappers.ts`                                 |
| WooCommerce product mapped (variable)             | `mapWooCommerceProduct` (variations branch)                           | `services/product/mappers.ts`                                 |
| WooCommerce product mapped (simple)               | `mapWooCommerceProduct` (single variant branch)                       | `services/product/mappers.ts`                                 |
| BigCommerce product mapped                        | `mapBigCommerceProduct`                                               | `services/product/mappers.ts`                                 |
| Offline product CRUD                              | `useOfflineProducts` → `offlineProductService`                        | `hooks/useOfflineProducts.ts`                                 |
| Offline category CRUD                             | `useOfflineCategories` → `offlineCategoryService`                     | `hooks/useOfflineCategories.ts`                               |
| Platform service factory (singleton per platform) | `ProductServiceFactory.getService`                                    | `services/product/ProductServiceFactory.ts`                   |
| Unsupported platform fallback to offline          | `ProductServiceFactory.getService` (default branch)                   | `services/product/ProductServiceFactory.ts`                   |
| Responsive layout (tablet/desktop vs mobile)      | `OrderScreen` → `useResponsive.isTabletOrDesktop`                     | `screens/OrderScreen.tsx`, `hooks/useResponsive.ts`           |
| Three-panel layout (desktop)                      | `OrderScreen` → `desktopLayout` with `CategoryList` + `BasketContent` | `screens/OrderScreen.tsx`                                     |
| Swipeable panel layout (mobile)                   | `OrderScreen` → `Category` + `Basket` panels                          | `screens/OrderScreen.tsx`                                     |
| Tax profile CRUD                                  | `TaxProfileService` → `TaxProfileRepository`                          | `services/tax/TaxProfileService.ts`                           |
| Tax profile seeded on first launch                | `TaxProfileService.seedDefaults`                                      | `services/tax/TaxProfileService.ts`                           |
| Default tax profile resolved                      | `TaxProfileService.getDefaultProfile`                                 | `services/tax/TaxProfileService.ts`                           |
| Offline product tax resolved by taxProfileId      | `TaxProfileService.getProfileById(product.taxProfileId)`              | `services/tax/TaxProfileService.ts`                           |
| Online product tax resolved by taxCode            | `TaxProfileService.resolveRateForTaxCode(product.taxCode)`            | `services/tax/TaxProfileService.ts`                           |
| Per-item taxRate stored on BasketItem             | `BasketProvider.addToCart` → `taxRate` field                          | `contexts/BasketProvider.tsx`                                 |
| Per-item taxRate used in totals calculation       | `BasketService.calculateTotals` (per-item rate branch)                | `services/basket/BasketService.ts`                            |

---

## 9. Tax Strategy API — Platform-Aware Calculation

> **Source files**: `services/tax/TaxServiceFactory.ts`, `services/tax/TaxCalculationService.ts`, `services/tax/TaxTypes.ts`, `services/tax/TaxServiceInterface.ts`, `services/tax/platforms/*TaxStrategy.ts`, `services/config/ServiceConfigBridge.ts`

### 9.1 TaxServiceFactory

**9.1.1** When `TaxServiceFactory.getInstance()` is called, the system shall return the singleton instance and register one strategy per platform: Shopify, WooCommerce, BigCommerce, Magento, Sylius, Wix, PrestaShop, Squarespace, Commercefull, and Offline.

**9.1.2** When `TaxServiceFactory.getService(platform)` is called with a registered platform, the system shall return the corresponding `TaxServiceInterface` strategy instance.

**9.1.3** When `TaxServiceFactory.getService(platform)` is called with an unregistered platform, the system shall log a warning and return the `OfflineTaxStrategy` as the fallback.

**9.1.4** When `TaxServiceFactory.configureService(platform, config)` is called, the system shall call `strategy.configure(config)` on the matching strategy so it has access to platform credentials for any API calls.

### 9.2 ServiceConfigBridge Integration

**9.2.1** When `ServiceConfigBridge.configureServicesForPlatform(settings)` runs, the system shall call `TaxServiceFactory.getInstance().configureService(platform, config)` after all other service factories are configured, ensuring the tax strategy is ready before the first basket operation.

### 9.3 TaxCalculationService

**9.3.1** When `TaxCalculationService.calculate({ price, quantity, taxCode }, platform)` is called with a `taxCode`, the system shall delegate to `TaxServiceFactory.getService(platform).resolveTax(taxCode)` to obtain the `ResolvedTaxDetail`, then apply the calculation.

**9.3.2** When `TaxCalculationService.calculate({ price, quantity, profileId }, platform)` is called with a `profileId`, the system shall call `TaxProfileService.getProfileById(profileId)` to load the profile rate directly, then use the platform strategy's default type for the `TaxCalculationType`.

**9.3.3** When `TaxCalculationService.calculate()` is called and neither `taxCode` nor `profileId` is provided, the system shall call `TaxServiceFactory.getService(platform).resolveTax(undefined)` to obtain the platform default.

**9.3.4** When the resolved `TaxCalculationType` is `'inclusive'`, the system shall compute `unitSubtotal = price / (1 + rate)`, `unitTax = price - unitSubtotal`, and `unitTotal = price`.

**9.3.5** When the resolved `TaxCalculationType` is `'exclusive'`, the system shall compute `unitSubtotal = price`, `unitTax = price × rate`, and `unitTotal = price + unitTax`.

**9.3.6** When the resolved `TaxCalculationType` is `'exempt'`, the system shall compute `unitSubtotal = price`, `unitTax = 0`, and `unitTotal = price`.

**9.3.7** When `TaxCalculationService.calculate()` returns a `TaxCalculationResponse`, all monetary values (`unitSubtotal`, `unitTax`, `unitTotal`, `lineSubtotal`, `lineTax`, `lineTotal`) shall be rounded to 2 decimal places.

**9.3.8** When `TaxCalculationService.resolveDetail({ taxCode, profileId }, platform)` is called, the system shall return only the `ResolvedTaxDetail` without computing a price breakdown, for use in display-only contexts.

### 9.4 Rate Resolution Pipeline

Rate resolution in `BaseTaxStrategy.resolveTax(taxCode)` follows a strict priority order:

1. **Normalise** — `normaliseTaxCode(taxCode)` maps the platform-specific string to a canonical form (`standard`, `reduced`, `zero`, `exempt`) and determines the `TaxCalculationType` (inclusive / exclusive / exempt).
2. **Exempt fast-path** — if the normalised type is `exempt` or the code is a known exempt string, return `rate: 0` immediately without hitting the API or local profiles.
3. **Live platform rate** — call `fetchPlatformRate(taxCode)` if the strategy implements it. On success, use the returned rate as the authoritative value. The local profile is still matched for its `profileId` reference but its rate is ignored.
4. **Local profile fallback** — query `tax_profiles` for an active profile whose name contains the canonical string (case-insensitive). Use its stored rate.
5. **Default profile** — if no profile matches, use the default `TaxProfile`. If no default exists, return `rate: 0`.

### 9.5 Platform Rate Source Matrix

| Platform     | `fetchPlatformRate` | Rate source                                                        | Status        |
| ------------ | ------------------- | ------------------------------------------------------------------ | ------------- |
| WooCommerce  | ✅                  | `GET /wp-json/wc/v3/taxes?class=<code>` → `rate` field (%)         | Live          |
| Magento      | ✅                  | `GET /rest/V1/taxRates/search?code=<code>` → `rate` field (%)      | Live          |
| Sylius       | ✅                  | `GET /api/v2/shop/tax-rates?taxCategory.code=<code>` → `amount`    | Live          |
| Commercefull | ✅                  | Inline in tax code string: `"standard:inclusive:20"` (no API call) | Live          |
| Shopify      | ❌                  | No public Tax Rates API — location-based, server-side only         | Returns zero  |
| BigCommerce  | ❌                  | Tax Classes API has no rate values — zone-based, server-side       | Returns zero  |
| Wix          | ❌                  | No public Tax Rates API                                            | Returns zero  |
| PrestaShop   | ❌                  | WebService returns complex nested rules, not practical per-product | Returns zero  |
| Squarespace  | ❌                  | No Tax Rates API — location-based, server-side only                | Returns zero  |
| Offline      | ❌                  | Local only by design — always uses local `TaxProfile`              | Local profile |

### 9.6 Zero-Rate Platforms (Temporary)

**9.6.1** When `resolveTax(taxCode)` is called on a platform marked "Returns zero" (Shopify, BigCommerce, Wix, PrestaShop, Squarespace), the system shall return `rate: 0` and `type: 'exempt'` regardless of the tax code, so the POS never silently applies a wrong rate.

**9.6.2** When the resolved tax code maps to an explicitly exempt code on a zero-rate platform, the system shall set `name: 'Exempt'`.

**9.6.3** When the resolved tax code maps to a taxable code on a zero-rate platform, the system shall set `name: 'Tax Not Available'` to make the limitation visible on receipts and in the basket.

**9.6.4** All zero-rate platform strategies contain a `// TODO` comment marking the `resolveTax` override for replacement once a proper rate resolution strategy is available for that platform.

### 9.7 Tax Code Normalisation

**9.7.1** When a platform strategy's `normaliseTaxCode(taxCode)` is called, the system shall return a `NormalisedTaxCode` with `canonical` (e.g. `"standard"`, `"reduced"`, `"zero"`, `"exempt"`), `type`, and `label`; or `null` if the code is unrecognised.

**9.7.2** When `normaliseTaxCode` returns `null` in `BaseTaxStrategy`, the system shall fall back to `resolveDefault()` using the platform's default type and the default `TaxProfile`.

**9.7.3** When `normaliseTaxCode` returns a `canonical` value, `BaseTaxStrategy` shall attempt to match an active `TaxProfile` by name (case-insensitive substring match on `canonical`); if matched, the profile's `rate` is used unless a live platform rate was already obtained.

**9.7.4** When `CommercefullTaxStrategy.normaliseTaxCode()` receives a code in the format `"<code>:<type>:<rate>"` (e.g. `"standard:inclusive:20"`), the system shall parse the type hint and the rate segment, returning the rate via `fetchPlatformRate` without making any API call.

### 9.8 Edge Cases

**9.8.1** If `TaxServiceFactory.getService(platform)` is called before `configureService()` has been called for that platform, the system shall still return the strategy using its built-in defaults (no credentials required for local profile resolution).

**9.8.2** If `fetchPlatformRate(taxCode)` throws or returns `null`, `BaseTaxStrategy` shall catch the error, log a warning, and continue to the local profile fallback without surfacing the error to the caller.

**9.8.3** If `TaxCalculationService.calculate()` is called with a `profileId` that does not exist in `tax_profiles`, the system shall log a warning and fall back to the platform strategy's `resolveTax(taxCode)` path.

**9.8.4** If `TaxCalculationService.calculate()` is called with `price = 0`, the system shall return all monetary fields as `0` with the resolved `detail` still populated.
