# Reporting

## Purpose

Sales analytics over the shared order store: summary totals, hourly/daily
breakdowns, cashier performance, payment-method breakdown, per-register
breakdown, and CSV export. Standalone/offline registers compute locally from
the SQLite `orders` table; client registers call the Store API, which
aggregates server-side so reports are **store-wide across all registers**
(ADR-018). (Shift open/close + Z-report lives in the orders-sync feature;
this is the analytics surface.)

## Scope

### Included

- `ReportingService` — report types over a `from/to` timestamp range:
  `getFullReport` (single fetch: summary, hour/day buckets, cashier,
  payment, register breakdowns), the individual `get*` methods, and
  `exportOrdersCsv`.
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
   → ReportingService.getFullReport(from, to)
     → standalone: one findByDateRange on local SQLite, aggregates in-app
     → client:     GET /api/reports/sales?from&to&tzOffset on the Store API
                  (server aggregates over all registers; tzOffset keeps
                  hour/day buckets on the register's clock)
   → only 'paid'+'synced' orders count toward sales
   → CSV button → exportOrdersCsv
     → standalone: local toCsv; client: GET /api/reports/orders.csv
   → Share.share({message: csv})
```

## Implementation Map

| Layer        | Responsibility                  | Implementation                                                               |
| ------------ | ------------------------------- | ---------------------------------------------------------------------------- |
| Screens      | Report UI, range picker, export | `features/reporting/screens/ReportingScreen.tsx`                             |
| Hooks        | Hook wrapper                    | `features/reporting/hooks/useReporting.ts`                                   |
| Services     | Aggregations + CSV              | `features/reporting/services/ReportingService.ts`                            |
| Repositories | Source rows                     | `features/orders-sync/repositories/{OrderRepository,OrderItemRepository}.ts` |
| Libs         | CSV escaping                    | `shared/utils/csv.ts` (X-R3)                                                 |

## Rules (summary — see rules.md)

- Sales metrics count only `paid`/`synced` orders.
- `netSales = totalSales − totalTax`; `averageOrderValue = totalSales / count`.
- Hourly buckets are always 24, labelled `HH:00`; day buckets use the
  register's local timezone (client passes `tzOffset` to the server).
- Cashier performance groups by `cashier_id` (`'unknown'` when null), sorted
  desc by sales. Register breakdown groups by `register_id` the same way.
- Payment breakdown is split-tender aware — `payments_json` lines count
  toward their own method; single-tender orders use `payment_method`.
- All monetary aggregation goes through `shared/utils/money.ts` (ADR-006).
- CSV cells are formula-injection escaped (X-R3).
- Client-mode reports are **store-wide**; `registerId` can scope the server
  query when a per-register view is needed.

## Data Ownership (per deployment mode)

| Setup                        | Where orders live                 | Report source                                    | Online-platform sync                                                          |
| ---------------------------- | --------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------- |
| Single POS, offline platform | Local SQLite                      | Local SQLite                                     | n/a — orders self-mark `synced`                                               |
| Single POS, online platform  | Local SQLite                      | Local SQLite                                     | `OrderSyncService` pushes, `updateSync*` updates local rows                   |
| Multi-POS (client registers) | Store API server (`orders` table) | Store API `/api/reports/*`                       | Register pushes to platform, then `PUT /api/orders/{id}/sync` records outcome |
| Multi-POS + online platform  | Store API server                  | Store API `/api/reports/*` — still authoritative | Same — platform is an external target, not a data source for reports          |

Reports never read from the online platform. Web orders placed directly on
the platform are not counted (POS-sales reports only), except Commercefull
`order.created` webhooks which the sync layer writes into the order store.

## State Ownership

| State                 | Owner                   | Persistence                 | Reset condition |
| --------------------- | ----------------------- | --------------------------- | --------------- |
| Report inputs (range) | Screen local            | None                        | Unmount         |
| Report data           | Derived from order repo | SQLite / Store API (client) | n/a             |

## Dependencies

- `shared/utils/csv.ts` — safe CSV cell escaping.
- `Share` API — export delivery.
- Order repositories — the data source.

## Side Effects

- CSV export shares text via OS share sheet.
- No writes — reporting is read-only.
