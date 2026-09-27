# Basket – Shopping Cart EARS Requirements

> **System**: RetailPOS – Basket & Checkout  
> **Actor**: Cashier  
> **Date**: 2026-04-12  
> **Source**: `services/basket/BasketService.ts`, `services/basket/basket.ts`, `services/basket/BasketServiceInterface.ts`, `services/checkout/CheckoutService.ts`, `services/order/order.ts`, `repositories/BasketRepository.ts`, `contexts/BasketProvider.tsx`, `screens/order/BasketContent.tsx`, `screens/order/Basket.tsx`

---

## Context

The basket is the in-progress order before payment. It is persisted to SQLite via `BasketRepository` so it survives app restarts. `BasketService` owns cart CRUD only — checkout, payment, and sync are handled by `CheckoutService` and `OrderSyncService` respectively.

`BasketProvider` wraps the entire app and exposes the basket state and all cart operations to UI components. Two UI surfaces consume it: `BasketContent` (desktop sidebar / tablet inline) and `Basket` (mobile swipeable panel). Both share the same context but differ in UX — `Basket` uses `Alert` dialogs and integrates `usePayment` for terminal flows; `BasketContent` uses inline error handling and a simpler payment path.

All monetary arithmetic uses `utils/money.ts` (integer-cent internally) to avoid floating-point errors. Tax rates stored on `BasketItem` at add-to-cart time are used for local basket totals display. The checkout mode depends on the platform's `basketMode` capability:

- **`native_draft`** (Shopify, Wix, Commercefull): the authoritative tax calculation happens when the draft order is created on the platform at checkout time — the platform's returned totals replace the basket estimates.
- **`remote_cart`** (WooCommerce, Magento, BigCommerce, Sylius, PrestaShop): the POS basket is authoritative; the platform order is created post-payment by `OrderSyncService`.
- **`local_only`** (Squarespace, Offline): fully local basket; order imported to platform after payment. For offline mode, the per-item `taxRate` stored at add-to-cart time remains authoritative throughout.

### Actors

| Actor   | Role                                                                                     |
| ------- | ---------------------------------------------------------------------------------------- |
| Cashier | Adds/removes products, adjusts quantities, attaches customer, triggers checkout          |
| System  | Persists basket to SQLite, recalculates totals, creates orders, clears basket on payment |

### Basket State Machine

| State        | Transition                                                                              |
| ------------ | --------------------------------------------------------------------------------------- |
| `empty`      | `addItem()` → `has_items`                                                               |
| `has_items`  | `removeItem()` / `updateItemQuantity(0)` → `empty` (if last item removed)               |
| `has_items`  | `startCheckout()` → `LocalOrder` created, status `draft` (online) / `pending` (offline) |
| `draft`      | `cancelDraftOrder()` → back to `has_items`, basket intact                               |
| `draft`      | `markPaymentProcessing()` → status `processing`                                         |
| `pending`    | `markPaymentProcessing()` → status `processing`                                         |
| `processing` | `completePayment()` success → basket cleared, status `paid`                             |
| `processing` | `completePayment()` failure → status `failed`, basket preserved                         |
| `any`        | `cancelOrder()` → status `cancelled`, basket preserved                                  |

### Key Defaults

| Field                 | Default                                      | Source                                        |
| --------------------- | -------------------------------------------- | --------------------------------------------- |
| `taxable` on new item | `true`                                       | `BasketProvider.addToCart`                    |
| `taxRate` on new item | `DEFAULT_TAX_RATE()` or product-carried rate | `BasketProvider.addToCart`                    |
| `discountAmount`      | `0` (on apply)                               | `BasketService.applyDiscount`                 |
| `drawerOpenOnCash`    | `false`                                      | `POSConfigService`                            |
| `DEFAULT_TAX_RATE()`  | Emergency fallback only                      | `BasketService.calculateTotals` (catch block) |

---

## 1. Ubiquitous Requirements

