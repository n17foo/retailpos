# Payments — Rules

## R1 — One provider is active at a time; the facade hides which

**Rule.** `PaymentService` is a singleton facade over one
`PaymentServiceInterface`. `PaymentServiceFactory` resolves the implementation:
`MockPaymentService` under Expo Go/`USE_MOCK_PAYMENT`, otherwise the real SDK
service for `currentProvider` (default `STRIPE_NFC`). `setPaymentProvider`
rejects unsupported values.

**Evidence.** `services/payment/{PaymentService,PaymentServiceFactory}.ts`,
`services/payment/mock/MockPaymentService.ts`.

🟢 **E1.1 — Resolution**
Given provider `STRIPE` configured, when a payment runs, `StripeService` gets
the call; other provider SDKs are not even bundled (Square/Adyen/Tap are
lazy `require()`).

🟠 **E1.2 — Mock everywhere**
`USE_MOCK_PAYMENT=true` or Expo Go → `MockPaymentService` for _all_ providers —
the config screen still shows the real provider.

🔴 **E1.3 — Bad provider value**
`setPaymentProvider('bogus')` throws `Unsupported payment provider`.

## R2 — All providers share `PaymentRequest`/`PaymentResponse`

**Rule.** `processPayment({amount, reference, currency, orderId?, customerName?,
itemCount?, items?})` → `{success, transactionId?, errorMessage?, errorCode?,
paymentMethod?, cardBrand?, last4?, amount?, timestamp}`. Optional methods
(`getTransactionStatus`, `voidTransaction`, `refundTransaction`) may be absent —
callers must handle `'not supported'`.

**Evidence.** `services/payment/PaymentServiceInterface.ts`.

🟢 **E2.1 — Success payload**
transactionId, brand, last4 available for receipts/audit.

🔴 **E2.2 — Decline**
`success:false` + `errorCode` (e.g. `card_declined`) — checkout treats it as
retryable UI, order stays draft (see checkout doc).

🟠 **E2.3 — Missing optional method**
`voidTransaction` undefined on a provider → guarded call
(`if (paymentServiceInstance.voidTransaction)` in `useCheckout`); otherwise a
rejection the caller must catch.

## R3 — Device decides payment mode, not configuration

**Rule.** `getPaymentMode()`: Electron or non-mobile → `cash_only`; mobile with
a tap-to-pay provider → `tap_to_pay`. PED providers (`INSTORE_API`) route via
store-api endpoints, not this layer.

**Evidence.** `hooks/usePayment.ts`, `services/instoreapi/payment/*`, ADR-015.

📱 **E3.1 — Desktop register**
Electron checkout → card tender unavailable as tap-to-pay (`cash_only`); card
payments must flow through the Instore API path.

🟢 **E3.2 — Mobile + Stripe**
`getPaymentMode()` → `tap_to_pay`; CARD tender can invoke the SDK.

## R4 — Terminal screen is discover → connect → charge, with cleanup

**Rule.** `PaymentTerminalScreen` scans `getAvailableTerminals()`, connects to
a selected id, then offers charge. Screen unmount disconnects. Retries are
capped by `MAX_RETRY_ATTEMPTS`; when `STRIPE_NFC` is the provider the entire
screen is replaced by `StripeNfcPaymentTerminal`.

**Evidence.** `screens/PaymentTerminalScreen.tsx`,
`components/StripeNfcPaymentTerminal.tsx`.

🟢 **E4.1 — Happy path**
Scan finds terminals → tap → connected badge → charge → success.

🔴 **E4.2 — None found**
`getAvailableTerminals` returns `[]` →
`"No {provider} terminals found. Make sure your terminal is powered on and nearby."`

🔴 **E4.3 — Connect failure**
`"Could not connect to '{name}'. Check the terminal is ready and try again."`

🟠 **E4.4 — Retry cap**
After `MAX_RETRY_ATTEMPTS` charge failures the user is told to disconnect and
try again.

📱 **E4.5 — Unmount**
Navigating away calls `disconnect()` if connected — no orphaned terminal
session.

🟠 **E4.6 — StripeNFC swap**
`isStripeNfcActive` short-circuits the whole standard screen — two different
UXs behind one route.

## R5 — Payment credentials are per-provider settings

**Rule.** `PaymentSettingsTab` edits per-provider credential fields via
`usePaymentSettings` → settings storage; `testConnection` validates.

**Evidence.** `screens/settings/PaymentSettingsTab.tsx`,
`hooks/usePaymentSettings.ts`.

