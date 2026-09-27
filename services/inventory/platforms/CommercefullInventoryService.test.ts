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

import { CommercefullInventoryService } from './CommercefullInventoryService';

const envelope = (data: unknown) => ({ success: true, data });

describe('CommercefullInventoryService', () => {
  let service: CommercefullInventoryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new CommercefullInventoryService({ storeUrl: 'https://api.example.com', apiKey: 'k', apiSecret: 's' });
    await service.initialize();
  });

  it('should query /business/inventory/items per product and aggregate locations', async () => {
    mockApiClient.get.mockResolvedValueOnce(
      envelope({
        items: [
          {
            inventoryItemId: 'loc-item-1',
            productId: 'p1',
            variantId: 'v1',
            warehouseId: 'w1',
            sku: 'SKU-1',
            quantity: 10,
            reservedQuantity: 3,
            availableQuantity: 7,
          },
          {
            inventoryItemId: 'loc-item-2',
            productId: 'p1',
            variantId: 'v1',
            warehouseId: 'w2',
            sku: 'SKU-1',
            quantity: 5,
            reservedQuantity: 0,
            availableQuantity: 5,
          },
        ],
        total: 2,
      })
    );

    const result = await service.getInventory(['p1']);

    const [url, params] = mockApiClient.get.mock.calls[0];
    expect(url).toBe('/business/inventory/items');
    expect(params).toMatchObject({ productId: 'p1' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ productId: 'p1', variantId: 'v1', quantity: 12, sku: 'SKU-1' });
  });

  it('should look up the inventory item and post a signed quantityChange for deltas', async () => {
    mockApiClient.get.mockResolvedValueOnce(envelope({ inventoryItemId: 'loc-item-1', productId: 'p1', availableQuantity: 7 }));
    mockApiClient.post.mockResolvedValueOnce(envelope({}));

    const result = await service.updateInventory([{ productId: 'p1', variantId: 'v1', quantity: -2, adjustment: true }]);

    expect(mockApiClient.get).toHaveBeenCalledWith('/business/inventory/items/lookup', { productId: 'p1', variantId: 'v1' });
    expect(mockApiClient.post).toHaveBeenCalledWith('/business/inventory/locations/loc-item-1/adjust', {
      quantityChange: -2,
      reason: 'POS inventory update',
    });
    expect(result.successful).toBe(1);
  });

  it('should convert absolute quantity to a delta for non-adjustment updates', async () => {
    mockApiClient.get.mockResolvedValueOnce(envelope({ inventoryItemId: 'loc-item-1', productId: 'p1', availableQuantity: 7 }));
    mockApiClient.post.mockResolvedValueOnce(envelope({}));

    await service.updateInventory([{ productId: 'p1', quantity: 20, adjustment: false }]);

    expect(mockApiClient.post).toHaveBeenCalledWith('/business/inventory/locations/loc-item-1/adjust', {
      quantityChange: 13,
      reason: 'POS inventory update',
    });
  });

  it('should record an error when no inventory item exists', async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error('404'));

    const result = await service.updateInventory([{ productId: 'missing', quantity: 5 }]);

    expect(result.failed).toBe(1);
    expect(result.errors[0].productId).toBe('missing');
  });
});