**1.1** The system shall persist the basket to SQLite via `BasketRepository.updateBasket()` after every item add, remove, quantity change, discount, customer, or note operation.

**1.2** The system shall recalculate `subtotal`, `tax`, and `total` after every item add, remove, or quantity change using `calculateTotals()`.

**1.3** The system shall compute `subtotal` as the sum of `price × quantity` across all items using `multiplyMoney` and `sumMoney`.

**1.4** The system shall compute `tax` by summing, for each item where `taxable === true`, the tax contribution derived from that item's `taxRate` field; if `taxRate` is undefined the system shall fall back to `DEFAULT_TAX_RATE()`.

**1.5** The system shall compute `total` as `max(0, roundMoney(subtotal + tax - discountAmount))`.

**1.6** The system shall reuse an existing active basket across app restarts by calling `BasketRepository.findActiveBasket()` on initialisation.

**1.7** The system shall clear the basket only after `CheckoutService.completePayment()` returns `success: true` — never before.

**1.8** The system shall record every order creation to `AuditLogService` with action `order:created`, including cashier ID, cashier name, item count, and total.

**1.9** The system shall record every completed payment to `AuditLogService` with action `order:paid`, including order ID and payment method.

**1.10** The system shall record every cancelled order to `AuditLogService` with action `order:cancelled`, including order ID.

**1.11** The `taxRate` stored on each `BasketItem` is used for local basket total estimates. For `native_draft` orders, the platform draft order response at checkout time is the authoritative tax source and overwrites these estimates. For `remote_cart` and `local_only` orders, the per-item `taxRate` remains authoritative throughout the order lifecycle.

**1.12** Each `BasketItem` shall carry a sellable-unit snapshot at add-to-cart time: `variantId` (platform sellable unit id), `sku`, `optionSummary`, `taxCode`, `taxProfileId`, `taxRate`, `taxable`, `inventoryPolicy`, and `catalogVersion`. This snapshot is persisted to `order_items` so receipts and refunds remain accurate even if the platform catalog changes later.

The correct sellable unit by platform:

| Platform    | Sellable unit stored in `variantId`                       |
| ----------- | --------------------------------------------------------- |
| Shopify     | `ProductVariant.id`                                       |
| WooCommerce | variation id for variable products; omitted for simple    |
| Magento     | concrete simple SKU selected through configurable options |
| BigCommerce | variant id (maps to SKU + inventory)                      |
| Sylius      | `productVariantCode`                                      |
| Wix         | variant id                                                |
| PrestaShop  | combination id                                            |
| Squarespace | `ProductVariant.id`                                       |
| Offline     | local product id                                          |

---

## 2. Event-Driven Requirements

### 2.1 Basket Initialisation

**2.1.1** When `BasketService.initialize()` is called, the system shall call `getOrCreateBasket()` to load or create the active basket.

**2.1.2** When `BasketRepository.findActiveBasket()` returns a row, the system shall deserialise `items` from JSON and return the existing basket.

**2.1.3** When `BasketRepository.findActiveBasket()` returns `null`, the system shall create a new basket row with a `generateUUID()` ID, `items = '[]'`, and all totals at `0`.

**2.1.4** When `BasketProvider` mounts, the system shall call `getServiceContainer()`, then `basketService.getBasket()` and `checkoutService.getUnsyncedOrders()`, and set `isLoading` to `false` when both resolve.

### 2.2 Add Item

**2.2.1** When `addItem()` is called and an existing basket item has the same `productId` and `variantId`, the system shall increment that item's `quantity` by the incoming `quantity` rather than creating a new line.

**2.2.2** When `addItem()` is called and no matching `productId` + `variantId` combination exists, the system shall push a new `BasketItem` with a `generateUUID()` ID and the provided fields.

**2.2.3** When `BasketProvider.addToCart()` is called, the system shall pass `productId: product.id`, `variantId: product.variantId`, `sku: product.sku`, `taxable: product.taxable ?? true`, and `originalId: product.originalId || product.platformId` to `basketService.addItem()`.

