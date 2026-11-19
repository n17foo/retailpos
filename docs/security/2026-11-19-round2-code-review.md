# Project Review - Round 2

Date: 2026-11-19  
Revision: `909c2ee` (`main`)  
Status: all P1 findings fixed — PAY-03 in `3ad321f`, RET-02/03/04 in `632ed86`, DIS-01 in `b913539`; P2 findings and notes remain open

## Summary

This second pass adds 10 findings and 4 lower-priority observations. They are
new: none of them repeat the 30 findings in the
[fiscal review](2026-11-19-fiscal-code-review.md) and the
[project review](2026-11-19-project-code-review.md). This pass looked mainly
at areas the first pass closed with "no additional confirmed finding":
authentication, discounts, platform clients, payments, settings, and
returns/refunds.

| ID      | Priority | Area             | Title                                                                       | Validation             |
| ------- | -------- | ---------------- | --------------------------------------------------------------------------- | ---------------------- |
| PAY-03  | P1       | Payments         | Stripe secret key sent to a placeholder third-party host by default         | Static                 |
| RET-02  | P1       | Returns          | Zero-tender exchange marks the unrelated live basket paid, no approval      | Reproduced (SQLite)    |
| RET-03  | P1       | Returns          | Refund amounts are not bound to the returned line; discounts not allocated  | Reproduced (pure)      |
| RET-04  | P1       | Returns          | Free-form refunds bypass validation; terminal refunds never reach processor | Reproduced (SQLite)    |
| DIS-01  | P1       | Discounts        | Cents/major-unit mismatch lets a 5.00 code zero a basket                    | Reproduced (SQLite)    |
| RET-05  | P2       | Returns          | Return is committed before the refund; a failed refund cannot be retried    | Static                 |
| AUTH-01 | P2       | Authentication   | Client-mode PIN login has no LAN-outage fallback                            | Reproduced (SQLite)    |
| AUTH-02 | P2       | Authentication   | Most registered permission keys are never enforced                          | Static                 |
| PAY-04  | P2       | Payments         | Adyen and Tap services call SDK APIs that do not exist; Adyen amount units  | Static + package check |
| PLT-01  | P2       | Platform clients | Plaintext `http://` platform URLs accepted with credentials                 | Static                 |

The priority scale is the same as the earlier reports. P1 means high-priority
financial-integrity, security, or transaction-correctness impact. P2 means
medium-priority correctness, privacy, or reliability impact. These are
engineering priorities, not CVSS scores.

Highest-priority work:

1. Stop sending the Stripe secret key anywhere the merchant does not control
   (PAY-03).
2. Close the exchange path that marks goods paid with no tender (RET-02), and
   require authorization for it (AUTH-02).
3. Bind refund amounts to what was actually paid for each line, and route
   every refund type through the same validation and real processor call
   (RET-03, RET-04, RET-05).
4. Fix the discount unit contract before any merchant uses fixed-amount or
   minimum-purchase codes (DIS-01).

## Scope And Method

- Reviewed:
  - Electron main/preload/IPC.
  - Authentication: providers, limiter, approval, permission resolution,
    client-mode user repository.
  - Multi-register: signing, WebSocket, discovery, snapshot.
  - Commercefull webhook receiver.
  - Discount services.
  - Return validation, refund service, refund screen, exchange service and
    screen.
  - Payment providers: Stripe NFC bridge, Adyen, Tap.
  - Store-credit/loyalty manual actions.
  - The platform base HTTP client.
- The reproductions used the repository's `node:sqlite` adapter
  (`tests/helpers/nodeSqliteAdapter.ts`) and mocked transport boundaries.
- No live payment, refund, merchant or authority requests were made, and no
  real credentials were used.
- The separate in-store server, native SDKs, physical terminals and a
  packaged Electron build were not available.

