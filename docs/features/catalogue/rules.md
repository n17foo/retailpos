# Catalogue — Rules

**Files:** `features/catalogue/hooks/useSaleCatalog.ts`, `shared/hooks/useSearch.ts`,
`features/basket/hooks/useAddToBasket.ts`, `features/catalogue/components/{CategoryBar,CategoryButton,ProductGrid,ProductCard,SearchResults,Omnibar,VariantPicker}.tsx`,
`features/catalogue/utils/{categorySelection,categoryFilter,sellability}.ts` | **Tests:** all utils, hooks, and components tested

---

## R1 — Category navigation is a drill-down state machine

**Rule**
Selection = `{rootId, subId, drillParentId}`.
`CategoryBar` renders per `categoryMode` from `getSaleLayout`: `merged` (one
strip) on phone-landscape, `strips` (two rows) on phone, `wrapped` elsewhere.
`effectiveCategoryId` filters the grid.

**Evidence** — `features/catalogue/utils/categorySelection.ts`,
`features/catalogue/contexts/CategoryProvider.tsx`, `features/catalogue/components/CategoryBar.tsx`.

🟢 **E1.1** — "All Products" → full grid; tap root → children row; tap leaf →
filtered; "‹ parent" steps back.
🟠 **E1.2** — leaf re-tap → parent's "All"; parent re-tap → un-drill.

## R2 — Category product filtering is service-side where possible

**Rule**
Leaf on a service-filtering platform → `serviceCategory` to the product
service; subtree or Sylius/Wix/PrestaShop → client-side `matches` over the
subtree (ids + name match on productType/tags). Cache avoids a full-grid
spinner per category switch.

**Evidence** — `features/catalogue/utils/categoryFilter.ts`, `features/catalogue/hooks/useSaleCatalog.ts`.

🟢 **E2.1** — leaf on Shopify → service filter; no client refilter flicker.
🟠 **E2.2** — subtree on Shopify → client-side subtree match.

## R3 — Search is debounced, stale-guarded, Enter-adds

**Rule**
`useSearch` issues platform search; a stale-request guard prevents an older
in-flight response overwriting a newer query. `SearchResults` Enter/row-tap
adds via `useAddToBasket` (sellability still applies).

**Evidence** — `shared/hooks/useSearch.ts`, `features/catalogue/hooks/useSaleCatalog.ts`,
`features/catalogue/components/SearchResults.tsx`.

🟢 **E3.1** — type "cof" → results; type faster → "coffee" results replace
even if the "cof" request resolved last.
🔴 **E3.2 — Not found** — quiet scan/search notice, never an alert.

## R4 — Variants resolve through `isVariantSellable` + variant-specific data

**Rule**
`VariantPicker` lists variants; only sellable ones add. `toBasketProduct`
preserves the **variant's** price, SKU, tax code, taxability, and option
summary — never the product-level defaults. The synthetic `'default'`
variant (single-variant products) maps to `undefined` at the platform
boundary.

**Evidence** — `features/basket/hooks/useAddToBasket.ts`, `features/catalogue/utils/sellability.ts`,
`shared/utils/platformIds.ts`, `features/catalogue/components/VariantPicker.tsx`.

🟢 **E4.1** — "Tee — Red / L" adds with Red/L price+SKU.
🔴 **E4.2** — out-of-stock variant → greyed, not addable.
🟠 **E4.3** — product with variants but no selection → picker forced; scan of
the product SKU resolves to the default variant.

## R5 — Product grid density follows the layout class

**Rule**
`productColumns(density)` per class; `large|compact|text` modes;
`maxFontSizeMultiplier` caps text scaling; out-of-stock tiles show a badge
and are not addable.

**Evidence** — `shared/utils/responsive.utils.ts`, `features/catalogue/components/ProductGrid.tsx`,
`features/catalogue/components/ProductCard.tsx`.

## Coverage

`categorySelection`, `categoryFilter`, `sellability`, `useSaleCatalog`, `useProducts`, `useCategories`, `useOfflineProducts`, `useOfflineCategories`, and all 7 catalogue components have dedicated unit tests.
