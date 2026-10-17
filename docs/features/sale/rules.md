# Sale — Rules

Top-level rules of the unified sale surface. Deep behaviour lives in the
module docs: [catalogue.md](catalogue.md), [basket.md](basket.md),
[checkout.md](checkout.md), [scanning.md](scanning.md).

**Spec history:** the original sales-screen EARS spec (Phases 0–6, D1–D11) was retired into this doc; see `docs/adr/ADR-017-*`
**ADR:** `docs/adr/ADR-017-sale-screen-fast-path.md`

---

## R1 — One unified surface replaces Scan/Search; layout decides the shell

**Rule**
No `Scan`/`Search` tabs exist; the `Sale` tab hides the tab bar and renders
everything (omnibar, categories, grid, basket). `getSaleLayout(w,h)` picks the
class: `phone` → **stacked** (catalogue full-width + `BasketBar` + `BottomSheet`
basket); `phone-landscape`/`tablet`/`desktop`/`wide` → **split** (catalogue
left, persistent `BasketPanel` right).

**Evidence** — `navigation/MainTabNavigator.tsx`, `screens/SaleScreen.tsx`,
`utils/responsive.utils.ts`; spec §4.8, D2.

🟢 **E1.1** — 390×844 → stacked; `BasketBar` opens the sheet.
📱 **E1.2 — Rotation** — 844×390 → `phone-landscape` split (h<500, w≥568).
🔴 **E1.3** — references to deleted routes/components must not exist —
verified; `PanelStateProvider`, `BarcodeScannerScreen`, `SearchScreen` deleted.

## R2 — A single `useSaleScreen` instance feeds every child

**Rule**
`SaleProvider` composes catalog+scanner+checkout+loyalty+layout+blockers;
children consume via `useSale()` — `BasketPanel`/`CheckoutModal` must not
create their own instance (the old duplication bug this design removes).

**Evidence** — `contexts/SaleProvider.tsx`, `hooks/useSaleScreen.ts`; spec
Phase 0.

🟢 **E2.1** — tender button in `TenderBar` and basket totals both read the
same basket/order from one hook instance.

## R3 — One active order per register; no hold/park

**Rule**
Exactly one basket → one draft/pending order at a time (D3). No hold/park
feature exists by design.

**Evidence** — `hooks/useCheckout.ts:78`, `services/checkout/CheckoutService.ts`;
spec D3.

🟢 **E3.1** — starting checkout on a basket with an open draft **reuses** it,
never creates a duplicate.
🔴 **E3.2** — no UI path can suspend a second sale.

## R4 — Stock rules are identical on every add path (D1)

**Rule**
Tile, variant picker, scan, search Enter — all funnel through
`useAddToBasket.addUnit` → `isVariantSellable`/`getAvailableQuantity`.
Tracked+0 → never sellable; untracked → sellable if `isAvailable`;
`allowBackorder` ignored. Quantity can't exceed tracked availability.

**Evidence** — `hooks/useAddToBasket.ts`, `utils/sellability.ts`; spec D1.

🟢 **E4.1** — scan an out-of-stock SKU → not added, non-blocking notice
(no alert — spec: not-found/blocked scans use `ScanNoticeBar`).
🟠 **E4.2** — tracked quantity 3, tap tile 4× → 4th add clamped/blocked.

## R5 — All Products is the default view; no favourites (D2)

**Rule**
Category selection starts `null` ("All Products"); no pinning/top-seller
logic anywhere.

**Evidence** — `utils/categorySelection.ts` (`EMPTY_SELECTION`); spec D2.

## R6 — Behaviour is capability-driven (D4) and config-driven

**Rule**
Nothing business-specific is hardcoded: `platformCapabilities` decide basket
mode/tax/discount/giftcard paths; `posConfig.values` decide `saleModes`,
`saleNoteChips`, `saleScanDedupMs`, manager-approval threshold, tile density.

**Evidence** — `utils/platformCapabilities.ts`,
`services/config/POSConfigService.ts`; spec D4/D5.

🟢 **E6.1** — `saleModes = ['counter']` → mode chip hidden; `>1` → chip in
`TopBar` cycles modes (persisted via `sale_mode` column, schema v11).
🟠 **E6.2** — platform `basketMode`: `native_draft` → platform draft at
checkout start (platform tax); `remote_cart` → remote cart; `local_only`
(offline) → local tax via `OfflineTaxResolver` + `posConfig` storeAddress.

## R7 — The basket survives interruption; checkout is resumable

**Rule**
Basket rows and drafts persist in SQLite on every mutation. App relaunch with
an open draft → "Resume checkout" banner; tapping it reopens `CheckoutModal`
on the same order. On phone, picking a tender inside the basket sheet closes
the sheet so checkout is unobstructed.

**Evidence** — `repositories/BasketRepository.ts`,
`hooks/useCheckout.ts:525` (`isDraftPending`), `screens/SaleScreen.tsx`,
`hooks/useInterruptionRecovery.ts`, `components/InterruptionBanner.tsx`.

`useInterruptionRecovery` (mounted by `SaleScreen`) detects four states on
every relevant state change, in **priority order**:
`interrupted-payment` (current order `status === 'processing'`) →
`interrupted-checkout` (order `draft`) → `draft-sale` (basket non-empty,
no order) → `unsynced` (`unsyncedOrdersCount > 0`). Each maps to a banner
message + action set (`SaleScreen.getInterruptionActions`); dismissing sets
`dismissed` for the session only.

