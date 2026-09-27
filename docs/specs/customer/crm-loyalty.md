# Customer CRM, Loyalty & Store Credit – EARS Requirements

> **System**: RetailPOS – Customer Profiles, Purchase History, Loyalty & Store Credit
> **Actor**: Cashier, Manager, Admin, System
> **Date**: 2026-05-02
> **Source**: `services/customer/CustomerServiceFactory.ts`, `services/customer/CustomerServiceInterface.ts`, `hooks/useCustomerSearch.ts`, `components/CustomerSearchModal.tsx`, `services/basket/BasketService.ts`, `services/checkout/CheckoutService.ts`, `repositories/OrderRepository.ts`

---

## Context

The existing customer feature attaches an email to the basket at checkout. This spec extends that foundation with:

- **Persistent local customer profiles** — purchase history, notes, and segmentation stored in SQLite, independent of the platform.
- **Loyalty points** — earned on every paid order, redeemable as a discount at checkout.
- **Store credit** — issued manually (e.g. as a goodwill gesture or exchange settlement) and redeemed at checkout.

The loyalty and store credit layers are **local-first** — they live in SQLite and are authoritative regardless of platform. Where a platform supports native loyalty (e.g. Shopify), the system may optionally sync points/credit outbound, but the POS never reads loyalty state from the platform — the local ledger is always the source of truth.

Two new capability keys are added to `PlatformCapabilities`:

- `loyalty` — gates **outbound sync only**. The local loyalty ledger is always available on every platform including offline. `not_recommended` means local-only (no sync); `custom` means a platform adapter exists; `supported` is reserved for future first-class platform loyalty APIs.
- `storeCredit` — gates **outbound sync only**. Same semantics as `loyalty`.

**What is NOT capability-gated** (always available regardless of platform):

- Local customer profiles (`local_customers` table)
- Purchase history queries
- Loyalty earn/redeem/adjust (local ledger)
- Store credit issue/redeem/expire (local ledger)
- Loyalty and store credit basket actions

**What IS capability-gated** (only runs when adapter is ready):

- Outbound loyalty points sync to platform (`loyalty: 'custom'` + adapter ready)
- Outbound store credit sync to platform (`storeCredit: 'custom'` + adapter ready)

### New SQLite Tables

| Table                  | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `local_customers`      | Persistent customer profiles (email, name, phone, notes, segment)   |
| `loyalty_accounts`     | One row per customer — points balance, tier, lifetime points earned |
| `loyalty_transactions` | Append-only ledger of point earn/redeem/adjust events               |
| `store_credit_ledger`  | Append-only ledger of credit issue/redeem/expire events             |

### New Services

| Service                | Responsibility                                        |
| ---------------------- | ----------------------------------------------------- |
| `LocalCustomerService` | CRUD for `local_customers`; purchase history queries  |
| `LoyaltyService`       | Earn, redeem, adjust, and query loyalty points        |
| `StoreCreditService`   | Issue, redeem, expire, and query store credit balance |

### Capability Matrix Extension

| Feature       | Shopify | WooCommerce | Magento | BigCommerce | Sylius | Wix | PrestaShop | Squarespace | Commercefull | Offline |
| ------------- | ------- | ----------- | ------- | ----------- | ------ | --- | ---------- | ----------- | ------------ | ------- |
| `loyalty`     | C       | NR          | NR      | NR          | NR     | NR  | NR         | NR          | C            | S       |
| `storeCredit` | C       | NR          | NR      | NR          | NR     | NR  | NR         | NR          | C            | S       |

`S` = supported (local-first, always on), `C` = custom outbound sync adapter, `NR` = local-only (no platform sync)

---

## 1. Ubiquitous Requirements

**1.1** The system shall maintain a `local_customers` table in SQLite as the authoritative source for customer profiles — platform customer records are read-only references used for search and display only.

**1.2** When a customer is attached to a basket for the first time (by email), the system shall upsert a `local_customers` row with `email`, `name`, and `createdAt` — no duplicate rows shall exist for the same email address.

