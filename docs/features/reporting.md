# Reporting

## User Story

**As a** retail store manager  
**I want to** view sales reports and cashier performance  
**So that** I can track business performance and make informed decisions

## Rules

- Date ranges: today, yesterday, week, month
- Summary metrics: total sales, order count, average order value, tax collected
- Charts: hourly breakdown (today/yesterday) or daily breakdown (week/month)
- Payment method breakdown with percentages
- Cashier performance ranked by total sales
- CSV export for external analysis
- Currency formatting from store settings

---

## Flow 1: View Daily Sales Report

1. **Manager opens More → Reports** → ReportingScreen loads
2. **Default range: "Today"** → useReporting hook fetches data
3. **Summary cards render** → total sales, orders, AOV, tax
4. **Hourly bar chart** → sales per hour, bars proportional to amount, zero-hours filtered
5. **Payment breakdown** → each method: name, order count, total, percentage
6. **Cashier performance** → name, orders, total sales, AOV — ranked by volume

## Flow 2: Change Date Range

1. **Manager taps "Week" or "Month"** → date range selector updates
2. **Data reloads automatically** → loading spinner shown
3. **Chart switches** → hourly → daily breakdown for week/month
4. **All sections update** → summary, chart, payments, cashiers reflect new range

## Flow 3: CSV Export

1. **Manager taps export button** → exportCsv() generates CSV string
2. **CSV includes** → all report data: summary, hourly/daily breakdown, payment methods, cashier stats
3. **Native share sheet opens** → save to files, email, or other apps
4. **Filename includes date range** → e.g. "report_2026-02-20_today.csv"
5. **Export failure** → "Export Failed" alert shown

## Flow 4: Error Handling

1. **Data fetch fails** → error message box displayed
2. **Previous data preserved** → if available, still shown while error displayed
3. **Retry** → changing date range triggers fresh fetch

## Questions

- How are refunds and voids reflected in sales totals?
- How does the system handle timezone differences in reporting?
- Are reports cached locally for offline access?
- What data retention policies apply to historical report data?