Electron shell: sender-origin IPC checks, payload validation, the
navigation/webview/permission denials, and `safeStorage` handling were
sampled and no new defect was established. The CSP is discussed under PLT-01.
The Commercefull webhook receiver verifies its HMAC over the raw body, checks
event freshness, and claims each delivery durably before processing. No defect
was established there.

## Payments

### PAY-03 - P1 - Stripe secret key sent to a placeholder third-party host by default

Status: **fixed** in `3ad321f`

Validation: static trace.  
Evidence: `features/payments/contexts/StripeTerminalBridgeImpl.tsx:32-53,320-330,487-494,521-528`;
`features/platform-clients/services/clients/stripe/StripeApiClient.ts:47-63`.

The connection-token provider reads the Stripe NFC API key and posts it as
`{ apiKey, locationId }` to `${backendUrl}/stripe/connection_token`. When no
backend URL is configured, `backendUrl` defaults to
`https://your-backend-url.com`, a domain the merchant does not control. The
cancel (`/stripe/cancel_payment`) and refund (`/stripe/refund`) actions use the
same fallback and also send `apiKey` in the body.

The same key is used as `Authorization: Bearer` against
`api.stripe.com/v1/payment_intents`. That means it is a Stripe secret key, not
a publishable key.

In "direct API" mode (`stripe_nfc_useDirectApi`), the provider returns that
secret key as the Terminal connection token. It also creates PaymentIntents
from the device. `StripeApiClient` likewise "falls back to direct Stripe API
if backendUrl is not set".

Impact:

- A register left without a backend URL discloses the merchant's Stripe
  secret key to whoever operates the placeholder domain.
- Even with a correct backend, the secret travels in every request body and
  lives on each register.
- With that key, an attacker can create charges and refunds and read
  customer/payment data on the merchant account.

Recommendation:

- Remove the placeholder fallback and fail closed when no backend is
  configured.
- Never send the secret key from the device. The backend should hold it and
  authenticate the register by other means.
- Remove direct-API mode for production builds.
- Rotate any key that may have been configured on a register without a
  backend URL.

### PAY-04 - P2 - Adyen and Tap services call SDK APIs that do not exist; Adyen amount units

Validation: static, plus inspection of the installed packages.  
Evidence: `features/payments/services/AdyenService.ts:44,60,97,121-124,168,188-190`;
`features/payments/services/TapPaymentsService.ts:43,58,95,119,164,184`;
`package.json` (`@adyen/react-native` ^2.13.0, `card-react-native` 1.0.9).

**Missing SDK APIs.**

- `AdyenService` calls `sdk.AdyenTerminal.*`. The installed
  `@adyen/react-native` is the online Checkout drop-in SDK, and no
  `AdyenTerminal` symbol exists anywhere in the package.
- `TapPaymentsService` calls `sdk.TapPayments.*`. `card-react-native` exports
  a card-entry view and enums, and no `TapPayments` symbol exists in it.

The `require()` calls succeed, so the PAY-01 mock fallback is not triggered.
Every connect, payment, void and refund call then throws a `TypeError`, and
the service reports that as an ordinary failure.

**Wrong amount unit (Adyen).** Checkout passes `request.amount` in major units
(compare `InstoreApiPaymentService`, which applies `toCents`). Adyen passes
that value straight into `amount.value` for payments and refunds. Adyen amounts
are minor-unit integers, so a 12.50 sale would be requested as 12.5 minor units.

**Missing merchant account (Adyen).** `merchantAccount` is read from
`process.env.ADYEN_MERCHANT_ACCOUNT`. Expo bundles do not inline that variable,
so the value is empty at runtime.

Impact: two providers are presented as supported but cannot take a payment. If
the SDK calls are wired up later, the amount bug would charge about 1/100 of the sale.

Recommendation:

- Hide these providers until they are integrated against the real
  terminal/Terminal API SDKs.
- Convert amounts with `shared/utils/money.ts`.
- Source the merchant account from configuration.
- Add contract tests against the real SDK type definitions.

