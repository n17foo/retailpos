# Products

## User Story

**As a** retail manager  
**I want to** manage a unified product catalog across platforms  
**So that** cashiers can sell products consistently whether online or in-store

## Rules

- Unified product interface normalizes data from 8+ e-commerce platforms
- Products have variants (size, color), options, images, inventory quantities
- Pagination: page-based (most platforms) or cursor-based (Shopify)
- Platform-specific mappers convert API responses to UnifiedProduct
- Display hooks format products for ProductGrid UI component
- Product sync pushes local changes to platform with success/failure reporting

---

## Flow 1: Load & Display Products

1. **Order screen mounts** → useProductsForDisplay(platform, categoryName) called
2. **Hook fetches** → PlatformServiceRegistry.getProductService(platform)
3. **API call** → service.getProducts({ page: 1, limit: 100, category })
4. **Platform mapping** → mapToUnifiedProducts() normalizes to UnifiedProduct[]
5. **Display format** → extracts default variant price, primary image, stock, SKU
6. **ProductGrid renders** → shows name, price, image, platform badge for each product

## Flow 2: Search Products

1. **Cashier types in search bar** (or Cmd+K on desktop)
2. **searchProducts(query)** → fetchProducts({ search: query, page: 1 })
3. **Platform API queried** → filters by title/description
4. **Results replace grid** → loading spinner during fetch
5. **Clear search** → restores full product list

## Flow 3: Filter by Category

1. **Cashier taps category** in sidebar
2. **filterByCategory(categoryId)** → fetchProducts({ categoryId, page: 1 })
3. **Products filtered** → only matching products shown
4. **Tap "All"** → filterByCategory(null) resets filter

## Flow 4: Product Variants

1. **Cashier taps product with variants** → VariantPicker modal opens
2. **Option filters shown** → e.g. Size: S/M/L, Color: Red/Blue
3. **Select options** → variant list narrows to matching variants
4. **Select variant** → adds to basket with variant-specific price, SKU, barcode
5. **Inventory shown** → inventoryQuantity displayed per variant

## Flow 5: Pagination (Large Catalogs)

1. **Initial load** → first 50–100 products fetched
2. **Scroll to bottom** → hasMore check (currentPage < totalPages)
3. **loadMore()** → fetches next page, appends to existing list
4. **Cursor-based (Shopify)** → uses nextCursor instead of page number
5. **All loaded** → hasMore becomes false, no more fetches

## Flow 6: Product Sync to Platform

1. **Local product changes** → new products or inventory updates
2. **syncProducts(products)** → sends batch to platform API
3. **Platform creates/updates** → maps local data to platform format
4. **SyncResult returned** → { successful: N, failed: M, errors: [...] }
5. **Errors logged** → productId + error message for each failure

## Questions

- How are product images optimized for mobile display?
- How does the system handle product deletions on the platform?
- What validation occurs before syncing products to platforms?
- How are product categories kept in sync across platforms?