**2.2.4** When `addItem()` completes, the system shall call `recalculateAndSave()` and return the updated basket to the caller.

**2.2.5** When `BasketProvider.addToCart()` is called, the system shall pass the product's `taxRate` (if available) to `basketService.addItem()` for use in local basket total estimates.

**2.2.6** When no `taxRate` is available on the product, `BasketService.calculateTotals()` shall fall back to `DEFAULT_TAX_RATE()` for that item's tax contribution.

### 2.3 Update Quantity

**2.3.1** When `updateItemQuantity(itemId, quantity)` is called with `quantity > 0`, the system shall set the matching item's `quantity` to the new value and call `recalculateAndSave()`.

**2.3.2** When `updateItemQuantity(itemId, quantity)` is called with `quantity ≤ 0`, the system shall remove the item from `basket.items` and call `recalculateAndSave()`.

**2.3.3** When `BasketProvider.incrementQuantity(itemId)` is called, the system shall call `updateQuantity(itemId, item.quantity + 1)`.

**2.3.4** When `BasketProvider.decrementQuantity(itemId)` is called, the system shall call `updateQuantity(itemId, item.quantity - 1)`.

### 2.4 Remove Item

**2.4.1** When `removeItem(itemId)` is called, the system shall delegate to `updateItemQuantity(itemId, 0)`.

**2.4.2** When the cashier taps the decrement button in `BasketContent` and `currentQuantity <= 1`, the system shall call `removeFromCart(itemId)` directly without a confirmation dialog.

**2.4.3** When the cashier taps the decrement button in `Basket` (mobile panel) and `currentQuantity <= 1`, the system shall show an `Alert.alert` confirmation dialog before calling `removeFromCart(itemId)`.

**2.4.4** When the cashier taps the delete icon in `BasketContent`, the system shall call `removeFromCart(itemId)` immediately without a confirmation dialog.

### 2.5 Apply / Remove Discount

**2.5.1** When `applyDiscount(code)` is called, the system shall set `basket.discountCode = code` and `basket.discountAmount = 0`, update `updatedAt`, and persist to SQLite without recalculating totals.

**2.5.2** When `removeDiscount()` is called, the system shall clear `basket.discountCode` and `basket.discountAmount` and call `recalculateAndSave()`.

### 2.6 Attach Customer

**2.6.1** When `setCustomer(email, name)` is called, the system shall set `basket.customerEmail` and `basket.customerName`, update `updatedAt`, and persist to SQLite.

**2.6.2** When `setCustomer(undefined, undefined)` is called, the system shall clear `basket.customerEmail` and `basket.customerName` and persist to SQLite.

**2.6.3** When the cashier selects a customer in `CustomerSearchModal`, `BasketContent` shall call `setCustomer(customer.email, [firstName, lastName].join(' '))` and close the modal.

**2.6.4** When the cashier taps the remove customer button in `BasketContent`, the system shall call `setCustomer(undefined, undefined)`.

### 2.7 Add Note

**2.7.1** When `setNote(note)` is called, the system shall set `basket.note`, update `updatedAt`, and persist to SQLite.

### 2.8 Checkout — Start

**2.8.1** When the cashier taps "Complete Order" in `BasketContent` or `Basket`, the system shall call `startCheckout(platform)`.

**2.8.2** When `startCheckout()` is called, `CheckoutService` shall read the current basket, create a `LocalOrder` with status `draft` (online platforms) or `pending` (offline), persist it via `OrderRepository.create()`, persist all items via `OrderItemRepository.createMany()`, and log `order:created` to `AuditLogService`.

**2.8.3** When `startCheckout()` returns a `LocalOrder`, `BasketContent` and `Basket` shall store the `order.id` in local state and open `CheckoutModal`.

### 2.9 Checkout — Payment

**2.9.1** When the cashier selects a payment method in `CheckoutModal`, the system shall call `markPaymentProcessing(orderId)` to set the order status to `processing`.