**1.3** The loyalty ledger (`loyalty_transactions`) and store credit ledger (`store_credit_ledger`) shall be append-only — balances are always derived by summing the ledger, never stored as a mutable field.

**1.4** `LoyaltyService` and `StoreCreditService` shall be singletons.

**1.5** All monetary values in the store credit ledger shall be stored as integer cents to avoid floating-point errors (per ADR-006).

**1.6** Loyalty and store credit redemptions shall be applied as line-level discounts in the basket — they flow through the existing `discountAmount` / `discountCode` mechanism so checkout totals remain consistent.

**1.7** The system shall never allow a store credit redemption to exceed the customer's current balance — the redemption amount is clamped to `min(requestedAmount, currentBalance)`.

**1.8** The system shall never allow a loyalty redemption to exceed the customer's current points balance.

---

## 2. Event-Driven Requirements

### 2.1 Customer Profile — Create & Upsert

**2.1.1** When a customer is attached to the basket via `BasketService.setCustomer(email, name)`, the system shall call `LocalCustomerService.upsert({ email, name })` to ensure a local profile exists.

**2.1.2** When `LocalCustomerService.upsert()` is called and no row exists for the email, the system shall insert a new `local_customers` row with a UUID, `email`, `name`, `createdAt: now`, and `totalOrders: 0`, `totalSpend: 0`.

**2.1.3** When `LocalCustomerService.upsert()` is called and a row already exists for the email, the system shall update `name` if the new value is non-empty and leave all other fields unchanged.

### 2.2 Customer Profile — View & Edit

**2.2.1** When a manager opens a customer profile, the system shall display: email, name, phone, notes, segment tag, `totalOrders`, `totalSpend`, `createdAt`, loyalty points balance, store credit balance, and the last 20 orders.

**2.2.2** When a manager edits a customer profile (name, phone, notes, segment), the system shall persist the changes to `local_customers` and record an audit log entry `customer:updated`.

**2.2.3** When a manager views purchase history, the system shall query `orders` by `customer_email` ordered by `created_at DESC`, joining `order_items` for line detail.

### 2.3 Loyalty — Earn Points

**2.3.1** When `CheckoutService.completePayment(orderId)` succeeds and the order has a `customerEmail`, the system shall call `LoyaltyService.earnPoints(customerEmail, orderId, total)`.

**2.3.2** When `LoyaltyService.earnPoints()` is called, the system shall calculate `pointsEarned = floor(total / earnRate)` where `earnRate` is configured in POS settings (default: 1 point per £1 spent), insert a `loyalty_transactions` row with `type: 'earn'`, `points: pointsEarned`, `orderId`, and update `loyalty_accounts.balance += pointsEarned` and `lifetimeEarned += pointsEarned`.

**2.3.3** When points are earned, the system shall send a notification `'Loyalty Points Earned: +{n} points'` if the customer is present at the terminal (basket has `customerEmail`).

**2.3.4** When `loyalty` capability is `custom` and the adapter is ready, the system shall call the platform loyalty adapter to sync the earned points outbound (non-blocking — failure is logged but does not block checkout).

### 2.4 Loyalty — Redeem Points

**2.4.1** When a cashier taps "Redeem Points" in the basket, the system shall call `LoyaltyService.getBalance(customerEmail)` and display the available balance and the equivalent discount value (`balance × redeemRate`, where `redeemRate` is configured in POS settings, default: £0.01 per point).

**2.4.2** When the cashier confirms redemption, the system shall call `LoyaltyService.redeemPoints(customerEmail, orderId, pointsToRedeem)`, which inserts a `loyalty_transactions` row with `type: 'redeem'` and decrements `loyalty_accounts.balance`.

**2.4.3** When `redeemPoints()` succeeds, the system shall apply the equivalent discount to the basket via `BasketService.applyDiscount(discountAmount, 'LOYALTY_REDEEM')`.

**2.4.4** When the order is voided or the basket is cleared after a redemption, the system shall call `LoyaltyService.reverseRedemption(transactionId)` to restore the points, inserting a `loyalty_transactions` row with `type: 'reversal'`.

