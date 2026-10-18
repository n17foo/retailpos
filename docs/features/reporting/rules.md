# Reporting — Rules

## R1 — Only `paid`/`synced` orders count

**Rule.** Every aggregation filters to orders with status `paid` or `synced` —
drafts, pending, failed, cancelled are excluded from sales metrics.

**Evidence.** `features/reporting/services/ReportingService.ts`, tests
("counts only paid and synced orders").

🟢 **E1.1** — a failed/draft order never inflates totals.

🟠 **E1.2 — `pending` sync orders still count** — a paid order unsynced to
the platform _is_ in sales (status `paid`) — correct: the sale happened.

## R2 — Money fields derive consistently

**Rule.** `totalSales`, `totalTax`, `totalDiscount` sum raw;
`netSales = totalSales − totalTax`; `averageOrderValue = totalSales / count`
(0 when empty → all zeros).

**Evidence.** `ReportingService.ts`, tests.

🟢 **E2.1** — empty range → zeros everywhere, not errors.

## R3 — Buckets and groupings are stable

**Rule.** `getSalesByHour` always returns 24 buckets labelled `HH:00`;
`getSalesByDay` one entry per distinct order day, ascending;
`getCashierPerformance` groups by `cashier_id` (`'unknown'` fallback) sorted
by sales desc; `getPaymentBreakdown` groups by `payment_method`.

**Evidence.** `ReportingService.ts`, tests.

🟠 **E3.1 — Device-local boundaries** — same local-midnight caveat as
order history (shared-libs PG8).

## R4 — CSV export escapes formula injection

**Rule.** `exportOrdersCsv` cells go through `escapeCsvCell` — `= + - @` etc.
prefixed unless a plain number; RFC 4180 quoting.

**Evidence.** `shared/utils/csv.ts` (X-R3), `ReportingService.exportOrdersCsv`.

🟢 **E4.1** — product named `=cmd…` exports as text, not a formula.

## R5 — Export shares via OS sheet; failure is an alert

**Rule.** CSV → `Share.share({message: csv})`; share failure →
`'Export Failed'` alert.

**Evidence.** `features/reporting/screens/ReportingScreen.tsx:61-64`.

🔴 **E5.1** — large ranges build the whole CSV in memory — no streaming (PG1).

## R6 — Reporting is read-only and role-gated

**Rule.** Manager/admin surface (More menu); no writes — reports are derived.

## ❓ Open Questions

- **Q1** — Does `totalDiscount` come from `order.discount_amount`, and does
  `netSales` subtract discounts too, or only tax?
- **Q2** — Timezone of the range picker — local-day semantics consistent
  with order-history?

## ⚠️ Potential Gaps

- **PG1** — Whole CSV in memory for export — very large histories could hit
  memory/share limits.
- **PG2** — `payment_method` null/unknown grouping — unverified label.
- **PG3** — Multi-register: server-register reports include all registers'
  orders? (`register_id` column exists — grouping unverified.)

## Test Coverage Mapping

| Example               | Coverage                                   |
| --------------------- | ------------------------------------------ |
| R1 paid/synced filter | `ReportingService.test.ts`                 |
| R2/R3 maths+buckets   | `ReportingService.test.ts` (comprehensive) |
| R4 CSV escaping       | `csv.test.ts`                              |
| R5 export UX          | Not found                                  |

## Feature Context Summary

**Feature**: Reporting
**Responsibility**: Read-only sales analytics + CSV export over local orders.

**Core rules**

- R1 paid/synced only.
- R2 net = sales − tax; AOV = sales/count.
- R3 Stable buckets/groupings (24 hourly, per-day, by cashier/method).
- R4 CSV formula-safe.
- R5 Export via OS share; failure → alert.
- R6 Read-only, manager/admin.

**Offline**: fully local (SQLite) — works with zero connectivity.

**Gaps**: in-memory CSV; register grouping unverified.
