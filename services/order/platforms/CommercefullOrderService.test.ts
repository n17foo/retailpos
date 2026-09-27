// Mock the shared API client before imports
const mockApiClient = {
  configure: jest.fn(),
  initialize: jest.fn().mockResolvedValue(true),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../../clients/commercefull/CommercefullApiClient', () => ({
  CommercefullApiClient: {
    getInstance: jest.fn(() => mockApiClient),
  },
}));

jest.mock('../../logger/LoggerFactory', () => ({
  LoggerFactory: {
    getInstance: jest.fn(() => ({
      createLogger: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
    })),
  },
}));

import { CommercefullOrderService } from './CommercefullOrderService';
import { Order } from '../OrderServiceInterface';

const envelope = (data: unknown) => ({ success: true, data });

describe('CommercefullOrderService', () => {
  let service: CommercefullOrderService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new CommercefullOrderService({ storeUrl: 'https://api.example.com', apiKey: 'k', apiSecret: 's' });
    await service.initialize();
  });

  it('should create orders via POST /business/orders with integer-cent items and pos source', async () => {
    const order: Order = {
      customerEmail: 'walkin@example.com',
      lineItems: [{ productId: 'p1', variantId: 'v1', sku: 'SKU-1', name: 'Widget', quantity: 2, price: 12.5, total: 25 }],
      subtotal: 25,
      tax: 5,
      total: 30,
      paymentStatus: 'paid',
      fulfillmentStatus: 'fulfilled',
      note: 'POS sale',
    };

    mockApiClient.post.mockResolvedValueOnce(
      envelope({
        orderId: 'o1',
        orderNumber: 'ORD-1',
        subtotalCents: 2500,
        taxTotalCents: 500,
        totalAmountCents: 3000,
        paymentStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
        items: [],
      })
    );
    mockApiClient.put.mockResolvedValue(envelope({}));
    mockApiClient.get.mockResolvedValueOnce(
      envelope({
        orderId: 'o1',
        subtotalCents: 2500,
        taxTotalCents: 500,
        totalAmountCents: 3000,
        paymentStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
        items: [],
        customerNotes: 'POS sale',
      })
    );

    const result = await service.createOrder(order);

    const [url, body] = mockApiClient.post.mock.calls[0];
    expect(url).toBe('/business/orders');
    expect(body.orderSource).toBe('pos');
    expect(body.customerEmail).toBe('walkin@example.com');
    expect(body.items[0]).toMatchObject({ productId: 'p1', productVariantId: 'v1', sku: 'SKU-1', quantity: 2, unitPriceCents: 1250 });

    // Dedicated status endpoints, not the obsolete combined route
    expect(mockApiClient.put).toHaveBeenCalledWith('/business/orders/o1/payment-status', { paymentStatus: 'paid' });
    expect(mockApiClient.put).toHaveBeenCalledWith('/business/orders/o1/fulfillment-status', { fulfillmentStatus: 'fulfilled' });
    expect(mockApiClient.put).not.toHaveBeenCalledWith('/business/orders/o1/status', expect.anything());

    expect(result.id).toBe('o1');
    expect(result.total).toBe(30);
    expect(result.subtotal).toBe(25);
    expect(result.tax).toBe(5);
  });

  it('should support walk-in orders without customer email or addresses', async () => {
    const order: Order = {
      lineItems: [{ productId: 'p1', sku: 'SKU-1', name: 'Widget', quantity: 1, price: 10, total: 10 }],
      subtotal: 10,
      tax: 0,
      total: 10,
    };

    mockApiClient.post.mockResolvedValueOnce(envelope({ orderId: 'o2', totalAmountCents: 1000, items: [] }));
    mockApiClient.get.mockResolvedValueOnce(
      envelope({ orderId: 'o2', totalAmountCents: 1000, items: [], paymentStatus: 'pending', fulfillmentStatus: 'unfulfilled' })
    );

    await service.createOrder(order);

    const [, body] = mockApiClient.post.mock.calls[0];
    expect(body.customerEmail).toBeUndefined();
    expect(body.shippingAddress).toBeUndefined();
    expect(body.billingAddress).toBeUndefined();
    // Default statuses map to platform defaults — no extra status calls
    expect(mockApiClient.put).not.toHaveBeenCalled();
  });

  it('should map order detail cents fields to dollars', async () => {
    mockApiClient.get.mockResolvedValueOnce(
      envelope({
        orderId: 'o3',
        customerEmail: 'c@example.com',
        customerNotes: 'leave at counter',
        subtotalCents: 4250,
        taxTotalCents: 850,
        totalAmountCents: 5100,
        paymentStatus: 'partiallyRefunded',
        fulfillmentStatus: 'partiallyFulfilled',
        items: [
          {
            orderItemId: 'i1',
            productId: 'p1',
            productVariantId: 'v9',
            sku: 'SKU-1',
            name: 'Widget',
            quantity: 2,
            unitPriceCents: 2125,
            lineTotalCents: 4250,
            taxTotalCents: 850,
            discountTotalCents: 100,
          },
        ],
      })
    );

    const order = await service.getOrder('o3');

    expect(order).not.toBeNull();
    expect(order!.total).toBe(51);
    expect(order!.subtotal).toBe(42.5);
    expect(order!.tax).toBe(8.5);
    expect(order!.note).toBe('leave at counter');
    expect(order!.paymentStatus).toBe('partially_refunded');
    expect(order!.fulfillmentStatus).toBe('partially_fulfilled');
    expect(order!.lineItems[0]).toMatchObject({ id: 'i1', variantId: 'v9', price: 21.25, total: 42.5, taxAmount: 8.5, discountAmount: 1 });
  });

  it('should use dedicated status endpoints and notes route on updateOrder', async () => {
    mockApiClient.put.mockResolvedValue(envelope({}));
    mockApiClient.post.mockResolvedValueOnce(envelope({}));
    mockApiClient.get.mockResolvedValueOnce(envelope({ orderId: 'o4', totalAmountCents: 1000, items: [] }));

    await service.updateOrder('o4', { paymentStatus: 'refunded', fulfillmentStatus: 'partially_fulfilled', note: 'customer called' });

    expect(mockApiClient.put).toHaveBeenCalledWith('/business/orders/o4/payment-status', { paymentStatus: 'refunded' });
    expect(mockApiClient.put).toHaveBeenCalledWith('/business/orders/o4/fulfillment-status', { fulfillmentStatus: 'partiallyFulfilled' });
    expect(mockApiClient.post).toHaveBeenCalledWith('/business/orders/o4/notes', { content: 'customer called', isCustomerVisible: false });
  });
});
