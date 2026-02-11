import {
  toCents,
  toDollars,
  roundMoney,
  multiplyMoney,
  addMoney,
  subtractMoney,
  sumMoney,
  calculateTax,
  calculateLineTotal,
} from './money';

describe('money utilities', () => {
  // ─── toCents ────────────────────────────────────────────────
  describe('toCents', () => {
    it('converts whole dollars', () => {
      expect(toCents(1)).toBe(100);
      expect(toCents(0)).toBe(0);
      expect(toCents(100)).toBe(10000);
    });

    it('converts fractional dollars', () => {
      expect(toCents(1.5)).toBe(150);
      expect(toCents(19.99)).toBe(1999);
      expect(toCents(0.01)).toBe(1);
    });

    it('rounds half-cent values', () => {
      // Note: 1.005 cannot be represented exactly in IEEE 754,
      // so 1.005 * 100 = 100.4999... which rounds to 100.
      // In POS, prices always have at most 2 decimals so this is safe.
      expect(toCents(1.005)).toBe(100);
      expect(toCents(1.994)).toBe(199);
      expect(toCents(1.995)).toBe(200);
    });

    it('handles negative amounts', () => {
      expect(toCents(-5.50)).toBe(-550);
    });
  });

  // ─── toDollars ──────────────────────────────────────────────
  describe('toDollars', () => {
    it('converts cents to dollars', () => {
      expect(toDollars(100)).toBe(1);
      expect(toDollars(199)).toBe(1.99);
      expect(toDollars(0)).toBe(0);
    });

    it('handles negative cents', () => {
      expect(toDollars(-550)).toBe(-5.5);
    });
  });

  // ─── roundMoney ─────────────────────────────────────────────
  describe('roundMoney', () => {
    it('rounds to 2 decimal places', () => {
      expect(roundMoney(1.001)).toBe(1);
      // 1.005 has the same IEEE 754 edge case as toCents
      expect(roundMoney(1.005)).toBe(1);
      expect(roundMoney(1.999)).toBe(2);
    });

    it('leaves clean values unchanged', () => {
      expect(roundMoney(10.50)).toBe(10.5);
      expect(roundMoney(0)).toBe(0);
    });
  });

  // ─── multiplyMoney ─────────────────────────────────────────
  describe('multiplyMoney', () => {
    it('multiplies price by quantity without float errors', () => {
      // Classic float bug: 1.10 * 3 === 3.3000000000000003
      expect(multiplyMoney(1.10, 3)).toBe(3.30);
      expect(multiplyMoney(0.10, 3)).toBe(0.30);
      expect(multiplyMoney(19.99, 2)).toBe(39.98);
    });

    it('handles zero quantity', () => {
      expect(multiplyMoney(9.99, 0)).toBe(0);
    });

    it('handles large quantities', () => {
      expect(multiplyMoney(0.99, 1000)).toBe(990);
    });
  });

  // ─── addMoney ───────────────────────────────────────────────
  describe('addMoney', () => {
    it('adds without float errors', () => {
      // Classic: 0.1 + 0.2 !== 0.3
      expect(addMoney(0.1, 0.2)).toBe(0.3);
      expect(addMoney(1.23, 4.56)).toBe(5.79);
    });

    it('handles zero', () => {
      expect(addMoney(5.00, 0)).toBe(5);
    });

    it('handles negatives', () => {
      expect(addMoney(10, -3.50)).toBe(6.5);
    });
  });

  // ─── subtractMoney ─────────────────────────────────────────
  describe('subtractMoney', () => {
    it('subtracts without float errors', () => {
      expect(subtractMoney(0.3, 0.1)).toBe(0.2);
      expect(subtractMoney(10.00, 3.33)).toBe(6.67);
    });

    it('can produce negative results', () => {
      expect(subtractMoney(1, 5)).toBe(-4);
    });
  });

  // ─── sumMoney ───────────────────────────────────────────────
  describe('sumMoney', () => {
    it('sums an array without float errors', () => {
      expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
      expect(sumMoney([19.99, 5.49, 3.00])).toBe(28.48);
    });

    it('returns 0 for empty array', () => {
      expect(sumMoney([])).toBe(0);
    });

    it('handles single element', () => {
      expect(sumMoney([42.42])).toBe(42.42);
    });

    it('handles many small values', () => {
      const items = Array(100).fill(0.01);
      expect(sumMoney(items)).toBe(1);
    });
  });

  // ─── calculateTax ──────────────────────────────────────────
  describe('calculateTax', () => {
    it('calculates 8% tax correctly', () => {
      expect(calculateTax(100, 0.08)).toBe(8);
      expect(calculateTax(10.00, 0.08)).toBe(0.80);
      expect(calculateTax(19.99, 0.08)).toBe(1.60); // 1.5992 rounds to 1.60
    });

    it('calculates 0% tax', () => {
      expect(calculateTax(100, 0)).toBe(0);
    });

    it('handles small amounts', () => {
      expect(calculateTax(0.50, 0.08)).toBe(0.04);
    });

    it('handles non-standard tax rates', () => {
      // 7.25% California rate
      expect(calculateTax(10.00, 0.0725)).toBe(0.73); // 72.5 cents rounds to 73
    });
  });

  // ─── calculateLineTotal ────────────────────────────────────
  describe('calculateLineTotal', () => {
    it('returns correct line total and tax for taxable items', () => {
      const result = calculateLineTotal(9.99, 2, true, 0.08);
      expect(result.lineTotal).toBe(19.98);
      expect(result.taxAmount).toBe(1.60); // 19.98 * 0.08 = 1.5984 → rounds to 1.60
    });

    it('returns 0 tax for non-taxable items', () => {
      const result = calculateLineTotal(9.99, 2, false, 0.08);
      expect(result.lineTotal).toBe(19.98);
      expect(result.taxAmount).toBe(0);
    });

    it('handles single quantity', () => {
      const result = calculateLineTotal(1.10, 1, true, 0.08);
      expect(result.lineTotal).toBe(1.10);
      expect(result.taxAmount).toBe(0.09); // 110 * 0.08 = 8.8 → rounds to 9 cents
    });

    it('handles the classic 0.1 + 0.2 accumulation', () => {
      // 3 items at $0.10 each, taxable at 10%
      const result = calculateLineTotal(0.10, 3, true, 0.10);
      expect(result.lineTotal).toBe(0.30);
      expect(result.taxAmount).toBe(0.03);
    });
  });
});
