# Payments

## Purpose

Provider-agnostic card payment layer. Every provider implements
`PaymentServiceInterface`; a singleton `PaymentService` facade delegates to
whichever provider `PaymentServiceFactory` resolved. Tap-to-pay (contactless)
providers run their React Native SDK on mobile/tablet; PED/desktop providers
route through the Instore API orchestration layer (ADR-015). A single
`MockPaymentService` covers all providers under Expo Go or
`USE_MOCK_PAYMENT=true`.

## Scope

### Included

- Provider resolution + singleton facade (`PaymentServiceFactory`, `PaymentService`).
- `usePayment` — memoised callbacks + `getPaymentMode` (`tap_to_pay` vs `cash_only`).
- Terminal management UI: discover → connect → charge → disconnect
  (`PaymentTerminalScreen`), swapped out for `StripeNfcPaymentTerminal` when
  `STRIPE_NFC` is active.
- Per-provider credentials/config (`PaymentSettingsTab` → `usePaymentSettings`).
- Checkout integration: `useCheckout` calls `processPayment`; split tender
  lines can be voided via `voidTransaction`.
- Instore-api routed payments (`InstoreApiPaymentService` — PED providers with
  no RN SDK: Worldpay, Worldline, Global Payments, Nexi, Elavon, Fiserv,
  Adyen Terminal API via Cloud).

### Excluded

- Order lifecycle and checkout modal — **checkout** feature.
- Cash handling — no terminal involved; handled in checkout.
- Receipts — **printer** feature (triggered after successful payment).
- Cash drawer — hardware feature; driven by printer/driver, not payment.

## Entry Points

- **Checkout tender** — CARD / split tender → `useCheckout` →
  `paymentService.processPayment`.
- **More → Payment Terminal** — `PaymentTerminalScreen` (route
  `PaymentTerminal` in `MoreNavigator`; role-gated by menu access).
- **Settings → Payments tab** — `PaymentSettingsTab` chooses provider +
  credentials, `testConnection`.

## Feature Flow

```
PaymentSettingsTab → setPaymentProvider(provider)
        │
Checkout tender (card)                    Payment Terminal screen
        │                                    │
        ├─ getPaymentMode()                  ├─ getAvailableTerminals() (scan)
        │   ├─ Electron/web → cash_only      ├─ connectToTerminal(id)
        │   ├─ INSTORE_API → instore-api     ├─ charge → processPayment()
        │   └─ tap-to-pay provider           └─ disconnect() on unmount
        │           → tap_to_pay
        │
        └─ processPayment({amount, reference, currency, orderId,…})
            ├─ success → transactionId/last4/brand → order 'paid'
            ├─ declined/error → PaymentResponse.errorCode
            │       → order stays draft, checkout retries
            └─ split tender → voidTransaction(line.transactionId)
                    available on partial reversal
```

Provider resolution (`PaymentServiceFactory`):
`Expo Go || USE_MOCK_PAYMENT → MockPaymentService` → else real SDK service;
Square/Adyen/Tap lazy-loaded via `require()` so unused SDKs are not bundled.
Default provider: `STRIPE_NFC`.

## Implementation Map

| Layer      | Responsibility                        | Implementation                                                                                                                                                                                                  |
| ---------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Screens    | Terminal management, settings         | `features/payments/screens/PaymentTerminalScreen.tsx`, `features/settings/screens/PaymentSettingsTab.tsx`                                                                                                       |
| Components | Stripe-NFC dedicated terminal UI      | `features/payments/components/StripeNfcPaymentTerminal.tsx`                                                                                                                                                     |
| Hooks      | Memoised service access, mode         | `features/payments/hooks/usePayment.ts`, `features/payments/hooks/usePaymentSettings.ts`                                                                                                                        |
| Services   | Interface, facade, factory, providers | `features/payments/services/{PaymentServiceInterface,PaymentService,PaymentServiceFactory,StripeNfcService,StripeService,SquareService,AdyenService,TapPaymentsService}.ts`, `features/payments/services/mock/` |
| Services   | Instore-api payment path              | `features/multi-register/services/payment/{InstoreApiPaymentService,PaymentIntentClient,PaymentIntentTypes}.ts`                                                                                                 |
| Libs       | Platform detection for mode           | `shared/utils/electron.ts` (`isElectron`, `isMobile`)                                                                                                                                                           |
| Docs       | ADR for instore-api payments          | `docs/adr/ADR-015-*.md`                                                                                                                                                                                         |

## State Ownership

| State                    | Owner                                   | Persistence             | Reset condition                 |
| ------------------------ | --------------------------------------- | ----------------------- | ------------------------------- |
| Active provider          | `PaymentServiceFactory` (memory)        | Settings persist choice | `setPaymentProvider` / restart  |
| Terminal connection      | provider service instance               | None                    | `disconnect()` / screen unmount |
| Retry counter            | `PaymentTerminalScreen` local           | None                    | Reconnect / unmount             |
| Credentials per provider | `usePaymentSettings` → settings storage | Persisted               | User edit                       |

## Dependencies

- `shared/utils/electron.ts` — Electron/web ⇒ `cash_only` (no RN SDKs on desktop).
- `InstoreApiTransport` — `INSTORE_API` provider routes `/api/payment/*`.
- `shared/services/logger` — provider resolution + errors logged.
- `shared/services/audit` — payment outcomes audited.
- `@env` `USE_MOCK_PAYMENT` — forces `MockPaymentService`.

## Side Effects

- Provider SDK init/charge calls (network + NFC reader hardware).
- On successful payment the checkout path marks the order `paid` and triggers
  receipt/print paths (checkout feature owns this).
- Audit events on payment outcomes; toasts on failure.
- Terminal connect/disconnect hardware sessions; screen unmount
  auto-disconnects.
