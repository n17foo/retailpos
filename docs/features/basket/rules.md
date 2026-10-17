# Basket — Rules

**Files:** `features/basket/components/{BasketPanel,BasketBar,BasketBlockers}.tsx`,
`features/basket/services/BasketService.ts`, `features/basket/contexts/{BasketStateProvider,BasketActionsProvider}.tsx`,
`features/basket/hooks/{useAddToBasket,useLoyaltyBasket}.ts`, `features/basket/repositories/BasketRepository.ts`,
`shared/utils/money.ts` | **Tests:** `BasketService.test.ts`, `BasketService.tax.test.ts`, `BasketPanel.test.tsx`, `BasketBar.test.tsx`, `BasketBlockers.test.tsx`, `useAddToBasket.test.ts`, `useLoyaltyBasket.test.ts`

---

## R1 — The basket is persisted on every mutation

**Rule**
Items, note, customer, `saleMode` live in the `baskets` row (items as JSON,
`items_json` plus domain columns). Every service call writes — nothing is
session-only.

**Evidence** — `features/basket/services/BasketService.ts`,
`features/basket/repositories/BasketRepository.ts`, `shared/utils/dbSchema.ts` (v11 `sale_mode`).

📱 **E1.1** — kill mid-sale → restart → basket + note + mode restored.
🟠 **E1.2** — `items_json` is the source of truth for lines; denormalised
columns (subtotal/tax/total) are recomputed by `BasketService` — divergence
would show stale totals (guarded by recompute-on-write).

## R2 — Quantity is clamped to tracked availability; decrement→0 removes

**Rule**
`incrementQuantity`/`decrementQuantity` go through `BasketService` with
`clampToAvailable`; tapping `−` at qty 1 removes the line.

**Evidence** — `features/catalogue/utils/sellability.ts:28`, `BasketService`,
`features/basket/components/BasketPanel.tsx`.

🟢 **E2.1** — stock 3, `+`×4 → 4th blocked (sellability gate).
🟢 **E2.2** — `−` at qty 1 → line removed + selection cleared.

## R3 — Selected line exposes an action strip (≥48px targets)

**Rule**
Tap a line → selected (actions: `−`,`+`, note, remove); swipe-left removes on
touch; pointer `Delete`/`Backspace` removes, `↑↓` moves selection;
last-added line flashes ~1.2s.

**Evidence** — `features/basket/components/BasketPanel.tsx` (keyboard effect + flash +
`PanResponder` swipe), `hitTarget` tokens.

## R4 — Notes exist at line and order level; chips are config-driven

**Rule**
`BasketItem.properties` hold a line note; `basket.note` the order note.
`saleNoteChips` (`posConfig`) render quick-chips in the line-note editor —
empty array → no chips.

**Evidence** — `BasketService.setLineProperties`,
`BasketActionsProvider`, `BasketPanel` chip row, `posConfig.values.saleNoteChips`.

🟢 **E4.1** — chips `["no onion","gift"]` → tap fills the line note, editor
closes.

## R5 — Blockers gate checkout; `needs-attention` shows on the state chip

**Rule**
`useSaleScreen` derives `blockers` (warning/error/info); only non-`info`
blockers gate — shown via `BasketBlockers` and the `needs-attention` state.

**Evidence** — `features/checkout/hooks/useSaleScreen.ts`, `features/basket/components/BasketBlockers.tsx`,
`features/checkout/utils/orderStateMapper.ts`.

🔴 **E5.1** — discount without customer → blocker → checkout disabled.
🟠 **E5.2** — info-level blocker → chip still `building`, tender allowed.

## R6 — Loyalty/store-credit act as basket adjustments (legacy plumbing)

**Rule**
With a customer attached, `useLoyaltyBasket` shows balances; redeem applies a
basket-level adjustment (legacy semantics — D11 redesign deferred). Reversal
on sale cancel.

**Evidence** — `features/basket/hooks/useLoyaltyBasket.ts`, `BasketPanel`/`CheckoutModal`
shared `loyalty` prop.

🟠 **E6.1** — redeem points → basket total reduced; semantics (pre-/post-tax)
follow the _old_ model, not the intended tender model — flagged for redesign.

## Coverage

`BasketService`, tax paths, `useAddToBasket`, `useLoyaltyBasket`, `BasketPanel`, `BasketBar`, and `BasketBlockers` all have dedicated unit tests.