📱 **E7.1 — Kill mid-checkout** → relaunch → banner → same order, no duplicate.
📱 **E7.2 — Phone tender flow** → tender in sheet → sheet closes → modal.
🟠 **E7.3 — Priority masking** — a `processing` order _and_ a non-empty basket
→ only the payment banner shows; the draft is reachable after resolving it.
🟠 **E7.4 — Dismissed banner reappears on next state change** — `dismissed` is
component state; a new `basketItems`/`currentOrder` change re-evaluates.

## R8 — Keyboard & accessibility are first-class (Phase 6)

**Rule**
Pointer mode: `Cmd+K`/`/` focuses the omnibar, omnibar `autoFocus` on mount;
basket `↑↓` select a line, `Delete`/`Backspace` removes it; physical keyboard
types cash amounts in `CheckoutModal`; all controls are `Pressable` with
`interactionStyle` rings and ≥ `hitTarget` sizes; `maxFontSizeMultiplier`
caps sale-surface text scaling.

**Evidence** — `screens/sale/*`, `components/{CheckoutModal,HidCaptureField,
BottomSheet}.tsx`, `utils/theme.ts`, `BasketPanel.tsx` key handler.

## R9 — Loyalty/store-credit plumbing kept, redesign deferred

**Rule**
Existing loyalty points/store-credit redemption still works as a tender/adder
in `BasketPanel`/`CheckoutModal` via shared `useLoyaltyBasket` state — but the
D11 redesign (coupons as platform-validated, tenders don't reduce tax) is
explicitly **not done**; do not build on this plumbing.

**Evidence** — `hooks/useLoyaltyBasket.ts`, `BasketPanel` + `CheckoutModal`
shared `loyalty` prop; spec D11 + user directive.

⚠️ **C1 — Planned divergence** — the current plumbing applies credit/loyalty
as basket adjustments, which the deferred redesign will replace; treat as
legacy, not the intended model.

## ❓ Open Questions

- **Q1** — D10 online platforms: `sale` spec wants store-location read from
  the platform at onboarding/refresh — not implemented (offline `storeAddress`
  only). Where should online tax destination live?
- **Q2** — `preparing-checkout`/`paid` sale states exist in the union but are
  never produced — dead by design or missing transitions (shared-libs PG1)?

## ⚠️ Potential Gaps

- **PG1** — `preparing-checkout`/`paid` dead states (orderStateMapper).
- **PG2** — Real-device validation pending: camera scanning, Electron HID,
  physical scanner timing, terminal/receipt flows.
- **PG3** — Loyalty/store-credit plumbing predates D11 — may reduce tax or
  apply discounts contrary to the intended tender model.
- **PG4** — `useLoyaltyBasket` balances are in-memory during sale; a crash
  mid-redemption relies on ledger reconciliation — verify reversal path.

## Test Coverage Mapping

| Area                            | Coverage                                                |
| ------------------------------- | ------------------------------------------------------- |
| categorySelection state machine | `utils/categorySelection.test.ts`                       |
| categoryFilter                  | `utils/categoryFilter.test.ts`                          |
| HID burst                       | `utils/hidBurst.test.ts`                                |
| sellability                     | `utils/sellability.test.ts`                             |
| layout                          | `utils/responsive.utils.test.ts`                        |
| basket service                  | `services/basket/BasketService.test.ts`, `…tax.test.ts` |
| checkout service                | `services/checkout/CheckoutService.test.ts`             |
| row mapping                     | `utils/orderRow.utils.test.ts`                          |
| end-to-end sale flows           | Not found (no screen-level suites)                      |

---

## Feature Context Summary

**Feature** — Sale (Basket & Checkout)
**Responsibility** — Fast basket building (tile/category/search/scan/variant),
fast-path tendering with retryable failure, offline-first draft persistence,
on every device class.
**Entry Points** — `Sale` tab (tab bar hidden); "Resume checkout" banner on
relaunch; Exchange/Refund via `MainMenu`.
**Core Rules** — R1 unified surface + layout shell; R2 single sale state;
R3 one order, no hold; R4 stock gate everywhere; R5 All-Products default;
R6 capability/config-driven; R7 resumable checkout; R8 keyboard/a11y;
R9 loyalty plumbing is legacy.
**Primary Happy Path** — browse/scan → addUnit (sellable) → tender → draft →
pay → receipt → reset.
**Critical Unhappy Paths** — payment failure → `revertToDraft` + retry;
blockers gate checkout; not-found scans are quiet notices.
**Important Edge Cases** — qty clamp; scan dedup; interrupted-checkout resume;
single-mode hides chip; phone sheet closes on tender.
**Offline Behaviour** — Full path: local catalogue/basket/draft/order →
sync queue → `sync-pending` state chip; offline tax from `storeAddress`.
**Lifecycle Behaviour** — basket/draft survive restart; scanner stays
connected through modals; post-payment reset restores catalogue focus.
**State Ownership** — composed `useSaleScreen` (memory) over SQLite
baskets/orders; hardware refs in factory; ledgers in SQLite.
**Dependencies** — sellability/responsive/category/HID/orderState utils;
Basket/Checkout/Scanner/Printer/Payment services; posConfig; capability svc.
**Side Effects** — SQLite mutations per action; order state transitions;
receipts; drawer kicks; sync queue; token warmup unrelated.
**Open Questions** — Q1 online tax destination; Q2 dead sale states.
**Potential Gaps** — PG1 dead states; PG2 device validation; PG3 legacy
loyalty semantics; PG4 crash mid-redemption.
**Contradictions** — C1 loyalty/store-credit semantics vs deferred D11 model.
