import { applyTaxQuote } from './taxQuote';

describe('applyTaxQuote', () => {
  it('adds the platform effective rate on top of the price', () => {
    expect(applyTaxQuote(100, 0, { subtotal: 100, tax: 20, taxIncluded: false })).toEqual({ subtotal: 100, tax: 20, total: 120 });
  });

  it('taxes the discounted amount, not the full price', () => {
    expect(applyTaxQuote(100, 10, { subtotal: 100, tax: 20, taxIncluded: false })).toEqual({ subtotal: 100, tax: 18, total: 108 });
  });

  it('derives the rate from the platform subtotal, so a different platform price does not skew it', () => {
    expect(applyTaxQuote(50, 0, { subtotal: 200, tax: 40, taxIncluded: false })).toEqual({ subtotal: 50, tax: 10, total: 60 });
  });

  it('keeps the total for tax-inclusive prices and reports the included tax', () => {
    expect(applyTaxQuote(120, 0, { subtotal: 100, tax: 20, taxIncluded: true })).toEqual({ subtotal: 120, tax: 20, total: 120 });
  });

  it('reports inclusive tax on the discounted amount', () => {
    expect(applyTaxQuote(120, 12, { subtotal: 100, tax: 20, taxIncluded: true })).toEqual({ subtotal: 120, tax: 18, total: 108 });
  });

  it('charges no tax when the platform returned none', () => {
    expect(applyTaxQuote(100, 0, { subtotal: 100, tax: 0, taxIncluded: false })).toEqual({ subtotal: 100, tax: 0, total: 100 });
  });

  it('never goes below zero when the discount exceeds the price', () => {
    expect(applyTaxQuote(10, 25, { subtotal: 10, tax: 2, taxIncluded: false })).toEqual({ subtotal: 10, tax: 0, total: 0 });
  });
});