### 2.5 Loyalty — Manual Adjustment

**2.5.1** When a manager manually adjusts a customer's loyalty balance (add or deduct), the system shall call `LoyaltyService.adjustPoints(customerEmail, delta, reason, managerId)`, insert a `loyalty_transactions` row with `type: 'adjustment'`, and record an audit log entry `loyalty:adjusted`.

**2.5.2** When an adjustment would result in a negative balance, the system shall clamp the balance to `0` and log a warning.

### 2.6 Store Credit — Issue

**2.6.1** When a manager issues store credit to a customer, the system shall call `StoreCreditService.issue(customerEmail, amountCents, reason, managerId)`, insert a `store_credit_ledger` row with `type: 'issue'`, and record an audit log entry `store_credit:issued`.

**2.6.2** When store credit is issued as part of an exchange settlement (return value > new items), the system shall call `StoreCreditService.issue()` automatically from `RefundService.processReturn()` when `settlementMethod: 'store_credit'` is specified.

**2.6.3** When `storeCredit` capability is `custom` and the adapter is ready, the system shall call the platform store credit adapter to sync the issued credit outbound (non-blocking).

### 2.7 Store Credit — Redeem

**2.7.1** When a cashier taps "Use Store Credit" in the basket, the system shall call `StoreCreditService.getBalance(customerEmail)` and display the available balance.

**2.7.2** When the cashier enters a redemption amount and confirms, the system shall call `StoreCreditService.redeem(customerEmail, orderId, amountCents)`, which inserts a `store_credit_ledger` row with `type: 'redeem'` and applies the discount to the basket via `BasketService.applyDiscount()`.

**2.7.3** When the order is voided or the basket is cleared after a store credit redemption, the system shall call `StoreCreditService.reverseRedemption(transactionId)` to restore the credit.

**2.7.4** When a store credit redemption is confirmed, the system shall record an audit log entry `store_credit:redeemed`.

### 2.8 Store Credit — Expire

**2.8.1** When `StoreCreditService.expireCredit(customerEmail, amountCents, reason)` is called by an admin, the system shall insert a `store_credit_ledger` row with `type: 'expire'` and record an audit log entry `store_credit:expired`.

### 2.9 Customer Search — Profile Enrichment

**2.9.1** When `CustomerSearchModal` displays a search result for an online platform customer, the system shall additionally query `local_customers` by email and, if a local profile exists, overlay `totalOrders`, `totalSpend`, loyalty balance, and store credit balance onto the result row.

**2.9.2** When the cashier selects a customer, the system shall display a compact loyalty/credit summary badge in the basket header showing points balance and store credit balance (if either is non-zero).

---

## 3. State-Driven Requirements

**3.1** While a customer with a non-zero loyalty balance is attached to the basket, the system shall render a "Redeem Points" action in the basket discount section.

**3.2** While a customer with a non-zero store credit balance is attached to the basket, the system shall render a "Use Store Credit" action in the basket discount section.

**3.3** While `LoyaltyService` or `StoreCreditService` is processing a redemption, the corresponding basket action button shall be in a loading state and non-interactive.

**3.4** While no customer is attached to the basket, loyalty and store credit actions shall be hidden.

---

## 4. Optional Feature Requirements

**4.1** Where `loyalty.tier` is configured (e.g. Bronze / Silver / Gold thresholds based on `lifetimeEarned`), the system shall display the customer's current tier in the profile view and the basket badge.

**4.2** Where `loyalty.expiryDays` is configured, the system shall mark points earned more than `expiryDays` ago as expired in the ledger and exclude them from the balance calculation.

**4.3** Where `customer.segment` is set, the system shall display the segment tag on the customer profile and allow filtering the customer list by segment.

---

## 5. Unwanted Behaviour / Edge Cases

**5.1** If `LoyaltyService.earnPoints()` fails (e.g. SQLite error), the failure shall be logged and a warning notification sent — checkout shall not be blocked.

**5.2** If `StoreCreditService.redeem()` is called with `amountCents > currentBalance`, the system shall clamp the redemption to `currentBalance` and proceed — it shall not throw.

