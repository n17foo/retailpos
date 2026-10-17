# Sale (Basket & Checkout)

## Purpose

The register's core surface: build a basket fast (tiles, categories, search,
barcode scan — HID and camera, variants, quantities), tender it through
fast-path checkout, and survive interruptions, failures, and offline
operation. One unified screen serves phone, tablet, desktop, Electron, and
web; the old `Scan`/`Search` tabs no longer exist.

## Scope

### Included

- Sale screen + `SaleProvider` composition (one shared `useSaleScreen` state).
- Catalogue browsing: category drill-down, product grid densities, search.
- Scanning: HID burst handling, camera overlay, dedup, variant resolution.
- Basket: line ops, qty clamping, notes, customer, loyalty/store-credit
  plumbing (existing — redesign deferred).
- Checkout: draft creation, tenders, split payment, retry-after-failure,
  manager approval threshold, receipt printing.
- Sale mode (`counter|pickup|delivery`), state chip, main-menu actions.
- Offline-first persistence and interruption recovery of the basket/draft.

### Excluded

- Discount & loyalty **redesign** — deliberately deferred (only the existing
  loyalty/store-credit plumbing is retained for tender compatibility).
- Order history, returns/refunds, exchanges — order-domain features.
- Product/inventory management — catalogue management features.
- Peripheral configuration — settings feature (scanner/printer _use_ is here).

## Entry Points

- `Sale` tab in `MainTabNavigator` (tab bar **hidden** on this screen; the
  sale surface owns the whole viewport).
- Resume after interruption: app relaunch with a persisted draft → the
  "Resume checkout" banner in the basket reopens checkout on the same order.
- Deep-nested features: Exchange/Refund entries inside `MainMenu` (role +
  capability gated).

## Feature Flow

```
Sale tab
   ▼
SaleProvider → useSaleScreen (single instance)
   ├─ useSaleCatalog   categories + products + search (+ stale-request guard)
   ├─ useSaleScanner   connectForSale (ref-counted) → resolve → addUnit
   ├─ useCheckout      draft/order lifecycle + tenders + retry
   ├─ loyalty/basket   shared with CheckoutModal
   ├─ layout           getSaleLayout(w,h) → phone|phone-landscape|tablet|desktop|wide
   ├─ blockers         stock/printer/drawer/customer gates → saleState chip
   └─ reset            post-payment UI reset

Add paths ── tile tap / variant pick / scan / search Enter
   └─► useAddToBasket.addUnit — sellability + clamp + variant mapping
         └─► BasketService → BasketRepository (SQLite, survives restart)

Tender ── CASH/CARD/⋯
   └─► useCheckout.handleStartCheckout — reuse open draft or create
         └─► CheckoutModal → completePayment
               ├─ success → receipt + reset
               └─ failure → revertToDraft → retryable
```

## Implementation Map

| Layer        | Responsibility               | Implementation                                                                                                                                                      |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Screens      | Orchestration, shells        | `screens/SaleScreen.tsx`                                                                                                                                            |
| Screens      | Sale UI                      | `screens/sale/{TopBar,Omnibar,CategoryBar,CategoryButton,ProductGrid,ProductCard,SearchResults,BasketPanel,BasketBar,TenderBar,MainMenu,ScanNoticeBar}.tsx`         |
| Components   | Modal/sheet/scan/picker      | `components/{CheckoutModal,BottomSheet,CameraScanOverlay,VariantPicker,HidCaptureField,BasketBlockers}.tsx`                                                         |
| Contexts     | Single sale state            | `contexts/SaleProvider.tsx` (+Basket/Category/Checkout providers)                                                                                                   |
| Hooks        | Composition + domains        | `hooks/use{SaleScreen,SaleCatalog,SaleScanner,Checkout,AddToBasket,Search,LoyaltyBasket}.ts`                                                                        |
| Services     | Basket/order/payment/scanner | `services/basket/BasketService.ts`, `services/checkout/CheckoutService.ts`, `services/scanner/ScannerServiceFactory.ts`, `services/payment/*`, `services/printer/*` |
| Repositories | Persistence                  | `repositories/{BasketRepository,OrderRepository,OfflineOrderRepository,OrderItemRepository}.ts`                                                                     |
| Libs         | Pure rules                   | `utils/{sellability,categorySelection,categoryFilter,hidBurst,responsive.utils,orderStateMapper,money,platformCapabilities,platformIds}.ts`                         |
| Locales      | UI text                      | `locales/*` (`sale.*`, `basket.*`, `checkout.*`)                                                                                                                    |
| Docs         | Spec + ADR                   | this feature doc, `docs/adr/ADR-017-*` (original EARS spec retired)                                                                                                 |

## State Ownership

| State                            | Owner                               | Persistence                   | Reset condition          |
| -------------------------------- | ----------------------------------- | ----------------------------- | ------------------------ |
| Composed sale state              | `SaleProvider`/`useSaleScreen`      | Memory                        | Screen unmount           |
| Basket + items + note + saleMode | `BasketRepository`                  | SQLite `baskets` (items JSON) | Order completion / clear |
| Draft/pending order              | `CheckoutService`→`OrderRepository` | SQLite `orders`/`order_items` | Payment, cancel, resume  |
| Category selection               | `CategoryProvider`                  | Memory                        | Reset on sale reset      |
| Scanner connection               | `ScannerServiceFactory` ref-count   | Hardware                      | Last consumer release    |
| Search results                   | `useSearch`                         | Memory                        | Query change             |
| Loyalty/store-credit             | `useLoyaltyBasket`                  | SQLite ledgers                | Sale completion          |
| Sale blockers / saleState        | `useSaleScreen`                     | Derived                       | Per render               |
| Unsynced count                   | `CheckoutProvider`                  | Derived from orders           | Sync                     |

## Dependencies

- `utils/sellability.ts` — D1 stock gate on every add path.
- `utils/responsive.utils.ts` `getSaleLayout` — shell choice.
- `utils/categorySelection.ts`, `categoryFilter.ts` — category rules.
- `utils/hidBurst.ts` — shared burst detector (scanner services + HidCaptureField).
- `utils/orderStateMapper.ts` — top-bar state chip.
- `utils/platformCapabilities.ts` — D4 gating (basketMode, discounts…).
- `platformCapabilityService`, `posConfig` — modes, thresholds, note chips,
  scan dedup, store address (tax destination).
- Services: payment terminals, printer (receipt/reprint/shift report), tax
  resolver, instore-api (multi-register), sync.
- Auth: `ManagerApprovalService` for high-value checkout.

## Side Effects

- Basket/order rows persist on every mutation — sales survive restarts.
- Payment attempts create/move orders (draft→pending→processing→paid/failed).
- Receipt/reprint printing; cash-drawer open on cash tender.
- Order sync queue entries; platform draft/cart creation for `native_draft`/
  `remote_cart` platforms at checkout start.
- Scanner hardware subscription for the sale's lifetime.
- Audit events on manager approvals and payment outcomes.

## Module Docs

Cross-cutting rules live in `rules.md`; deep behaviour is split into one
doc per area:

| Doc                          | Covers                                                                 |
| ---------------------------- | ---------------------------------------------------------------------- |
| [catalogue.md](catalogue.md) | categories, search, variants, product grid, scan→product resolution    |
| [basket.md](basket.md)       | line ops, quantity, notes, customer, blockers, loyalty/credit plumbing |
| [checkout.md](checkout.md)   | draft/order lifecycle, tenders, split, retry, approval, receipt        |
| [scanning.md](scanning.md)   | HID burst, ref-counted connection, dedup, camera, resolution           |