**2.9.2** When the selected payment method is `'cash'`, both `BasketContent` and `Basket` shall call `completePayment(orderId, 'cash')` directly without going through `usePayment`.

**2.9.3** When the selected payment method is `'terminal'`, both `BasketContent` and `Basket` shall call `processPayment()` via `usePayment` before calling `completePayment()`. This option is only presented when `paymentMode === 'tap_to_pay'` (mobile/tablet with an active SDK provider). If `processPayment()` fails, the system shall call `cancelOrder(orderId)` and close the modal so the cashier can restart with a different method.

**2.9.4** When `completePayment()` returns `success: true`, the system shall call `basketService.clearBasket()`, log `order:paid`, and return `{ success: true, orderId, openDrawer }`.

**2.9.5** When `completePayment()` returns `success: true` and `openDrawer === true`, `BasketContent` and `Basket` shall call `cashDrawerServiceFactory.getService().open()` (fire-and-forget).

**2.9.6** When `completePayment()` returns `success: true`, `BasketContent` shall close `CheckoutModal`, clear `currentOrderId`, and call `onCheckout?.()`.

**2.9.7** When `completePayment()` returns `success: true`, `Basket` shall additionally close the swipeable panel (`setIsRightPanelOpen(false)`) and call `onPrintReceipt?.(orderId)` if provided.

**2.9.8** When `completePayment()` returns `success: false`, `Basket` shall show an `Alert.alert` with the error message. `BasketContent` silently sets `isProcessing` to `false` (error handled by context).

### 2.10 Cancel Order

**2.10.1** When the cashier taps cancel in `CheckoutModal`, the system shall close the modal, clear `currentOrderId`, and call `cancelOrder(orderId)`.

**2.10.2** When `cancelOrder(orderId)` is called, `CheckoutService` shall update the order status to `cancelled` and log `order:cancelled` to `AuditLogService`.

**2.10.3** When `cancelOrder()` is called, the basket shall remain intact — it is not cleared on cancellation.

### 2.11 Clear Basket

**2.11.1** When `clearBasket()` is called, `BasketRepository.clearBasket()` shall reset `items` to `'[]'`, `subtotal`, `tax`, and `total` to `0`, and clear `discount_amount` and `discount_code` — but preserve the basket row (status remains `active`).

**2.11.2** When `BasketProvider.clearCart()` is called directly, the system shall call `basketService.clearBasket()` and then `refreshBasket()`.

### 2.12 Sync Pending Orders

**2.12.1** When the cashier taps the sync banner in `BasketContent`, the system shall call `syncAllPendingOrders()` and refresh `unsyncedOrdersCount`.

**2.12.2** When the cashier taps the sync banner in `Basket`, the system shall call `syncAllPendingOrders()` and show an `Alert.alert` with the sync result (synced count, failed count, or "no orders to sync").

**2.12.3** When `syncAllPendingOrders()` completes, the system shall call `refreshUnsyncedCount()` to update the badge.

---

## 3. State-Driven Requirements

**3.1** While `isLoading` is `true` in `BasketProvider`, both `BasketContent` and `Basket` shall render an `ActivityIndicator` with a "Loading basket..." label.

**3.2** While `cartItems` is empty and `isLoading` is `false`, `BasketContent` shall render the empty state (cart icon, "Your cart is empty", "Tap a product to add it").

**3.3** While `cartItems` is empty and `isLoading` is `false`, `Basket` shall render the empty cart text and disable the "Complete Order" button.

**3.4** While `cartItems.length === 0` or `isProcessing` is `true`, both `BasketContent` and `Basket` shall disable the "Complete Order" / checkout button and apply `buttonDisabled` opacity style.

**3.5** While `isProcessing` is `true`, both `BasketContent` and `Basket` shall render an `ActivityIndicator` inside the checkout button in place of the label.

**3.6** While `basket.customerEmail` is set, `BasketContent` shall render the customer badge showing `customerName || customerEmail`, the email (if name is also set), and a remove button.

