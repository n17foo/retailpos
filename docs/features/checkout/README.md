# Checkout & Register Sale Surface

## Purpose

Orchestrates the main register screen (`SaleScreen`, `TopBar`, `MainMenu`, `InterruptionBanner`, `SaleProvider`) and drives the checkout lifecycle: draft order creation, fast-path cash/card tendering (`TenderBar`, `CheckoutModal`), split payments, manager approval thresholds, platform/local tax calculation, receipt printing, and interruption recovery.

## Scope

### Included

- `SaleScreen` + `SaleProvider` + `useSaleScreen` — unified register screen composing `catalogue`, `basket`, `scanning`, and `checkout`.
- `TopBar`, `MainMenu`, `InterruptionBanner`, and `useInterruptionRecovery`.
- `TenderBar` (`Cash`, `Card`, `⋯`) and `CheckoutModal` (method selection, cash keypad with quick tenders, and split-tender workflow).
- `CheckoutProvider`, `useCheckout`, `CheckoutService`, `taxQuote`, and `orderStateMapper`.

### Excluded

- Cart CRUD and line-item persistence — `basket` feature.
- Product/category browsing and search — `catalogue` feature.
- Barcode/camera scanning — `scanning` feature.
- Post-sale order history, sync queue, and returns/exchanges — `orders-sync` and `returns` features.

## Entry Points

- `Sale` tab in `MainTabNavigator` (renders `SaleScreen`).
- `TenderBar` buttons in `BasketPanel` (`Cash`, `Card`, `⋯`) → `useCheckout.handleStartCheckout` → `CheckoutModal`.
- `InterruptionBanner` on `SaleScreen` → resumes draft sale, interrupted checkout, or interrupted payment.

## Implementation Map

| Layer      | Responsibility                                                  | Implementation                                                                                  |
| ---------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Screens    | Register surface & responsive shell                             | `features/checkout/screens/SaleScreen.tsx`                                                      |
| Components | Checkout modal, tender bar, top bar, menu, interruption banner  | `features/checkout/components/{CheckoutModal,TenderBar,TopBar,MainMenu,InterruptionBanner}.tsx` |
| Contexts   | Checkout context & composed sale context                        | `features/checkout/contexts/{CheckoutProvider,SaleProvider}.tsx`                                |
| Hooks      | Checkout lifecycle, register composition, interruption recovery | `features/checkout/hooks/use{Checkout,SaleScreen,InterruptionRecovery}.ts`                      |
| Services   | Checkout state transitions & tax quote application              | `features/checkout/services/{CheckoutService,CheckoutServiceInterface,taxQuote}.ts`             |
| Utils      | Top-bar sale state mapper                                       | `features/checkout/utils/orderStateMapper.ts`                                                   |

## State Ownership

| State                   | Owner                                 | Persistence                     | Reset condition                     |
| ----------------------- | ------------------------------------- | ------------------------------- | ----------------------------------- |
| Composed register state | `SaleProvider` / `useSaleScreen`      | Memory                          | Screen unmount / post-payment reset |
| Draft / pending order   | `CheckoutService` → `OrderRepository` | SQLite `orders` / `order_items` | Payment, cancel, resume             |
| Split payment lines     | `useCheckout`                         | Memory + order payment lines    | Checkout completion / cancel        |
| Unsynced orders count   | `CheckoutProvider`                    | Derived from `orders`           | Sync completion                     |
