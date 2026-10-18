# Returns, Refunds & Exchanges

## Purpose

Post-sale corrections: return items from a paid order (locally recorded,
optionally pushed to the platform and/or restocked), refund money via the
platform refund adapter or payment terminal, and run a guided exchange —
return credit + new items + net payment — that produces return records and a
new order atomically-ish.

## Scope

### Included

- `ReturnService` — unified returns + refunds. `processReturn` validates,
  records return rows (`pending→approved/rejected/completed`), optionally
  issues a platform refund and restocks.
- `returnValidation` — fraud/data-integrity guard: paid-order-only, positive
  integer quantities, per-line returnable cap (minus prior completed/approved
  returns), cumulative refund ≤ order total, ≤200 lines.
- `ExchangeService` — exchange session: return credit, new items, net due,
  payments, confirm → returns + new order + audit.
- `RefundScreen`, `ExchangeScreen` (More → Refund / Exchange).
- Per-platform refund adapters (`shared/utils/*`) +
  `OfflineRefundService`.

### Excluded

- Original checkout — sale feature.
- Payment-terminal charge paths — payments feature (refundTransaction is the
  optional payment-side hook).
- Inventory levels themselves — inventory feature; returns only _flag_
  `restock`.

## Entry Points

- **More → Refund** — pick paid order → choose lines → confirm.
- **More → Exchange** — pick order → returned items → new items → payment diff.
- **Sale MainMenu** — Refund/Exchange entries come through the menu composer
  (capability-gated per platform `refunds` capability).
- **Multi-register** — LAN clients can POST returns (validation is
  server-side, deliberately).

## Feature Flow

```
Refund:
order (paid) → select lines {orderItemId, productId, qty, refundAmount, restock}
   → validateReturnRequest → ReturnRepository rows (status flow)
   → optional platform refund via refunds/platforms adapter
   → restock ? inventory bump
   → audit + status 'completed'

Exchange:
ExchangeSession(originalOrderId, returnItems) → returnCredit
   + newItems → newItemsTotal
   → netDue = newItemsTotal − returnCredit  (− means store owes customer)
   → payments[] → remainingDue
   → confirm → ReturnService records returns + checkoutService creates
     new order → audit 'exchange:completed'
```

## Implementation Map

| Layer        | Responsibility          | Implementation                                                                            |
| ------------ | ----------------------- | ----------------------------------------------------------------------------------------- |
| Screens      | Refund + Exchange flows | `features/returns/screens/{RefundScreen,ExchangeScreen}.tsx`                              |
| Hooks        | Refund form/state       | `features/returns/hooks/useRefund.ts`                                                     |
| Services     | Returns + refunds       | `features/returns/services/refunds/{RefundService,returnValidation}.ts`, `shared/utils/*` |
| Services     | Exchange sessions       | `features/returns/services/exchange/ExchangeService.ts`                                   |
| Repositories | Return rows             | `features/returns/repositories/ReturnRepository.ts`                                       |
| Libs         | Money math (netDue)     | `shared/utils/money.ts` (cents rounding in `calcTotals`)                                  |

## State Ownership

| State              | Owner                         | Persistence      | Reset condition     |
| ------------------ | ----------------------------- | ---------------- | ------------------- |
| Return records     | `ReturnRepository`            | SQLite `returns` | status transitions  |
| Exchange session   | `ExchangeService` (in-memory) | None             | confirm / abandoned |
| Platform refund id | Return row + RefundRecord     | SQLite           | —                   |
| Refund form        | `RefundScreen`/hook           | None             | Unmount             |

## Dependencies

- `features/checkout` — exchange confirm creates the new order.
- `shared/utils/*` — platform refund pushes.
- `shared/services/audit` — `exchange:completed`, return events.
- Platform `refunds` capability gates menu entries.
- `shared/utils/money.ts` — cent rounding for credits/net due.

## Side Effects

- Return rows + status transitions in SQLite.
- Platform refund API call (when `issueRefund` chosen) — real money.
- Optional inventory restock.
- New order row on exchange confirm.
- Audit entries (`exchange:completed`, returns, refunds).