🟢 **E5.1 — Save**
Provider + keys persist; `saveStatus` reflects the write.

🔴 **E5.2 — Bad keys**
`testConnection` surfaces an error string; provider still selectable.

## R6 — Payment integrates checkout and audit, not orders

**Rule.** `useCheckout` calls `processPayment` per tender; split tender stores
`transactionId` per line so a line can be `voidTransaction`-ed. Payment outcomes
are audited. Order status transitions belong to the checkout feature.

**Evidence.** `hooks/useCheckout.ts:130,239-241,412`, `services/audit/`.

🟢 **E6.1 — Split reversal**
A split line's transaction can be voided individually by transactionId.

## ❓ Open Questions

- **Q1** — `MAX_RETRY_ATTEMPTS` — hardcoded constant in the screen or driven
  by `posConfig.values`? Screen-local constant found; confirm intended
  configurability.
- **Q2** — `INSTORE_API` provider mode: `getPaymentMode` returns `cash_only`
  on mobile for non-tap-to-pay providers — but an instore-api register pair
  presumably offers card tender; how does checkout distinguish "inst-ore-api
  card available" vs "cash only"? (See checkout doc fast-path rules.)
- **Q3** — Refund path exists in the interface (`refundTransaction`) but the
  refunds feature drives its own flow — who calls it?

## ⚠️ Potential Gaps

- **PG1** — `processPayment` has no timeout/cancel contract in the interface —
  a hung SDK call could stall checkout with no abort path visible at this layer.
- **PG2** — Retry counter resets on unmount; a flaky terminal can be retried
  forever by re-entering the screen.
- **PG3** — Provider switch mid-session: `setPaymentProvider` doesn't visibly
  disconnect an existing terminal session on the old provider.
- **PG4** — Optional `getTransactionStatus` means an ambiguous result (SDK
  timed out after charging) has no standard reconciliation path for providers
  that don't implement it.
- ~~**PG5**~~ **RESOLVED** — `StripeTerminalBridgeProvider` was commented out in
  `App.tsx` because the file imported `@stripe/stripe-terminal-react-native`
  at module top level — the import crashed Expo Go at load. Split into a safe
  shell (`contexts/StripeTerminalBridge.tsx`: types, context,
  `StripeTerminalBridgeManager`, gated provider) and an impl file
  (`StripeTerminalBridgeImpl.tsx`, holds the SDK import). The provider is
  restored in `App.tsx` and lazily `require()`s the impl only on real
  iOS/Android builds — never Expo Go, web, or Electron.
- **PG6** — **`giftCards` capability is advertised but unimplemented**: the
  matrix rows (`utils/platformCapabilities.ts`) and onboarding/settings
  surfaces reference gift-card support, yet there is no `services/giftcard`,
  no tender in `CheckoutModal`/`TenderBar`, and no redemption path. Capability
  truth and feature reality diverge.

## Test Coverage Mapping

| Example            | Coverage                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| R1 resolution/mock | Factory tests via DI — partial; check `services/payment` for `*.test.*` (none found at this level) |
| R4 screen flow     | Not found                                                                                          |
| R6 split void      | `CheckoutService.test.ts` covers order side, not terminal calls                                    |

## Feature Context Summary

**Feature**: Payments
**Responsibility**: Uniform card-payment contract across 5 SDK providers +
instore-api PED path; terminal lifecycle; provider config; mock for demos/tests.

**Core rules**

- R1 Singleton facade; factory resolves provider (mock under Expo Go/env).
- R2 Shared request/response; optional methods may be absent.
- R3 Device decides `tap_to_pay` vs `cash_only`; no Electron card path.
- R4 Screen: scan→connect→charge; disconnect on unmount; StripeNFC replaces it.
- R5 Per-provider credentials in settings.
- R6 Checkout owns order state; payment supplies transactionId/void hooks.

**Primary happy path**: provider configured → terminal connects →
`processPayment` succeeds → order `paid` with transactionId/last4 for receipt.

**Critical unhappy paths**: decline → order stays draft (checkout retries);
connect failure → error message; no terminals → guidance message.

**Offline**: mock provider works fully offline; real providers need provider
connectivity — a card charge cannot succeed with no network to the provider.

**Dependencies**: `utils/electron.ts`, instore-api transport, settings storage,
audit, logger, `@env`.

**Gaps**: no timeout/cancel contract; retry resets on unmount; ambiguous-charge
reconciliation depends on optional `getTransactionStatus`.