**3.7** While `basket.customerEmail` is not set, `BasketContent` shall render the "Add Customer" button.

**3.8** While `unsyncedOrdersCount > 0`, both `BasketContent` and `Basket` shall render the sync banner with the pending count.

**3.9** While `isSyncing` is `true`, both `BasketContent` and `Basket` shall disable the sync banner tap and show an `ActivityIndicator` alongside the label.

**3.10** While a `CartItem` has a non-empty `sku`, both `BasketContent` and `Basket` shall render the SKU below the item name.

**3.11** While `checkoutModalVisible` is `true`, the `CheckoutModal` shall be rendered with `isProcessing` forwarded from local state.

---

## 4. Optional Feature Requirements

**4.1** Where `posConfig.values.drawerOpenOnCash` is `true` and the payment method is `'cash'`, the system shall set `openDrawer: true` in the `CheckoutResult` and the UI shall call `cashDrawerServiceFactory.getService().open()`.

**4.2** Where `paymentMode === 'tap_to_pay'` and `isTerminalConnected()` returns `true` in `Basket`, the system shall pass `terminalConnected={true}` to `CheckoutModal`, enabling the terminal payment option.

**4.3** Where `onPrintReceipt` is provided to `Basket`, the system shall call it with the completed `orderId` after successful payment.

---

## 5. Unwanted Behaviour / Edge Cases

### 5.1 Empty Basket Checkout

**5.1.1** If `startCheckout()` is called when `basket.items` is empty, then `CheckoutService` shall throw `'Cannot checkout with empty basket'` and `BasketProvider` shall set `error` to the error message.

**5.1.2** If the cashier taps "Complete Order" when `cartItems.length === 0`, then the button shall be disabled and `handleStartCheckout` / `handleCheckout` shall return immediately.

### 5.2 Service Not Initialised

**5.2.1** If any basket operation is called before `containerRef.current` is set, then `BasketProvider` shall return immediately (for void operations) or return a failure result (for `completePayment`).

**5.2.2** If `BasketService.initialize()` throws, then `BasketProvider` shall set `error` to the error message and `isLoading` to `false`.

### 5.3 Payment Failure

**5.3.1** If `completePayment()` throws or returns `success: false`, then `CheckoutService` shall update the order status to `failed` and return `{ success: false, orderId, error }`.

**5.3.2** If `processPayment()` returns `success: false` in `Basket`, then the system shall show an `Alert.alert` with the error message and shall not call `completePayment()`.

**5.3.3** If `completePayment()` fails, the basket shall not be cleared — `clearBasket()` is only called inside the success branch of `CheckoutService.completePayment()`.

### 5.4 Quantity Edge Cases

**5.4.1** If `decrementQuantity(itemId)` is called and the item's current quantity is `1`, then `updateQuantity(itemId, 0)` shall be called, which removes the item via `updateItemQuantity(itemId, 0)`.

**5.4.2** If `updateItemQuantity(itemId, quantity)` is called with an `itemId` that does not exist in `basket.items`, then the basket shall be recalculated and saved unchanged.

### 5.5 Discount Edge Cases

**5.5.1** If `applyDiscount(code)` is called, the `discountAmount` is set to `0` as a placeholder — the actual discount value is not validated or applied to totals until an external service resolves the code.

**5.5.2** If `removeDiscount()` is called when no discount is active, the system shall still call `recalculateAndSave()` with `discountAmount = undefined`, resulting in no change to totals.

### 5.6 Basket Persistence Failure

**5.6.1** If `BasketRepository.updateBasket()` throws during any cart operation, then `BasketService` shall propagate the error and `BasketProvider` shall set `error` to the error message.

**5.6.2** If `BasketRepository.findActiveBasket()` throws during `getOrCreateBasket()`, then `BasketService` shall log the error and re-throw it.

### 5.7 Cancel with No Order

