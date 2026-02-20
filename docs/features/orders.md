# Orders

## User Story

**As a** retail cashier  
**I want to** build customer orders, apply discounts, and check out  
**So that** transactions are recorded locally and synced to the e-commerce platform

## Rules

- Order screen: 3-panel layout on desktop/tablet (categories, products, basket); sliding panels on mobile
- Basket manages items, quantities, discounts, customer info, notes
- Taxes calculated automatically via TaxProfileService
- Local orders track status: pending → paid → synced (or failed)
- Order sync maps local data to platform-specific format
- Customer can be attached from platform customer search
- Keyboard shortcut Cmd+K focuses search on desktop

---

## Flow 1: Browse & Add Products

1. **Order screen loads** → fetches products via useProductsForDisplay(platform)
2. **Category sidebar** → cashier taps category to filter products (desktop: always visible, mobile: swipe from left)
3. **Product grid** → shows name, price, image, stock for each product
4. **Search** → cashier types in search bar (or Cmd+K on desktop) → products filtered by title
5. **Tap product** → if product has variants, VariantPicker opens; otherwise adds directly
6. **addItem({ productId, variantId, quantity: 1, price })** → BasketService adds item
7. **Basket updates** → subtotal, tax, total recalculated in real time
8. **Basket panel** → shows items with +/- quantity controls (desktop: always visible, mobile: swipe from right)

## Flow 2: Cart Management

1. **Increase quantity** → tap "+" on basket item → updateItemQuantity(itemId, qty + 1)
2. **Decrease quantity** → tap "−" → updateItemQuantity(itemId, qty - 1); removes if qty reaches 0
3. **Remove item** → swipe or tap delete → removeItem(itemId)
4. **Basket totals** → subtotal, tax (from TaxProfileService), and grand total update after every change
5. **Basket persisted** → state saved to local storage so it survives app restarts

## Flow 3: Apply Discount

1. **Cashier taps "Add Discount"** → enters coupon code
2. **applyDiscount(code)** → validates via platform discount service (Shopify, WooCommerce, etc.)
3. **Valid** → discount applied (percentage or fixed_amount), total recalculated
4. **Invalid / expired** → error message shown, basket unchanged
5. **Remove discount** → removeDiscount() clears applied discount

## Flow 4: Attach Customer

1. **Cashier taps "Add Customer"** → CustomerSearchModal opens
2. **Type name or email** → useCustomerSearch debounces (300ms), queries platform API
3. **Results shown** → customer name, email, order count, total spent
4. **Select customer** → setCustomer(email, name) attaches to basket
5. **Customer badge** → shown in basket header with remove option
6. **Included in order** → customerId stored on LocalOrder for platform sync

## Flow 5: Checkout

1. **Cashier taps "Checkout"** → CheckoutModal opens
2. **Payment method selected** → cash, card, or other
3. **Card selected** → navigates to PaymentTerminalScreen (see payments.md)
4. **Cash selected** → cash drawer opens if drawerOpenOnCash enabled
5. **checkout()** → LocalOrder created from basket: items, totals, customer, discount, note
6. **Order status: "pending"** → then "paid" after payment confirmed
7. **Audit logged** → order:created and order:paid events recorded
8. **Basket cleared** → ready for next customer
9. **Receipt printed** → if printer connected, receipt sent automatically

## Flow 6: Order Sync to Platform

1. **Order status is "paid"** → BackgroundSyncService picks it up
2. **Map to platform format** → OrderServiceFactory creates platform-specific order
3. **API call** → createOrder(order) sent to Shopify / WooCommerce / etc.
4. **Success** → local status updated to "synced", platformOrderId stored
5. **Failure** → status set to "failed", error details stored
6. **Retry** → automatic retry with exponential backoff, or manual retry from Sync Queue
7. **Notification** → success/failure notification pushed via NotificationService

## Flow 7: Order Lifecycle & History

1. **Order created** → status: pending, stored in SQLite
2. **Payment confirmed** → status: paid
3. **Synced to platform** → status: synced, platformOrderId assigned
4. **Sync failed** → status: failed, visible in Sync Queue for retry/discard
5. **Daily Orders screen** → shows all orders for current day with status, amount, cashier
6. **Refund** → order status can change to partially_refunded or refunded (see payments.md)

## Questions

- How are orders uniquely identified across multiple POS registers?
- What happens if the app crashes mid-checkout before payment is confirmed?
- How does the system handle concurrent basket modifications on multi-register setups?
- What validation prevents checkout with an empty basket?
- How are order conflicts resolved when syncing to platforms?
