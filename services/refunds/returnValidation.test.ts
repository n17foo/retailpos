import { validateReturnRequest, ReturnValidationContext } from './returnValidation';

const ctx = (overrides: Partial<ReturnValidationContext> = {}): ReturnValidationContext => ({
  orderStatus: 'paid',
  orderTotal: 30,
  orderItems: [
    { id: 'line-1', product_id: 'p1', quantity: 2 },
    { id: 'line-2', product_id: 'p2', quantity: 1 },
  ],
  existingReturns: [],
  ...overrides,
});

describe('validateReturnRequest', () => {
  it('accepts a return within sold quantity and paid total', () => {
    expect(validateReturnRequest([{ orderItemId: 'line-1', productId: 'p1', quantity: 2, refundAmount: 20 }], ctx())).toBeNull();
  });

  it('rejects unpaid orders', () => {
    expect(validateReturnRequest([{ productId: 'p1', quantity: 1, refundAmount: 1 }], ctx({ orderStatus: 'pending' }))).toMatch(/paid/);
  });

  it('rejects non-positive, fractional quantities and negative refunds', () => {
    expect(validateReturnRequest([{ productId: 'p1', quantity: 0, refundAmount: 1 }], ctx())).toMatch(/quantity/);
    expect(validateReturnRequest([{ productId: 'p1', quantity: 1.5, refundAmount: 1 }], ctx())).toMatch(/quantity/);
    expect(validateReturnRequest([{ productId: 'p1', quantity: 1, refundAmount: -5 }], ctx())).toMatch(/Refund amount/);
    expect(validateReturnRequest([{ productId: 'p1', quantity: 1, refundAmount: Number.NaN }], ctx())).toMatch(/Refund amount/);
  });

  it('rejects items that are not on the order', () => {
    expect(validateReturnRequest([{ orderItemId: 'line-9', productId: 'p1', quantity: 1, refundAmount: 1 }], ctx())).toMatch(/belong/);
    expect(validateReturnRequest([{ orderItemId: 'line-1', productId: 'p2', quantity: 1, refundAmount: 1 }], ctx())).toMatch(/belong/);
  });

  it('rejects returning more than was sold, including split lines and prior returns', () => {
    expect(
      validateReturnRequest(
        [
          { orderItemId: 'line-1', productId: 'p1', quantity: 1, refundAmount: 1 },
          { orderItemId: 'line-1', productId: 'p1', quantity: 2, refundAmount: 1 },
        ],
        ctx()
      )
    ).toMatch(/exceeds the quantity/);

    const prior = [{ order_item_id: 'line-1', product_id: 'p1', quantity: 2, refund_amount: 20, status: 'completed' }];
    expect(
      validateReturnRequest([{ orderItemId: 'line-1', productId: 'p1', quantity: 1, refundAmount: 1 }], ctx({ existingReturns: prior }))
    ).toMatch(/exceeds the quantity/);
  });

  it('caps the cumulative refund at the order total', () => {
    const prior = [{ order_item_id: 'line-1', product_id: 'p1', quantity: 1, refund_amount: 25, status: 'completed' }];
    expect(
      validateReturnRequest([{ orderItemId: 'line-2', productId: 'p2', quantity: 1, refundAmount: 5.01 }], ctx({ existingReturns: prior }))
    ).toMatch(/exceeds the amount paid/);
    expect(
      validateReturnRequest([{ orderItemId: 'line-2', productId: 'p2', quantity: 1, refundAmount: 5 }], ctx({ existingReturns: prior }))
    ).toBeNull();
  });
});
