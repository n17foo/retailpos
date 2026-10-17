jest.mock('../../../shared/utils/uuid', () => ({ generateUUID: () => 'order-1' }));
jest.mock('../../platform-clients/services/config/POSConfigService', () => ({
  MAX_SYNC_RETRIES: () => 3,
  posConfig: { values: { taxRate: 0.08, maxSyncRetries: 3, drawerOpenOnCash: true }, load: jest.fn() },
}));
jest.mock('../../../shared/services/audit/AuditLogService', () => ({ auditLogService: { log: jest.fn() } }));
jest.mock('../../customers/services/loyalty/LoyaltyService', () => ({ loyaltyService: { earnPoints: jest.fn() } }));
jest.mock('../../customers/services/customer/LocalCustomerService', () => ({
  localCustomerService: { upsert: jest.fn(), recordOrder: jest.fn() },
}));

const mockOrderService = {
  createDraftOrder: jest.fn(),
  quoteTax: jest.fn(),
  cancelDraftOrder: jest.fn(),
  completeOrder: jest.fn(),
};
jest.mock('../../orders-sync/services/order/OrderServiceFactory', () => ({
  OrderServiceFactory: { getInstance: () => ({ getService: () => mockOrderService }) },
}));

import { CheckoutService } from './CheckoutService';
import { ECommercePlatform } from '../../../shared/utils/platforms';
import type { Basket } from '../../basket/services/basket';

const basket = (overrides: Partial<Basket> = {}): Basket => ({
  id: 'b1',
  items: [
    {
      id: 'i1',
      productId: 'woocommerce-10',
      originalId: '10',
      variantId: 'woocommerce-10-55',
      name: 'Widget',
      price: 50,
      quantity: 2,
    },
  ],
  subtotal: 100,
  tax: 0,
  total: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const setup = (b: Basket) => {
  const orderRepo = { createWithItems: jest.fn(), delete: jest.fn() };
  const logger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const service = new CheckoutService(
    { getBasket: jest.fn().mockResolvedValue(b) } as never,
    orderRepo as never,
    {} as never,
    logger as never
  );
  return { service, orderRepo };
};

beforeEach(() => jest.clearAllMocks());

describe('startCheckout tax', () => {
  it('uses the platform-calculated tax for platforms without drafts (quote)', async () => {
    mockOrderService.quoteTax.mockResolvedValue({ subtotal: 100, tax: 20, taxIncluded: false });
    const { service, orderRepo } = setup(basket());

    const order = await service.startCheckout(ECommercePlatform.WOOCOMMERCE);

    expect(order).toMatchObject({ subtotal: 100, tax: 20, total: 120, status: 'pending' });
    expect(orderRepo.createWithItems).toHaveBeenCalledWith(expect.objectContaining({ tax: 20, total: 120 }), expect.any(Array));
    expect(mockOrderService.createDraftOrder).not.toHaveBeenCalled();
  });

  it('sends the platform raw product and variant ids, not the POS prefixed ids', async () => {
    mockOrderService.quoteTax.mockResolvedValue({ subtotal: 100, tax: 0, taxIncluded: false });
    const { service } = setup(basket());

    await service.startCheckout(ECommercePlatform.WOOCOMMERCE);

    expect(mockOrderService.quoteTax.mock.calls[0][0].lineItems[0]).toMatchObject({ productId: '10', variantId: '55' });
  });

  it('applies the platform effective rate to the discounted amount', async () => {
    mockOrderService.quoteTax.mockResolvedValue({ subtotal: 100, tax: 20, taxIncluded: false });
    const { service } = setup(basket({ discountAmount: 10, discountCode: 'X', total: 90 }));

    const order = await service.startCheckout(ECommercePlatform.MAGENTO);

    expect(order).toMatchObject({ tax: 18, total: 108 });
  });

  it('uses the draft order totals for draft platforms', async () => {
    mockOrderService.createDraftOrder.mockResolvedValue({
      id: 'd1',
      lineItems: [{ taxRate: 0.2 }],
      subtotal: 100,
      tax: 20,
      total: 120,
    });
    const { service } = setup(basket());

    const order = await service.startCheckout(ECommercePlatform.SHOPIFY);

    expect(order).toMatchObject({ tax: 20, total: 120, status: 'draft', platformOrderId: 'd1' });
    expect(mockOrderService.quoteTax).not.toHaveBeenCalled();
  });

  it('stops checkout when the platform cannot return the tax, instead of charging without it', async () => {
    mockOrderService.quoteTax.mockRejectedValue(new Error('timeout'));
    const { service, orderRepo } = setup(basket());

    await expect(service.startCheckout(ECommercePlatform.BIGCOMMERCE)).rejects.toThrow(/cannot be completed/);
    expect(orderRepo.createWithItems).not.toHaveBeenCalled();
  });

  it('stops checkout when a draft platform fails to create the draft', async () => {
    mockOrderService.createDraftOrder.mockRejectedValue(new Error('500'));
    const { service, orderRepo } = setup(basket());

    await expect(service.startCheckout(ECommercePlatform.WIX)).rejects.toThrow(/cannot be completed/);
    expect(orderRepo.createWithItems).not.toHaveBeenCalled();
  });

  it('keeps basket totals (local tax setup) for the offline catalogue', async () => {
    const { service } = setup(basket({ tax: 8, total: 108 }));

    const order = await service.startCheckout(ECommercePlatform.OFFLINE);

    expect(order).toMatchObject({ tax: 8, total: 108 });
    expect(mockOrderService.quoteTax).not.toHaveBeenCalled();
    expect(mockOrderService.createDraftOrder).not.toHaveBeenCalled();
  });
});
