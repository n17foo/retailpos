# Misc Domain Helpers

**Files:** `features/hardware/utils/printerSettings.utils.ts`, `features/inventory/utils/inventoryScanner.utils.ts`,
`shared/utils/csv.ts`
**Tests:** `printerSettings.utils.test.ts`, `inventoryScanner.utils.test.ts`,
`csv.test.ts`
**Parent:** [`rules.md`](rules.md)

---

## X-R1 — Printer settings validate per connection type

**Rule**
`validatePrinterSettings` fails fast: name required; BLUETOOTH ⇒ MAC format
`XX:XX…`/`-` separated; NETWORK ⇒ dotted-quad IP **and** port 1–65535; USB ⇒
vendorId+productId required. Unknown connection type ⇒ falls through the
switch → valid (only the name check applied).

**Evidence** — `features/hardware/utils/printerSettings.utils.ts`; consumed by
`features/hardware/hooks/usePrinterSettings.ts`.

🟢 **E1.1** — NETWORK + `192.168.1.50` + `9100` → valid.

🔴 **E1.2** — BLUETOOTH + `zz:zz` → `'Invalid MAC address format'`.

🟠 **E1.3 — IP shape only** — `999.999.999.999` passes the regex
(`\d{1,3}` per octet, no 0–255 bound). Documented looseness, not a bug per se.

🟠 **E1.4 — Unknown type** — a new connection type string silently validates
(name-only). Fail-open — flag if new types are added (PG12).

## X-R2 — Inventory scan matches SKU first, then productId

**Rule**
`findInventoryScanMatch(barcode, items)` → first item with `sku === barcode`
**or** `productId === barcode` (single `find` — SKU precedence only because it
appears in the same predicate); returns `{itemKey: productId-variantId, name, quantity}` or null.

**Evidence** — `features/inventory/utils/inventoryScanner.utils.ts`; used by `useInventoryScanner`.

🟢 **E2.1** — barcode `SKU-42` → matches the item with `sku='SKU-42'`.

🔴 **E2.2** — no match → `null`; caller decides feedback (no alert on
not-found per sale spec).

🟠 **E2.3** — `itemKey` uses `'-'` join: `productId` + `-` + `variantId|''`;
a SKU that equals another product's `productId` collides — whichever `find`
hits first wins. Edge, unlikely in practice.

## X-R3 — Exported CSV is formula-injection safe and RFC 4180 quoted

**Rule**
`escapeCsvCell`: null/undefined → `''`; text starting with `= + - @ \t \r`
gets a `'` prefix **unless** it's a plain number (`-?\d+(\.\d+)?`); cells
containing `"` `,` or newlines are double-quoted with `"`→`""`.

**Evidence** — `shared/utils/csv.ts`; consumed by `AuditLogService` CSV export.

🟢 **E3.1** — `=cmd|'/c calc'!A1` → `'=cmd…` (Excel renders as text).

🟠 **E3.2** — `-5` and `-5.5` pass un-prefixed (plain-number exception);
`-5x` gets prefixed.

🟠 **E3.3** — `He said "hi"` → `"He said ""hi"""`.

## ❓ Questions

- ~~**X-Q1**~~ — resolved: `validatePrinterSettings` now returns i18n keys
  (`settings.printer.validation.*`); `usePrinterSettings` translates them.
  (C2)?
- **X-Q2** — Should IP validation bound octets to 0–255, or is the loose regex
  intentional for speed?

## Coverage

| Example                  | Coverage                         |
| ------------------------ | -------------------------------- |
| X-R1 per-type validation | `printerSettings.utils.test.ts`  |
| X-R2 scan match          | `inventoryScanner.utils.test.ts` |
| X-R3 escaping            | `csv.test.ts`                    |
