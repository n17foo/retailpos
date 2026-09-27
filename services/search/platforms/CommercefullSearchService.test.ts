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

import { CommercefullSearchService } from './CommercefullSearchService';

const envelope = (data: unknown) => ({ success: true, data });

describe('CommercefullSearchService', () => {
  let service: CommercefullSearchService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new CommercefullSearchService({ storeUrl: 'https://api.example.com', apiKey: 'k', apiSecret: 's' } as never);
    await service.initialize();
  });

  it('should send cent-based price filters and map search rows', async () => {
    mockApiClient.get.mockResolvedValueOnce(
      envelope({
        products: [
          {
            productId: 'p1',
            name: 'Widget',
            sku: 'SKU-1',
            shortDescription: 'A widget',
            effectivePriceCents: 1499,
            priceCents: 1999,
            stockQuantity: 4,
            categoryId: 'cat-1',
          },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      })
    );

    const results = await service.searchPlatformProducts('wid', {
      minPrice: 10,
      maxPrice: 20,
      inStock: true,
      categories: ['cat-1'],
      limit: 20,
      page: 1,
    });

    const [url, params] = mockApiClient.get.mock.calls[0];
    expect(url).toBe('/customer/products/search');
    expect(params).toMatchObject({
      q: 'wid',
      minPriceCents: '1000',
      maxPriceCents: '2000',
      inStock: 'true',
      categoryIds: 'cat-1',
      limit: '20',
      page: '1',
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: 'p1', name: 'Widget', price: 14.99, sku: 'SKU-1', inStock: true });
  });

  it('should map the {product, variant} barcode response and fetch price detail', async () => {
    mockApiClient.get
      .mockResolvedValueOnce(
        envelope({
          product: { productId: 'p1', name: 'Widget', sku: 'BASE-1' },
          variant: { variantId: 'v1', productId: 'p1', sku: 'SKU-1', barcode: '5901234', stockQuantity: 3 },
        })
      )
      .mockResolvedValueOnce(
        envelope({
          productId: 'p1',
          name: 'Widget',
          effectivePriceCents: 999,
          variants: [{ variantId: 'v1', sku: 'SKU-1', effectivePriceCents: 999, stockQuantity: 3, isInStock: true }],
        })
      );

    const results = await service.searchByBarcode('5901234');

    expect(mockApiClient.get).toHaveBeenNthCalledWith(1, '/customer/products/barcode/5901234');
    expect(mockApiClient.get).toHaveBeenNthCalledWith(2, '/customer/products/p1');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ id: 'p1', sku: 'SKU-1', barcode: '5901234', price: 9.99, inStock: true });
  });

  it('should return an empty array when the barcode is not found', async () => {
    mockApiClient.get.mockRejectedValueOnce(new Error('404'));
    expect(await service.searchByBarcode('unknown')).toEqual([]);
  });

  it('should use offset pagination for the plain product list', async () => {
    mockApiClient.get.mockResolvedValueOnce(
      envelope({
        products: [{ productId: 'p1', name: 'Widget', effectivePriceCents: 500 }],
        total: 30,
        limit: 10,
        offset: 10,
        hasMore: true,
      })
    );

    const result = await service.getProducts({ page: 2, limit: 10, category: 'cat-1' });

    const [url, params] = mockApiClient.get.mock.calls[0];
    expect(url).toBe('/customer/products');
    expect(params).toMatchObject({ limit: '10', offset: '10', categoryId: 'cat-1' });
    expect(result.pagination).toMatchObject({ currentPage: 2, totalPages: 3, totalItems: 30 });
    expect(result.products[0].variants[0].price).toBe(5);
  });
});
