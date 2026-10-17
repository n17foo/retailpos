import { toCents, toDollars, roundMoney, multiplyMoney, addMoney, subtractMoney, sumMoney, formatMoney } from './money';

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
      expect(toCents(-5.5)).toBe(-550);
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
      expect(roundMoney(10.5)).toBe(10.5);
      expect(roundMoney(0)).toBe(0);
    });
  });

  // ─── multiplyMoney ─────────────────────────────────────────
  describe('multiplyMoney', () => {
    it('multiplies price by quantity without float errors', () => {
      // Classic float bug: 1.10 * 3 === 3.3000000000000003
      expect(multiplyMoney(1.1, 3)).toBe(3.3);
      expect(multiplyMoney(0.1, 3)).toBe(0.3);
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
      expect(addMoney(5.0, 0)).toBe(5);
    });

    it('handles negatives', () => {
      expect(addMoney(10, -3.5)).toBe(6.5);
    });
  });

  // ─── subtractMoney ─────────────────────────────────────────
  describe('subtractMoney', () => {
    it('subtracts without float errors', () => {
      expect(subtractMoney(0.3, 0.1)).toBe(0.2);
      expect(subtractMoney(10.0, 3.33)).toBe(6.67);
    });

    it('can produce negative results', () => {
      expect(subtractMoney(1, 5)).toBe(-4);
    });
  });

  // ─── sumMoney ───────────────────────────────────────────────
  describe('sumMoney', () => {
    it('sums an array without float errors', () => {
      expect(sumMoney([0.1, 0.2, 0.3])).toBe(0.6);
      expect(sumMoney([19.99, 5.49, 3.0])).toBe(28.48);
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

  describe('formatMoney', () => {
    it('renders 2 decimals for standard currencies', () => {
      expect(formatMoney(19.99, 'GBP')).toBe('£19.99');
      expect(formatMoney(5, 'USD')).toBe('$5.00');
    });

    it('renders no decimals for zero-decimal currencies', () => {
      expect(formatMoney(1200, 'JPY')).toBe('¥1200');
      expect(formatMoney(1200.4, 'JPY')).toBe('¥1200');
      expect(formatMoney(500, 'VND')).toBe('500₫');
    });

    it('renders 3 decimals for three-decimal currencies', () => {
      expect(formatMoney(1.5, 'KWD')).toBe('KD1.500');
    });

    it('falls back to the currency code for unknown currencies', () => {
      expect(formatMoney(9.99, 'XXX')).toBe('XXX9.99');
    });
  });
});
