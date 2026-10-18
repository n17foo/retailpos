# ADR-017: Sale Screen Fast-Path Architecture

**Date**: 2026-06-14
**Status**: Accepted
**Deciders**: Engineering Team

## Context

The original sale screen was built around bottom-tab navigation (Sale / Scan / Search / Inventory / More), a floating SearchBar, category screens reached by navigation, and three overlapping status components (`Header`, `SalesStatusHeader`, `QuickActionsMenu`). Every hardware scan left the sale screen (`scannedProductId` route params), basket lines were edited one way on touch and another on desktop, and scanning could interleave keystrokes into focused inputs.

The requirements in the original sales fast-path EARS spec (since retired into docs/features/sale/) call for a sale flow optimised for taps-per-item: one surface for catalogue, categories, scan and search; no navigation to reach any product; and identical business logic across phone, tablet and desktop.

## Decision

**The sale screen is the full-screen home of the app.** Catalogue browsing, barcode scanning, search, basket editing and tendering all happen in place — navigation is only used for secondary destinations reached through the ☰ menu.

### Key structural decisions

1. **Merged top bar** (`features/checkout/components/TopBar.tsx`)
   One bar carries the menu button, register/cashier identity, the omnibar, the sync badge, the cash-drawer warning and the sale-state chip. The bottom tab bar is hidden on the Sale route; `MainMenu` (drawer) replaces the More tab and wires real handlers only (reprint, shift report, sync, lock, logout).

2. **Omnibar** (`features/catalogue/components/Omnibar.tsx`)
   One field does typed search, SKU/barcode entry and scanner focus. Results replace the catalogue grid in place (`SearchResults`); Enter adds the single/exact match (`submitSearch` in `useSaleCatalog`). `useSearch` drops results from superseded requests so a slow platform search can never overwrite a newer query.

3. **Persistent category buttons** (`features/catalogue/components/CategoryBar.tsx`, `features/catalogue/utils/categorySelection.ts`)
   Row 1 is always `All` + root categories; row 2 shows the selected root's children and drills one level at a time via a pure, unit-tested state machine (`CategorySelectionState` / `getSubRow` / `goUp`). The sale always opens on "All Products" (D2).

4. **One basket component for every device class** (`features/basket/components/BasketPanel.tsx`)
   In the split shell it is the permanent right column; in the stacked (phone) shell it lives inside a `BottomSheet` opened by the sticky `BasketBar`. Line selection shows a ≥44px action strip (qty, note, remove); swipe-left removes on touch, Delete/Backspace removes the selected line in pointer mode. `TenderBar` (CASH / CARD / ⋯) is pinned at its bottom.

5. **Scanner core** (`features/scanning/utils/hidBurst.ts`, `features/scanning/hooks/useSaleScanner.ts`, `features/scanning/components/HidCaptureField.tsx`, `features/scanning/components/CameraScanOverlay.tsx`)
   A shared, pure `HidBurstDetector` identifies machine-speed keystroke bursts and lets USB/Electron services swallow them before they reach text inputs. On native, a hidden always-focused `HidCaptureField` receives HID input; it only takes focus when no real input owns it. `ScannerServiceFactory.connectForSale` keeps one ref-counted connection for the life of the sale screen, so scans keep working while sheets and the checkout modal are open. Scans resolve loaded-catalogue → local variant DB → platform barcode search, and surface as inline `ScanNoticeBar` banners, never blocking dialogs.

6. **Responsive shells** (`shared/utils/responsive.utils.ts` → `getSaleLayout`)
   Layout class is derived from window width AND height (never the device model): `phone` (stacked), `phone-landscape`, `tablet`, `desktop`, `wide` (split). Tile density (`large`/`compact`/`text`) is driven by catalogue image coverage unless `posConfig.values.saleDensity` overrides it.

7. **Fast-path tender** (`features/checkout/hooks/useCheckout.ts`, `features/checkout/components/CheckoutModal.tsx`)
   `TenderBar` passes the picked tender into `CheckoutModal.initialTender`: `cash` opens straight into the cash keypad (physical keyboard types the amount); `card` fires a connected terminal immediately. The platform draft is created in parallel with the modal opening, and a failed payment reverts the order to draft (`CheckoutService.revertToDraft`) so it can be retried.

8. **Single sale hook instance** (`features/checkout/hooks/useSaleScreen.ts` via `features/checkout/contexts/SaleProvider.tsx`)
   `useSaleScreen` composes `useSaleCatalog` (categories, products, search, add paths), `useSaleScanner` (scan lifecycle), `useCheckout` (payment orchestration) and `useLoyaltyBasket` exactly once; every sale component reads the shared result through `useSale()`. Per-line notes persist through `BasketService.updateItemProperties` into the basket JSON blob.

### Deletions

`Header`, `SalesStatusHeader`, `QuickActionsMenu`, `SearchBar`, `Category`, `CategoryList`, `Basket`, `BasketContent`, `SwipeablePanel`, `Breadcrumb`, `PanelStateProvider`, `SearchScreen`, `BarcodeScannerScreen` and `useBarcodeScanner` were removed; the Scan/Search tabs and the `scannedProductId`/`scannedCode`/`scanNonce` route params are gone.

## Consequences

- Taps-per-item drops to 1 for grid products, 0 for scans, and checkout opens pre-routed to the picked tender.
- Scanner bursts can no longer corrupt focused input on any platform.
- One code path serves every device class — there is no second "mobile" sale flow to maintain.
- The active order remains the single source of truth; draft persistence and `InterruptionBanner` recovery are unchanged.
- Discount/loyalty redesign (D11) is intentionally deferred; existing coupon/credit/loyalty behaviour is preserved as-is.

## Alternatives considered

- **Keeping bottom tabs and adding the omnibar alongside**: rejected — two search entries and a persistent tab bar contradict the "one surface" principle and cost vertical space on phones.
- **A separate mobile basket flow**: rejected — one `BasketPanel` in a sheet guarantees identical semantics and halves the testing surface.