## Returns, Refunds And Exchanges

### RET-02 - P1 - Zero-tender exchange marks the unrelated live basket paid, no approval

Status: **fixed** in `632ed86`

Validation: reproduced on real SQLite (`ExchangeService` + real
`BasketService`/`CheckoutService`/`ReturnService`).  
Evidence: `features/returns/components/ExchangeAddItemsStep.tsx:79-86`;
`features/returns/services/exchange/ExchangeService.ts:159-164`;
`features/checkout/services/CheckoutService.ts:266-277`;
`features/orders-sync/screens/OrderHistoryScreen.tsx:76`;
`app/navigation/MoreNavigator.tsx:270`; `shared/utils/roleAccess.ts:57`.

This finding extends RET-01 with three further defects:

1. **The production exchange screen offers only a demo item.** "Add Sample
   Item ($10.00)" adds `{ name: 'Exchange Item', price: 10.0 }` with a random
   product ID. It is not linked to the catalogue.
2. **An exchange with no tender marks the order paid without any payment
   check.** When `netDue` is zero, `session.payments` is empty. The exchange
   then calls `completePayment(newOrderId, 'other', undefined, [])`.
   `completePayment` checks payment lines against the order total only when
   that array is non-empty. Otherwise it marks the order `paid` directly.
   Because `startCheckout()` reads the live sales basket (RET-01), whatever is
   in that basket becomes a paid order.
3. **No authorization.** Cashiers can open Order History, and every order
   card has an Exchange button that navigates to the Exchange route. The route
   has no `PermissionGate`, and neither the screen nor `ExchangeService` checks
   `exchange:process` or `refund:process`. The menu entry is hidden for
   cashiers, but the route itself is not protected.

Reproduced:

1. Create a paid 10.00 order.
2. Put a 500.00 item in the live basket.
3. Return the 10.00 line, add the 10.00 sample item, and confirm.

Result: the exchange succeeds and the new order has status `paid`,
`total >= 500` and `payment_method = 'other'`. No tender was taken and no
approval was requested. The return leg was recorded and restocked.

Impact: a cashier can release goods of any value as "paid" without collecting
money or getting manager approval. Order totals and stock then disagree with
the cash and card actually taken.

Recommendation:

- Require approval at the service boundary, not only in navigation.
- Build the exchange order from the session's item snapshot (RET-01).
- Require a settlement model that represents the return credit explicitly.
- Make `completePayment` reject any order whose total is not covered by
  recorded tender lines (zero-total orders being the explicit exception).
- Remove the sample-item button from production builds.

### RET-03 - P1 - Refund amounts are not bound to the returned line; discounts not allocated

Status: **fixed** in `632ed86`

Validation: reproduced against `validateReturnRequest` (pure function).  
Evidence: `features/returns/services/refunds/returnValidation.ts:48,73-78`;
`features/returns/screens/RefundScreen.tsx:202,224`.

Validation checks quantities per line, but caps money only against the
cumulative order total. It never compares a line's `refundAmount` with what
was paid for that line.

The refund screen computes `refundAmount = unit price × qty` from the stored
order-item price. That price is the pre-discount basket price, and on
tax-exclusive setups it also excludes tax.

Reproduced:

- **Unbounded line refund.** An order has two lines, a 1.00 line and a 99.00
  line, with a total of 100.00. Returning the 1.00 line with
  `refundAmount: 100` passes validation.
- **Discounted order.** An order has two 50.00 items and a 20.00 basket
  discount, so the customer paid 80.00. Returning the first item refunds
  50.00 when only 40.00 was paid for it. Returning the second item is then
  rejected with "Refund total exceeds the amount paid".

Impact:

- Over-refunds on partial returns of discounted orders.
- Under-refunds of tax on tax-exclusive orders.
- Any caller that controls `refundAmount` (UI, LAN client, future API) can
  move the whole order value onto one cheap line.
