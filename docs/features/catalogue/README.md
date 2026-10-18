# Catalogue

## Purpose

Product and category browsing, category drill-down navigation, omnibar search, variant selection, and multi-platform + offline product/category services and repositories.

## Scope

### Included

- `CategoryBar` and `CategoryButton` — persistent category navigation (`strips`, `wrapped`, `merged` modes).
- `ProductGrid` and `ProductCard` — density-aware (`large`, `compact`, `text`) product tiles with basket quantity badges and stock indicators.
- `Omnibar` and `SearchResults` — unified search/barcode input and live search results list.
- `VariantPicker` — modal sheet for selecting product options and variants.
- `CategoryProvider` context and catalogue hooks (`useSaleCatalog`, `useProducts`, `useCategories`, `useOfflineProducts`, `useOfflineCategories`).
- `ProductServiceFactory` and `CategoryServiceFactory` + 9 platform adapters (`Shopify`, `WooCommerce`, `BigCommerce`, `Magento`, `Sylius`, `Wix`, `PrestaShop`, `Commercefull`, `Offline`).
- `ProductRepository`, `ProductVariantRepository`, `CategoryRepository` (SQLite).
- Pure domain utilities: `categorySelection.ts`, `categoryFilter.ts`, `sellability.ts`.

### Excluded

- Cart line storage and totals — `basket` feature.
- Checkout and payment tendering — `checkout` feature.
- Hardware/camera barcode capture — `scanning` feature.

## Entry Points

- `CategoryBar`, `ProductGrid`, `SearchResults`, and `Omnibar` mounted on `SaleScreen`.
- `useOfflineProducts` and `useOfflineCategories` consumed by `Settings → Offline Management` and `Onboarding → Offline Setup`.
- `useProductsForDisplay` (`features/catalogue/hooks/useProducts.ts`) consumed by `InventoryScreen`, `BarcodeLabelScreen`, `ReorderPointConfigScreen`, and `TransferOrdersScreen`.

## Implementation Map

| Layer        | Responsibility                                                          | Implementation                                                                                                               |
| ------------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Components   | Categories, product grid/tiles, omnibar, search results, variant picker | `features/catalogue/components/{CategoryBar,CategoryButton,ProductGrid,ProductCard,SearchResults,Omnibar,VariantPicker}.tsx` |
| Contexts     | Category drill-down state                                               | `features/catalogue/contexts/CategoryProvider.tsx`                                                                           |
| Hooks        | Catalogue composition, online/offline products & categories             | `features/catalogue/hooks/use{SaleCatalog,Products,Categories,OfflineProducts,OfflineCategories}.ts`                         |
| Services     | Product & category factories + 9 platform adapters                      | `features/catalogue/services/{product,category}/**`                                                                          |
| Repositories | Local SQLite products, variants, categories                             | `features/catalogue/repositories/{ProductRepository,ProductVariantRepository,CategoryRepository}.ts`                         |
| Utils        | Category selection state machine, category filtering, sellability rules | `features/catalogue/utils/{categorySelection,categoryFilter,sellability}.ts`                                                 |

## State Ownership

| State                                                   | Owner                          | Persistence                                | Reset condition           |
| ------------------------------------------------------- | ------------------------------ | ------------------------------------------ | ------------------------- |
| Category selection (`rootId`, `subId`, `drillParentId`) | `CategoryProvider`             | Memory                                     | Sale reset / unmount      |
| Loaded products & category cache                        | `useSaleCatalog`               | Memory + SQLite (`products`, `categories`) | Platform change / refresh |
| Search query & results                                  | `useSaleCatalog` / `useSearch` | Memory                                     | Query clear / sale reset  |