**5.7.1** If `handleCancelCheckout()` is called in `BasketContent` or `Basket` when `currentOrderId` is `null`, the system shall close the modal and return without calling `cancelOrder()`.

---

## 6. Complex Requirements

**6.1** When `completePayment()` returns `success: true` while `posConfig.values.drawerOpenOnCash` is `true` and `paymentMethod === 'cash'`, the system shall simultaneously clear the basket, log `order:paid`, set `openDrawer: true` in the result, and the UI shall fire-and-forget `cashDrawerServiceFactory.getService().open()`.

**6.2** When `startCheckout()` is called while `basket.customerEmail` is set, the system shall copy `customerEmail` and `customerName` from the basket into the `LocalOrder` and persist them to `OrderRepository`, ensuring customer association is preserved in the order record.

**6.3** When `addItem()` is called with a `productId` + `variantId` combination that already exists in the basket while `quantity > 1`, the system shall add the incoming quantity to the existing item's quantity (not replace it), then recalculate and save.

**6.4** When `BasketProvider.completePayment()` returns `success: true`, the system shall simultaneously call `refreshBasket()` (to reflect the cleared basket in UI), `refreshUnsyncedCount()` (to update the sync badge), and set `currentOrder` to `null`.

---

## 7. Basket Lifecycle Summary

### Add to basket flow

```
Cashier taps product
  → ProductGrid.handleCardPress / handleVariantSelect
  → useOrderScreen.handleAddToCart(id, quantity, variantId?)
  → BasketProvider.addToCart(CartProduct, quantity)
    → basketService.addItem({
        productId, variantId, name, price, quantity,
        taxable: product.taxable ?? true,
        taxRate: product.taxRate,          ← carried from product (offline: from taxProfileId lookup,
        ...                                   online: from platform product data)
      })
    → duplicate check (productId + variantId)
    → increment OR push new item
    → recalculateAndSave()
      → calculateTotals()
          subtotal = Σ (price × quantity)
          tax      = Σ (item.taxable ? calculateTax(lineTotal, item.taxRate ?? DEFAULT_TAX_RATE()) : 0)
          total    = max(0, subtotal + tax - discountAmount)
      → BasketRepository.updateBasket()
  → setBasket(newBasket) → UI re-renders
```

### Checkout flow

```
Cashier taps "Complete Order"
  → useCheckout.handleStartCheckout()
    → BasketProvider.startCheckout(platform)
      → CheckoutService.startCheckout(platform, cashierId, cashierName)
        ── native_draft (Shopify, Wix, Commercefull) ────────────────────
        → OrderServiceFactory.getService(platform).createDraftOrder()
            → platform returns { platformOrderId, subtotal, tax, total, lineItems[].taxRate }
            → status = 'draft'
            → [on failure] fall back to basket totals, status = 'pending'
        ── remote_cart (Woo, Magento, BigCommerce, Sylius, PrestaShop) ──
        → use basket totals + BasketItem.taxRate values, status = 'pending'
        ── local_only (Squarespace, Offline) ────────────────────────────
        → use basket totals + BasketItem.taxRate values, status = 'pending'
        → OrderRepository.create()
        → OrderItemRepository.createMany()
        → AuditLogService.log('order:created')
  → BasketProvider.currentOrder = LocalOrder
  → CheckoutModal opens with platform-confirmed totals

Cashier selects payment method (useCheckout.handlePayment)
  → markPaymentProcessing(orderId) → status: processing
  → [terminal — only on mobile/tablet with tap_to_pay mode] processPayment() via usePayment
      → [failure] cancelOrder(orderId) → modal closes, basket intact, cashier retries
  → completePayment(orderId, paymentMethod, transactionId?)
      → OrderRepository.updatePayment()
      → [online] orderService.completeOrder(platformOrderId, paymentMethod)
      → BasketService.clearBasket()
      → AuditLogService.log('order:paid')
      → return { success, orderId, openDrawer }
  → [if openDrawer] cashDrawerServiceFactory.getService().open()
  → refreshBasket() + refreshUnsyncedCount()
  → CheckoutModal closes

Cashier cancels / returns to basket (useCheckout.handleCancelCheckout)
  → [status === 'draft'] cancelDraftOrder() → platform draft deleted, local row deleted
  → [status === 'processing'] cancelOrder() → status: cancelled
  → currentOrder = null, basket intact
```