- Legitimate final returns get blocked.

Recommendation:

- Derive the refundable amount for each line on the server/service side from
  the stored line total, its share of the order discount, and its tax.
- Reject requested amounts above that value.
- Keep the cumulative cap as a second check.

### RET-04 - P1 - Free-form refunds bypass validation; terminal refunds never reach the processor

Status: **fixed** in `632ed86`

Validation: reproduced on real SQLite (`ReturnService` with the real
`OfflineRefundService` and key-value store).  
Evidence: `features/returns/screens/RefundScreen.tsx:112-147`;
`features/returns/services/refunds/RefundService.ts:427,468-486`;
`features/returns/services/refunds/platforms/OfflineRefundService.ts:54-80`.

The Refund screen offers three modes. Two of them, "payment" and "ecommerce",
take a free-text transaction or order ID plus a free-text amount. They call
`processPaymentRefund` and `processRefund` directly, without
`validateReturnRequest`, so nothing checks:

- that the order exists,
- the order's status,
- the amount already refunded, or
- the cumulative cap.

These refunds are also not recorded as returns. A later item return is
therefore not reduced by the earlier free-form refund.

- **Offline platform.** `processRefund('no-such-order', { amount: 1_000_000 })`
  succeeds, and repeating it succeeds again.
- **Payment-terminal mode.** `processPaymentRefund` always uses
  `OfflineRefundService`. That service writes a `status: 'completed'` record to
  the key-value store and returns success. No payment provider is called:
  `PaymentService.refundTransaction` has no callers, and no fetch occurred in
  the reproduction. The UI then shows "Refund of X processed successfully".

Impact:

- A manager-approved operator can record unlimited refunds against arbitrary
  references.
- The "terminal" refund tells staff that the card was credited when nothing
  was sent to the processor. The customer is not refunded, or staff
  compensate with cash outside the system.

The manager approval is also requested twice for the same action: once in the
screen and again in `useRefund` (`RefundScreen.tsx:106`, `useRefund.ts:60,119,226`).

Recommendation:

- Route every refund through one service that loads the original
  order/payment, enforces caps, records a durable refund intent, and calls
  the provider that captured the payment.
- Report success only on confirmed processor acceptance.
- Remove or restrict the free-form modes.

### RET-05 - P2 - Return is committed before the refund; a failed refund cannot be retried

Validation: static trace.  
Evidence: `features/returns/services/refunds/RefundService.ts:201-202,240-262`.