**5.3** If a customer is detached from the basket after a loyalty or store credit redemption has been applied, the system shall automatically reverse the redemption before clearing the customer.

**5.4** If `LoyaltyService.reverseRedemption()` fails, the system shall log an error and flag the order for manual review via `notificationService` — the order shall not be blocked.

**5.5** If two cashiers simultaneously redeem points for the same customer (multi-register), the system shall use SQLite transactions with a balance check to prevent over-redemption — the second redemption shall fail with `'Insufficient points balance'`.

---

## 6. Configuration

| Setting key           | Default | Description                                |
| --------------------- | ------- | ------------------------------------------ |
| `loyalty.enabled`     | `false` | Master switch for the loyalty feature      |
| `loyalty.earnRate`    | `100`   | Spend in cents per 1 point earned          |
| `loyalty.redeemRate`  | `1`     | Cents per point when redeeming             |
| `loyalty.expiryDays`  | `null`  | Days before points expire (null = never)   |
| `loyalty.tier.silver` | `500`   | Lifetime points threshold for Silver tier  |
| `loyalty.tier.gold`   | `2000`  | Lifetime points threshold for Gold tier    |
| `storeCredit.enabled` | `false` | Master switch for the store credit feature |

All settings are persisted to the key-value store under the `loyalty.*` and `storeCredit.*` namespaces and are configurable from Settings → POS Config.

---

## 7. Component Traceability

| Requirement (summary)                             | Component / Service                                              | Source File (target)                         |
| ------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------- |
| Local customer upsert on basket attach            | `BasketService.setCustomer` → `LocalCustomerService.upsert`      | `services/customer/LocalCustomerService.ts`  |
| Customer profile view (history, balances)         | `CustomerProfileScreen`                                          | `screens/CustomerProfileScreen.tsx`          |
| Purchase history query by email                   | `LocalCustomerService.getOrderHistory`                           | `services/customer/LocalCustomerService.ts`  |
| Earn points on payment complete                   | `CheckoutService.completePayment` → `LoyaltyService.earnPoints`  | `services/loyalty/LoyaltyService.ts`         |
| Loyalty ledger append-only insert                 | `LoyaltyService.earnPoints` → `loyalty_transactions` INSERT      | `repositories/LoyaltyRepository.ts`          |
| Redeem points → basket discount                   | `LoyaltyService.redeemPoints` → `BasketService.applyDiscount`    | `services/loyalty/LoyaltyService.ts`         |
| Reverse redemption on basket clear                | `BasketService.clearBasket` → `LoyaltyService.reverseRedemption` | `services/loyalty/LoyaltyService.ts`         |
| Manual loyalty adjustment + audit log             | `LoyaltyService.adjustPoints` → `auditLogService.log`            | `services/loyalty/LoyaltyService.ts`         |
| Issue store credit + audit log                    | `StoreCreditService.issue` → `auditLogService.log`               | `services/storecredit/StoreCreditService.ts` |
| Redeem store credit → basket discount             | `StoreCreditService.redeem` → `BasketService.applyDiscount`      | `services/storecredit/StoreCreditService.ts` |
| Store credit balance guard (clamp)                | `StoreCreditService.redeem` balance check                        | `services/storecredit/StoreCreditService.ts` |
| Loyalty/credit badge in basket                    | `BasketContent` customer badge section                           | `screens/order/BasketContent.tsx`            |
| Loyalty/credit actions in basket                  | `BasketContent` discount section                                 | `screens/order/BasketContent.tsx`            |
| Platform loyalty outbound sync (custom)           | `LoyaltyService.earnPoints` → platform loyalty adapter           | `services/loyalty/platforms/`                |
| Capability matrix — `loyalty`, `storeCredit` keys | `PLATFORM_CAPABILITY_MATRIX`                                     | `utils/platformCapabilities.ts`              |
| Settings — loyalty config                         | `POSConfigTab` loyalty section                                   | `screens/settings/POSConfigTab.tsx`          |
