import { validateReturnRequest, ReturnValidationContext } from './returnValidation';

const ctx = (overrides: Partial<ReturnValidationContext> = {}): ReturnValidationContext => ({
  orderStatus: 'paid',
  orderTotal: 30,
  orderItems: [
    { id: 'line-1', product_id: 'p1', quantity: 2, price: 10, tax_rate: null },
    { id: 'line-2', product_id: 'p2', quantity: 1, price: 10, tax_rate: null },
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

  it('reserves quantity for pending returns but frees it once rejected', () => {
    // 1 of 2 already pending → only 1 remains returnable
    const pending = [{ order_item_id: 'line-1', product_id: 'p1', quantity: 1, refund_amount: 10, status: 'pending' }];
    expect(
      validateReturnRequest([{ orderItemId: 'line-1', productId: 'p1', quantity: 2, refundAmount: 2 }], ctx({ existingReturns: pending }))
    ).toMatch(/exceeds the quantity/);
    expect(
      validateReturnRequest([{ orderItemId: 'line-1', productId: 'p1', quantity: 1, refundAmount: 2 }], ctx({ existingReturns: pending }))
    ).toBeNull();

    // Rejected returns release the reservation
    const rejected = [{ order_item_id: 'line-1', product_id: 'p1', quantity: 1, refund_amount: 10, status: 'rejected' }];
    expect(
      validateReturnRequest([{ orderItemId: 'line-1', productId: 'p1', quantity: 2, refundAmount: 2 }], ctx({ existingReturns: rejected }))
    ).toBeNull();
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

  it('caps the refund per line at what was actually paid for it (RET-03)', () => {
    // $1 line inside a $100 order: cannot refund the whole order against it.
    const bigOrder = ctx({
      orderTotal: 100,
      orderItems: [
        { id: 'line-1', product_id: 'p1', quantity: 1, price: 1, tax_rate: null },
        { id: 'line-2', product_id: 'p2', quantity: 1, price: 99, tax_rate: null },
      ],
    });
    expect(validateReturnRequest([{ orderItemId: 'line-1', productId: 'p1', quantity: 1, refundAmount: 100 }], bigOrder)).toMatch(
      /amount paid for this item/
    );
    expect(validateReturnRequest([{ orderItemId: 'line-1', productId: 'p1', quantity: 1, refundAmount: 1 }], bigOrder)).toBeNull();
  });

  it('allocates order discounts across lines so discounted orders do not over-refund (RET-03)', () => {
    // Two $50 lines, $20 order discount → each line paid $40.
    const discounted = ctx({
      orderSubtotal: 100,
      orderDiscount: 20,
      orderTotal: 80,
      orderItems: [
        { id: 'line-1', product_id: 'p1', quantity: 1, price: 50, tax_rate: null },
        { id: 'line-2', product_id: 'p2', quantity: 1, price: 50, tax_rate: null },
      ],
    });
    // $50 (raw price) exceeds the $40 paid share → rejected
    expect(validateReturnRequest([{ orderItemId: 'line-1', productId: 'p1', quantity: 1, refundAmount: 50 }], discounted)).toMatch(
      /amount paid for this item/
    );
    // $40 per line is refundable on both lines
    expect(validateReturnRequest([{ orderItemId: 'line-1', productId: 'p1', quantity: 1, refundAmount: 40 }], discounted)).toBeNull();
    // A prior $40 return already consumed the paid share: another refund on
    // the same line is capped even though quantity remains on a 2-unit line.
    const twoUnit = ctx({
      orderSubtotal: 150,
      orderDiscount: 30,
      orderTotal: 120,
      orderItems: [
        { id: 'line-1', product_id: 'p1', quantity: 2, price: 50, tax_rate: null },
        { id: 'line-2', product_id: 'p2', quantity: 1, price: 50, tax_rate: null },
      ],
    });
    const prior = [{ order_item_id: 'line-1', product_id: 'p1', quantity: 1, refund_amount: 40, status: 'completed' }];
    // Line paid $80 for 2 units → $40/unit; $40 already refunded → exactly $40 remains
    expect(
      validateReturnRequest([{ orderItemId: 'line-1', productId: 'p1', quantity: 1, refundAmount: 40.01 }], {
        ...twoUnit,
        existingReturns: prior,
      })
    ).toMatch(/amount paid for this item/);
    expect(
      validateReturnRequest([{ orderItemId: 'line-1', productId: 'p1', quantity: 1, refundAmount: 40 }], {
        ...twoUnit,
        existingReturns: prior,
      })
    ).toBeNull();
  });

  it('includes the line tax in the refundable amount', () => {
    // 2 × $50 at 20% tax → $120 paid total, $60 refundable per unit.
    const taxed = ctx({
      orderTotal: 120,
      orderItems: [{ id: 'line-1', product_id: 'p1', quantity: 2, price: 50, tax_rate: 0.2 }],
    });
    expect(validateReturnRequest([{ orderItemId: 'line-1', productId: 'p1', quantity: 1, refundAmount: 60.01 }], taxed)).toMatch(
      /amount paid for this item/
    );
    expect(validateReturnRequest([{ orderItemId: 'line-1', productId: 'p1', quantity: 1, refundAmount: 60 }], taxed)).toBeNull();
  });
});
