# Reporting

## Purpose

Sales analytics over locally-stored orders: summary totals, hourly/daily
breakdowns, cashier performance, payment-method breakdown, and CSV export —
all computed from the SQLite `orders`/`order_items` tables, so reports work
fully offline. (Shift open/close + Z-report lives in the orders-sync feature;
this is the analytics surface.)

## Scope

### Included

- `ReportingService` — five report types over a `from/to` timestamp range:
  `getSalesSummary`, `getSalesByHour`, `getSalesByDay`,
  `getCashierPerformance`, `getPaymentBreakdown`, plus `exportOrdersCsv`.
- `ReportingScreen` — period selector, charts/tables, CSV export via
  `Share.share`.
- `useReporting` — hook wrapper.

### Excluded

- Shift open/close + shift report — orders-sync feature (`useDailyReport`,
  `ShiftModal`, `ReportModal`).
- Audit log — system-infra feature.
- Receipt content — hardware/printer.

## Entry Points

- **More → Reporting** — `ReportingScreen` (role-gated manager/admin).

## Feature Flow

```
ReportingScreen → pick range → useReporting
   → ReportingService.get*(from, to) → SQL over orders/order_items
   → only 'paid'+'synced' orders count toward sales
   → CSV button → exportOrdersCsv → Share.share({message: csv})
```

## Implementation Map

| Layer        | Responsibility                  | Implementation                                          |
| ------------ | ------------------------------- | ------------------------------------------------------- |
| Screens      | Report UI, range picker, export | `screens/ReportingScreen.tsx`                           |
| Hooks        | Hook wrapper                    | `hooks/useReporting.ts`                                 |
| Services     | Aggregations + CSV              | `services/reporting/ReportingService.ts`                |
| Repositories | Source rows                     | `repositories/{OrderRepository,OrderItemRepository}.ts` |
| Libs         | CSV escaping                    | `utils/csv.ts` (X-R3)                                   |

## Rules (summary — see rules.md)

- Sales metrics count only `paid`/`synced` orders.
- `netSales = totalSales − totalTax`; `averageOrderValue = totalSales / count`.
- Hourly buckets are always 24, labelled `HH:00`.
- Cashier performance groups by `cashier_id` (`'unknown'` when null), sorted
  desc by sales.
- CSV cells are formula-injection escaped (X-R3).

## State Ownership

| State                 | Owner           | Persistence   | Reset condition |
| --------------------- | --------------- | ------------- | --------------- |
| Report inputs (range) | Screen local    | None          | Unmount         |
| Report data           | Derived from DB | SQLite orders | n/a             |

## Dependencies

- `utils/csv.ts` — safe CSV cell escaping.
- `Share` API — export delivery.
- Order repositories — the data source.

## Side Effects

- CSV export shares text via OS share sheet.
- No writes — reporting is read-only.
