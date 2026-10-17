# Sale Catalogue — Rules

**Parent:** [rules.md](rules.md)
**Files:** `hooks/useSaleCatalog.ts`, `hooks/useSearch.ts`,
`hooks/useAddToBasket.ts`, `screens/sale/{CategoryBar,CategoryButton,
ProductGrid,ProductCard,SearchResults,Omnibar}.tsx`,
`components/VariantPicker.tsx`, `utils/{categorySelection,categoryFilter,
sellability}.ts` | **Tests:** all three utils tested

---

## R1 — Category navigation is a drill-down state machine

**Rule**
Selection = `{rootId, subId, drillParentId}` (see shared-libs sale-domain R2).
`CategoryBar` renders per `categoryMode` from `getSaleLayout`: `merged` (one
strip) on phone-landscape, `strips` (two rows) on phone, `wrapped` elsewhere.
`effectiveCategoryId` filters the grid.

**Evidence** — `utils/categorySelection.ts`,
`contexts/CategoryProvider.tsx`, `screens/sale/CategoryBar.tsx`.

🟢 **E1.1** — "All Products" → full grid; tap root → children row; tap leaf →
filtered; "‹ parent" steps back.
🟠 **E1.2** — leaf re-tap → parent's "All"; parent re-tap → un-drill.

## R2 — Category product filtering is service-side where possible

**Rule**
Leaf on a service-filtering platform → `serviceCategory` to the product
service; subtree or Sylius/Wix/PrestaShop → client-side `matches` over the
subtree (ids + name match on productType/tags). Cache avoids a full-grid
spinner per category switch.

**Evidence** — `utils/categoryFilter.ts`, `hooks/useSaleCatalog.ts`; spec
Phase 1 (no full-grid spinner).

🟢 **E2.1** — leaf on Shopify → service filter; no client refilter flicker.
🟠 **E2.2** — subtree on Shopify → client-side subtree match (see
shared-libs R3 caveat: name/text matching approximates).

## R3 — Search is debounced, stale-guarded, Enter-adds

**Rule**
`useSearch` issues platform search; a stale-request guard prevents an older
in-flight response overwriting a newer query. `SearchResults` Enter/row-tap
adds via `useAddToBasket` (sellability still applies).

**Evidence** — `hooks/useSearch.ts`, `useSaleCatalog.ts`,
`screens/sale/SearchResults.tsx`.

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

**Evidence** — `hooks/useAddToBasket.ts:38`, `utils/sellability.ts`,
`utils/platformIds.ts`, `components/VariantPicker.tsx`.

🟢 **E4.1** — "Tee — Red / L" adds with Red/L price+SKU.
🔴 **E4.2** — out-of-stock variant → greyed, not addable.
🟠 **E4.3** — product with variants but no selection → picker forced; scan of
the product SKU resolves to the default variant.

## R5 — Product grid density follows the layout class

**Rule**
`productColumns(density)` per class; `large|compact|text` modes;
`maxFontSizeMultiplier` caps text scaling; out-of-stock tiles show a badge
and are not addable.

**Evidence** — `utils/responsive.utils.ts`, `screens/sale/ProductGrid.tsx`,
`ProductCard.tsx`.

## ❓ Questions

- **Q1** — client-side subtree match by `productType`/tag name can
  over-include products sharing a name — intended approximation or should it
  be id-only?

## Coverage

`categorySelection/categoryFilter/sellability` → dedicated tests;
search/hooks → not found.
