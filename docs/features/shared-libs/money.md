# Money & Currency

**Files:** `utils/money.ts`, `utils/currency.ts`
**Tests:** `utils/money.test.ts` | **Docs:** `docs/adr/ADR-006-*`
**Parent:** [`rules.md`](rules.md)

---

## M-R1 — Money is stored/compared in integer cents

**Rule**
Every public helper converts dollars→cents (`Math.round(d * 100)`), computes in
integers, and converts back. Callers must not do raw float math.

**Evidence** — `utils/money.ts`, `utils/money.test.ts`, ADR-006, ~34 consumers.

🟢 **E1.1 — Exact totals**
`sumMoney([19.99, 0.01])` → `20` exactly.

🔴 **E1.2 — Half-cent input**
`toCents(1.005)` → `100` (IEEE-754: `1.005*100 = 100.4999…`). Safe because POS
prices have ≤2 decimals — documented in the test.

🟠 **E1.3 — Fractional quantity**
`multiplyMoney` assumes integer quantity (`toCents(price) * quantity`); a
fractional quantity yields a rounded, possibly surprising cents value. The type
system does not prevent it. Potential gap (PG11).

🟠 **E1.4 — Negatives**
`toCents(-5.5)` → `-550`; helpers preserve sign.

## M-R2 — Display is always 2 decimals, symbol placement from the currency table

**Rule**
`formatMoney(amount, code)` → `symbol + amount.toFixed(decimals)`, or
`amount + symbol` when `symbolPlacement === 'after'`. Unknown code ⇒ the code
itself becomes the symbol.

**Evidence** — `utils/money.ts:44`, `utils/currency.ts` (55-currency table;
`after` only for VND, RUB, UAH, CZK, HUF, RON, BGN, HRK, ISK, LEK).

🟢 **E2.1** — `formatMoney(19.99,'USD')` → `$19.99`; `formatMoney(19.99,'RUB')` → `19.99₽`.

🔴 **E2.2 — Unknown currency**
`formatMoney(5,'XXX')` → `XXX5.00` (code as symbol, before-placement default).
No warning — silent fallback.

🟠 **E2.3 — Zero-decimal currency**
JPY/KRW/VND still render `.00` (PG9); the table has no decimal-places field.

🟠 **E2.4** — JPY and CNY share `¥`; `getCurrencySymbol` cannot disambiguate —
callers must show the code when it matters.

## ❓ Questions

- **M-Q1** — Is 2-decimal display acceptable for the deployed zero-decimal
  currencies, or should `CurrencyInfo` gain `decimals`?
- **M-Q2** — `getCurrencyOptions` label format `Name (symbol)` — used by
  settings pickers; is the ordering (USD-first? alphabetical?) specified
  anywhere?

## Coverage

| Example   | Behaviour             | Coverage        |
| --------- | --------------------- | --------------- |
| E1.1/E1.2 | cent math, rounding   | `money.test.ts` |
| E1.3      | fractional quantity   | Not found       |
| E2.x      | formatting, placement | Not found       |