`processReturn` creates the return rows and marks them `completed` inside the
lock. Only afterwards does it attempt the platform refund. If the refund fails
or throws, the caller sees `success: true`, with only a notification ("Return
recorded but platform refund failed") and a log line.

The returned quantity is already counted against the line. A second attempt is
rejected as exceeding the quantity sold, and no queue retries the refund.

Impact: customers can be left with their goods returned but no money back.
Reconciliation depends on staff noticing a transient toast.

Recommendation:

- Model the return lifecycle as recorded → refund pending → refunded/failed.
- Persist the refund intent with an idempotency key.
- Retry it durably and surface unrefunded returns in a work queue.
- Do not report overall success while the refund is pending or failed.

## Discounts

### DIS-01 - P1 - Cents/major-unit mismatch lets a 5.00 code zero a basket

Status: **fixed** in `b913539`

Validation: reproduced on real SQLite (`LocalDiscountService`).  
Evidence: `features/discounts/services/BaseDiscountService.ts:32-38,72`;
`features/basket/services/BasketService.ts:78,87,217`;
`features/discounts/services/platforms/ShopifyDiscountService.ts:100,114`;
`docs/features/discounts/rules.md:3-12`.

The discount services and the feature rules define code values, minimum
purchase and the returned `discountAmount` in cents. Shopify explicitly
multiplies by 100. `BasketService.applyDiscount` passes `basket.subtotal` in
major units, however, and subtracts the returned `discountAmount` directly
from major-unit totals.

Reproduced:

- **Fixed 500-cent code (5.00) on a 30.00 basket.** `discountAmount` comes
  back as 30, so the whole basket is free. (`min(500, 30)`)
- **5000-cent (50.00) minimum on a 60.00 basket.** The code is rejected
  (`60 < 5000`). Minimum-purchase codes can never be used.
- **10% on 25.50.** The result is 3 instead of 2.55, because rounding happens
  in whole currency units.

Shopify fixed-amount and minimum-purchase rules hit the same paths, as do
codes served by the in-store server through `InstoreApiDiscountService`,
since it uses the same `DiscountRow` contract.

Impact: any fixed-amount code at least as large, in cents, as the basket
subtotal in major units makes the sale free before tax. With typical code
values, that is almost every basket. Minimum-spend promotions never apply.

Recommendation:

- Use one unit end to end. Convert the subtotal with `toCents` before
  validation and convert the result back with `toDollars` (ADR-006).
- Add the spec's E1.1 example as a test across basket and discount code.

## Authentication And Authorization

### AUTH-01 - P2 - Client-mode PIN login has no LAN-outage fallback

Validation: reproduced on real SQLite with the signed transport rejected.  
Evidence: `features/platform-clients/services/clients/instoreapi/InstoreApiClient.ts:527-535`;
`features/authentication/services/auth/providers/PinAuthProvider.ts:45,86-95`;
`features/authentication/repositories/InstoreApiUserRepository.ts:94-96`.

`InstoreApiUserRepository.findByPin` is documented to fall back to locally
cached credentials when the store API is unavailable. That fallback can never
run, for two reasons:

1. `instoreApiClient.verifyPin` catches every error, including network
   failures, and returns `null` (the comment says "401 = invalid PIN"). The
   repository's `isStoreApiUnavailable(error)` branch is therefore unreachable.
2. `PinAuthProvider` does not call the repository in client mode at all. It
   calls `instoreApiClient.verifyPin` directly. Successful logins therefore
   never populate the offline cache through this path.

Reproduced: with a locally cached PIN, `verifyPin` resolves `null` while the
transport is failing, and `InstoreApiUserRepository.findByPin` also returns
`null`. Meanwhile `userRepository.findByPin` matches the cached PIN.

Impact:

- During a LAN outage, staff who are not already signed in get "Invalid PIN"
  and cannot start trading, despite the degraded-mode design.
- Each attempt counts toward the brute-force lockout.
- Manager approvals during the outage fail the same way.

The provider also casts the server's `role` string without validating it, and
hardcodes `is_active: true`. The repository's `toUser()` normalizes the role
to `cashier`, but the provider path skips it.

Recommendation:

- Let `verifyPin` distinguish 401 from transport failures.
- Have `PinAuthProvider` call `getUserRepository().findByPin()` so role
  normalization, caching and fallback all apply.
- Test outage login with a cached and an uncached user.

### AUTH-02 - P2 - Most registered permission keys are never enforced

Validation: static (repository-wide search for each key outside the registry).  
Evidence: `shared/utils/actionRegistry.ts:24-47`;
`features/customers/services/customer/StoreCreditService.ts:56`;
`features/customers/services/loyalty/LoyaltyService.ts:211`;
`features/customers/screens/CustomerProfileScreen.tsx:85,95`.

These keys are defined in the action registry but referenced nowhere else:

- `discount:apply`, `discount:manual`
- `order:void`, `order:reopen`
- `loyalty:adjust`, `store_credit:issue`
- `cash_drawer:open`
- `report:export`
- `purchase_order:receive`

`price:override` appears only in doc comments. `exchange:process` is used only
to hide a menu item, not to protect the route (see RET-02).

Consequences:

- **Overrides have no effect.** An admin who denies one of these actions for
  a user through a permission set changes nothing. The closest coarse gate
  still decides; for example, any `customer:edit` holder can issue store
  credit and adjust loyalty.
- **No amount limits.** `StoreCreditService.issue` accepts any `amountCents > 0`
  with no integer check, finiteness check or upper bound. The UI's
  `parseFloat` accepts `1e309`, which becomes `Infinity`. Loyalty adjustments
  likewise have no bound and no approval threshold.

Impact: the permission model advertises controls over high-risk money
operations that are not actually applied. This compounds CUS-01 to CUS-05.

Recommendation:

- Enforce each action key in the service or at the action point, with
  approval where the registry requires it.
- Validate monetary inputs as finite, bounded integers.
- Add a test that every registry key has at least one enforcement site.

## Platform Clients

### PLT-01 - P2 - Plaintext `http://` platform URLs accepted with credentials

Validation: static.  
Evidence: `features/platform-clients/services/clients/BaseApiClient.ts:192-199`;
`electron/main.js:574`.

`normalizeUrl` adds `https://` only when the URL has no scheme. An explicit
`http://` store URL is kept, and no onboarding or settings validation rejects
it. The clients then send Basic Auth credentials (WooCommerce consumer
key/secret) or bearer tokens over plaintext HTTP.

The Electron CSP's `connect-src` allows `http:`, `https:` and `ws:` to any
host. It therefore does not limit where a compromised renderer can send data.

Impact: merchant API credentials and order/customer data can cross untrusted
networks in clear text. This becomes likely when a merchant pastes an
`http://` URL or a staging host.

Recommendation:

- Require `https:` for remote platform and payment backends, allowing an
  explicit, labelled exception only for LAN/loopback development.
- Narrow the production CSP `connect-src` to the configured origins plus the
  in-store LAN server.

## Lower-Priority Observations

None of these were promoted to findings, but each should be handled during
remediation:

- **PIN lockout resets.** `AuthAttemptLimiter` resets the failure count after
  15 minutes without a failure, which equals the maximum lockout. An attacker
  who pauses just over 15 minutes after every 4 guesses never triggers a
  lockout. That is about 384 guesses per day per provider instance, and the
  in-memory limiter also resets on app restart. Consider a persistent or
  server-side budget.
- **Biometric unenroll.** `BiometricAuthProvider.unenroll(_userId)` removes
  the device's biometric link no matter which user is passed.
  `authenticate()` also maps any OS-enrolled fingerprint or face to the
  linked staff member. On shared devices, OS enrolment must be controlled
  administratively.
- **Approval requests replace each other.** In `ManagerApprovalService`, a
  second `requestApproval()` overwrites `this.pending` (`:76`). The first
  caller's promise never resolves.
- **LAN integrity claims.** HMAC signing authenticates register-to-server
  requests only. Server responses and WebSocket frames are unauthenticated:
  for example, `/api/users/verify-pin` returns the user and role the client
  will trust. The security README lists "HMAC-signed requests" against LAN
  tampering, and this one-directional limit should be stated there. Network
  isolation remains the actual control.

## Validation

- A temporary reproduction suite with 8 tests asserted the current defective
  behaviour. It passed.
  - Real SQLite: DIS-01 (2 tests), RET-04 (2 tests), RET-02 (1 test),
    AUTH-01 (1 test).
  - `validateReturnRequest` (pure function): RET-03 (2 tests).
- The suite was deleted after recording results. The working tree contains
  only documentation changes.
- PAY-03, PAY-04, RET-05, AUTH-02 and PLT-01 are static findings. For PAY-04,
  the installed `node_modules` packages were checked for the referenced SDK
  symbols.
- Neither the full Jest suite nor `tsc --noEmit` was re-run for this round.
  The last recorded full run is in the project review.

For remediation, put regression tests next to the affected code. Each test
should assert the safe opposite of the reproductions above. Keep these finding
IDs stable, and record the fix revision and the passing check before closing a
finding.