### Basket persistence

| Operation            | SQLite call                       | Totals recalculated |
| -------------------- | --------------------------------- | ------------------- |
| `addItem`            | `BasketRepository.updateBasket()` | Yes                 |
| `updateItemQuantity` | `BasketRepository.updateBasket()` | Yes                 |
| `removeItem`         | `BasketRepository.updateBasket()` | Yes                 |
| `applyDiscount`      | `BasketRepository.updateBasket()` | No (amount = 0)     |
| `removeDiscount`     | `BasketRepository.updateBasket()` | Yes                 |
| `setCustomer`        | `BasketRepository.updateBasket()` | No                  |
| `setNote`            | `BasketRepository.updateBasket()` | No                  |
| `clearBasket`        | `BasketRepository.clearBasket()`  | N/A (reset to 0)    |

---

## 8. Component Traceability

| Requirement (summary)                                  | Component / Hook / Service                                                                      | Source File                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Basket initialised on provider mount                   | `BasketProvider` useEffect → `getServiceContainer`                                              | `contexts/BasketProvider.tsx`                                 |
| Active basket loaded from SQLite                       | `BasketService.getOrCreateBasket` → `BasketRepository.findActiveBasket`                         | `services/basket/BasketService.ts`                            |
| New basket created when none found                     | `BasketService.getOrCreateBasket` → `BasketRepository.createBasket`                             | `services/basket/BasketService.ts`                            |
| Duplicate item → quantity increment                    | `BasketService.addItem` (existingIndex check)                                                   | `services/basket/BasketService.ts`                            |
| New item pushed with UUID                              | `BasketService.addItem` → `generateUUID()`                                                      | `services/basket/BasketService.ts`                            |
| CartProduct mapped to BasketItem fields                | `BasketProvider.addToCart`                                                                      | `contexts/BasketProvider.tsx`                                 |
| taxRate passed through from product to BasketItem      | `BasketProvider.addToCart` → `basketService.addItem(taxRate)`                                   | `contexts/BasketProvider.tsx`                                 |
| Totals recalculated after every mutation               | `BasketService.recalculateAndSave` → `calculateTotals`                                          | `services/basket/BasketService.ts`                            |
| Tax applied per-item using stored taxRate              | `BasketService.calculateTotals` (per-item taxRate branch)                                       | `services/basket/BasketService.ts`                            |
| Basket persisted to SQLite                             | `BasketService.updateBasketInDb` → `BasketRepository.updateBasket`                              | `services/basket/BasketService.ts`                            |
| Increment quantity                                     | `BasketProvider.incrementQuantity` → `updateQuantity(id, qty+1)`                                | `contexts/BasketProvider.tsx`                                 |
| Decrement quantity                                     | `BasketProvider.decrementQuantity` → `updateQuantity(id, qty-1)`                                | `contexts/BasketProvider.tsx`                                 |
| Remove item (quantity ≤ 0)                             | `BasketService.updateItemQuantity` (filter branch)                                              | `services/basket/BasketService.ts`                            |
| Decrement → remove (no confirm) in BasketContent       | `BasketContent.handleDecrement` (qty ≤ 1 → removeFromCart)                                      | `screens/order/BasketContent.tsx`                             |
| Decrement → Alert confirm in Basket                    | `Basket.handleDecrement` (qty ≤ 1 → Alert.alert)                                                | `screens/order/Basket.tsx`                                    |
| Customer attached to basket                            | `BasketService.setCustomer` → `BasketRepository.updateBasket`                                   | `services/basket/BasketService.ts`                            |
| Customer selected via modal                            | `BasketContent.handleSelectCustomer` → `setCustomer`                                            | `screens/order/BasketContent.tsx`                             |
| Customer removed                                       | `BasketContent.handleRemoveCustomer` → `setCustomer(undefined)`                                 | `screens/order/BasketContent.tsx`                             |
| Discount code stored (no validation)                   | `BasketService.applyDiscount`                                                                   | `services/basket/BasketService.ts`                            |
| Discount removed + totals recalculated                 | `BasketService.removeDiscount` → `recalculateAndSave`                                           | `services/basket/BasketService.ts`                            |
| Order created from basket snapshot (draft or pending)  | `CheckoutService.startCheckout` → `createDraftOrder()` (online) or basket totals (offline)      | `services/checkout/CheckoutService.ts`                        |
| Platform draft order created                           | `CheckoutService.startCheckout` → `OrderServiceFactory.getService(platform).createDraftOrder()` | `services/checkout/CheckoutService.ts`                        |
| Platform draft cancelled on return to basket           | `useCheckout.handleCancelCheckout` → `cancelDraftOrder()`                                       | `hooks/useCheckout.ts`                                        |
| Terminal payment failure → cancelOrder + retry         | `useCheckout.handlePayment` (failure branch → `cancelOrder`)                                    | `hooks/useCheckout.ts`                                        |
| Order items persisted                                  | `CheckoutService.startCheckout` → `OrderItemRepository.createMany`                              | `services/checkout/CheckoutService.ts`                        |
| Order creation audited                                 | `CheckoutService.startCheckout` → `auditLogService.log('order:created')`                        | `services/checkout/CheckoutService.ts`                        |
| Order status → processing                              | `CheckoutService.markPaymentProcessing` → `OrderRepository.updateStatus`                        | `services/checkout/CheckoutService.ts`                        |
| Payment completed + basket cleared                     | `CheckoutService.completePayment` → `basketService.clearBasket`                                 | `services/checkout/CheckoutService.ts`                        |
| Payment audited                                        | `CheckoutService.completePayment` → `auditLogService.log('order:paid')`                         | `services/checkout/CheckoutService.ts`                        |
| Cash drawer opened on cash payment                     | `useCheckout.handlePayment` → `cashDrawerServiceFactory.getService().open()`                    | `hooks/useCheckout.ts`                                        |
| Terminal payment via usePayment (both surfaces)        | `useCheckout.handlePayment` → `processPayment()`                                                | `hooks/useCheckout.ts`, `hooks/usePayment.ts`                 |
| Payment mode resolved (device + provider)              | `usePayment.getPaymentMode()` → `useCheckout` → `CheckoutModal`                                 | `hooks/usePayment.ts`, `hooks/useCheckout.ts`                 |
| Order cancelled                                        | `CheckoutService.cancelOrder` → `OrderRepository.updateStatus`                                  | `services/checkout/CheckoutService.ts`                        |
| Cancellation audited                                   | `CheckoutService.cancelOrder` → `auditLogService.log('order:cancelled')`                        | `services/checkout/CheckoutService.ts`                        |
| Basket cleared (row preserved, items reset)            | `BasketRepository.clearBasket` (UPDATE not DELETE)                                              | `repositories/BasketRepository.ts`                            |
| Unsynced count refreshed after payment                 | `BasketProvider.completePayment` → `refreshUnsyncedCount`                                       | `contexts/BasketProvider.tsx`                                 |
| Sync banner tapped → sync all pending                  | `BasketContent.handleSyncOrders` / `Basket.handleSyncOrders`                                    | `screens/order/BasketContent.tsx`, `screens/order/Basket.tsx` |
| cartItemsMap keyed by productId for ProductGrid lookup | `BasketProvider.cartItemsMap` memo                                                              | `contexts/BasketProvider.tsx`                                 |
| itemCount = sum of all item quantities                 | `BasketProvider.itemCount` memo                                                                 | `contexts/BasketProvider.tsx`                                 |
