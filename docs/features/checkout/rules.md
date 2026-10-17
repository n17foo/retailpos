# Checkout & Register Sale Surface — Rules

**ADR:** `docs/adr/ADR-017-sale-screen-fast-path.md`
**Files:** `features/checkout/screens/SaleScreen.tsx`, `features/checkout/components/{CheckoutModal,TenderBar,TopBar,MainMenu,InterruptionBanner}.tsx`, `features/checkout/contexts/{CheckoutProvider,SaleProvider}.tsx`, `features/checkout/hooks/use{Checkout,SaleScreen,InterruptionRecovery}.ts`, `features/checkout/services/{CheckoutService,taxQuote}.ts`, `features/checkout/utils/orderStateMapper.ts` | **Tests:** `CheckoutService.test.ts`, `CheckoutService.tax.test.ts`, `taxQuote.test.ts`, `useCheckout.test.ts`, `useSaleScreen.test.ts`, `useInterruptionRecovery.test.ts`, `SaleScreen.test.tsx`, `CheckoutModal.test.tsx`, `TenderBar.test.tsx`, `TopBar.test.tsx`, `MainMenu.test.tsx`, `InterruptionBanner.test.tsx`

---

## R1 — One unified surface replaces Scan/Search; layout decides the shell

**Rule**
No `Scan`/`Search` tabs exist; the `Sale` tab hides the tab bar and renders
everything (omnibar, categories, grid, basket). `getSaleLayout(w,h)` picks the
class: `phone` → **stacked** (catalogue full-width + `BasketBar` + `BottomSheet`
basket); `phone-landscape`/`tablet`/`desktop`/`wide` → **split** (catalogue
left, persistent `BasketPanel` right).

**Evidence** — `app/navigation/MainTabNavigator.tsx`, `features/checkout/screens/SaleScreen.tsx`,
`shared/utils/responsive.utils.ts`.

## R2 — A single `useSaleScreen` instance feeds every child

**Rule**
`SaleProvider` composes catalog+scanner+checkout+loyalty+layout+blockers;
children consume via `useSale()` — `BasketPanel`/`CheckoutModal` must not
create their own instance.

**Evidence** — `features/checkout/contexts/SaleProvider.tsx`, `features/checkout/hooks/useSaleScreen.ts`.

## R3 — Tenders are fast paths into one checkout flow

**Rule**
`TenderBar` = `CASH` / `CARD` / `⋯`: cash → cash step (exact/quick amounts +
keyboard entry on pointer); card → terminal/tap-to-pay; `⋯` → method
selector (split, store credit, loyalty). All pre-open a draft (`initialStep`)
so payment is one confirmation away.

**Evidence** — `features/checkout/components/TenderBar.tsx`, `features/checkout/hooks/useCheckout.ts`,
`features/checkout/components/CheckoutModal.tsx`.

## R4 — Draft creation is parallel and resumable; `isDraftPending` guards

**Rule**
`handleStartCheckout` reuses an open `draft|pending` order instead of
duplicating; `isDraftPending = modal open && !currentOrder` disables payment
actions until the draft exists.

**Evidence** — `features/checkout/hooks/useCheckout.ts`, `CheckoutService.startCheckout`.

## R5 — Failed payment reverts to draft and stays retryable

**Rule**
`markPaymentProcessing` → failure → `revertToDraft(orderId)` so the order
returns to draft and checkout stays open; cancel goes `cancelOrder`
(unpaid)/`cancelDraftOrder`.

**Evidence** — `features/checkout/hooks/useCheckout.ts`, `CheckoutService.revertToDraft`.

## R6 — High-value checkout can demand manager approval

**Rule**
Totals above `posConfig` threshold gate through `ManagerApprovalService`
before payment proceeds.

**Evidence** — `features/checkout/hooks/useCheckout.ts`, `features/authentication/services/permissions/ManagerApprovalService.ts`.

## R7 — Split tender must sum to the total (cents-exact)

**Rule**
Split rows (cash/terminal/store-credit/loyalty when a customer is attached)
validate in integer cents via `shared/utils/money.ts`; each line is removable until
the remaining balance is met.

**Evidence** — `features/checkout/components/CheckoutModal.tsx` split step, `shared/utils/money.ts`.

## R8 — Online platforms compute tax at checkout; offline computes locally

**Rule**
Online (`native_draft`/`remote_cart`) → platform returns authoritative
tax/totals at `startCheckout` (basket shows "tax at checkout"); offline →
`OfflineTaxResolver` + `posConfig` `storeAddress`.

**Evidence** — `CheckoutService`, `BasketPanel` `taxAtCheckout` flag, `posConfig.storeAddress`.

## R9 — Completion prints a receipt, recovers from interruptions, and resets the sale

**Rule**
`completePayment` → order `paid` → receipt via `UnifiedPrinterService`
(includes `saleMode`) → post-payment reset → catalogue back to "All
Products". `useInterruptionRecovery` detects `interrupted-payment` → `interrupted-checkout` → `draft-sale` → `unsynced` in priority order.

**Evidence** — `features/checkout/hooks/useCheckout.ts`, `features/checkout/hooks/useInterruptionRecovery.ts`, `features/checkout/components/InterruptionBanner.tsx`.
