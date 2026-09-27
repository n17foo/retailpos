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

import { CommercefullProductService } from './CommercefullProductService';
import { Product } from '../ProductServiceInterface';

const envelope = (data: unknown) => ({ success: true, data });

describe('CommercefullProductService', () => {
  let service: CommercefullProductService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new CommercefullProductService({ storeUrl: 'https://api.example.com', apiKey: 'k', apiSecret: 's' });
    await service.initialize();
  });

  it('should unwrap the paginated list envelope and use offset/categoryId params', async () => {
    mockApiClient.get.mockResolvedValueOnce(
      envelope({
        products: [
          {
            productId: 'p1',
            name: 'Widget',
            sku: 'SKU-1',
            basePriceCents: 1999,
            effectivePriceCents: 1499,
            salePriceCents: 1499,
            primaryImageUrl: 'https://img/1.png',
          },
        ],
        total: 42,
        limit: 20,
        offset: 20,
        hasMore: true,
      })
    );

    const result = await service.getProducts({ page: 2, limit: 20, category: 'cat-1', search: 'wid' });

    const [url, params] = mockApiClient.get.mock.calls[0];
    expect(url).toBe('/business/products');
    expect(params).toMatchObject({ limit: '20', offset: '20', categoryId: 'cat-1', search: 'wid' });

    expect(result.products).toHaveLength(1);
    expect(result.products[0].id).toBe('p1');
    expect(result.products[0].title).toBe('Widget');
    // Cents → dollars
    expect(result.products[0].variants[0].price).toBe(14.99);
    expect(result.products[0].images?.[0].url).toBe('https://img/1.png');
    expect(result.pagination).toMatchObject({ currentPage: 2, totalPages: 3, totalItems: 42, perPage: 20 });
  });

  it('should fetch each id individually when ids are provided (no ids filter on platform)', async () => {
    mockApiClient.get
      .mockResolvedValueOnce(envelope({ productId: 'p1', name: 'A', basePriceCents: 100 }))
      .mockResolvedValueOnce(envelope({ productId: 'p2', name: 'B', basePriceCents: 200 }));

    const result = await service.getProducts({ ids: ['p1', 'p2'] });

    expect(mockApiClient.get).toHaveBeenCalledWith('/business/products/p1');
    expect(mockApiClient.get).toHaveBeenCalledWith('/business/products/p2');
    expect(result.products.map(p => p.id)).toEqual(['p1', 'p2']);
  });

  it('should map detail variants and images from cent-based DTOs', async () => {
    mockApiClient.get.mockResolvedValueOnce(
      envelope({
        productId: 'p1',
        name: 'Widget',
        description: 'Desc',
        basePriceCents: 2000,
        effectivePriceCents: 2000,
        variants: [
          {
            variantId: 'v1',
            sku: 'SKU-1',
            name: 'Red',
            barcode: '123',
            basePriceCents: 2000,
            salePriceCents: 1500,
            effectivePriceCents: 1500,
            stockQuantity: 7,
            weight: 500,
            weightUnit: 'g',
          },
        ],
        images: [{ imageId: 'img1', url: 'https://img/1.png', altText: 'front', position: 0 }],
      })
    );

    const product = await service.getProductById('p1');

    expect(product).not.toBeNull();
    expect(product!.variants[0]).toMatchObject({
      id: 'v1',
      sku: 'SKU-1',
      barcode: '123',
      price: 15,
      inventoryQuantity: 7,
      weight: 500,
      weightUnit: 'g',
    });
    expect(product!.images![0]).toMatchObject({ id: 'img1', url: 'https://img/1.png', alt: 'front' });
  });

  it('should resolve productTypeId and send cent prices on create', async () => {
    // product-types lookup
    mockApiClient.get.mockResolvedValueOnce(envelope([{ productTypeId: 'pt-1', name: 'Standard', slug: 'standard' }]));
    // create
    mockApiClient.post.mockResolvedValueOnce(envelope({ productId: 'new-1', name: 'Widget' }));
    // variant + image creation + refetch
    mockApiClient.post.mockResolvedValue(envelope({}));
    mockApiClient.get.mockResolvedValueOnce(envelope({ productId: 'new-1', name: 'Widget', basePriceCents: 1000 }));

    const product: Product = {
      id: 'local-1',
      title: 'Widget',
      description: 'Desc',
      productType: 'standard',
      variants: [{ id: 'lv1', title: 'Default', sku: 'SKU-1', barcode: '999', price: 10, inventoryQuantity: 3 }],
      images: [{ id: 'li1', url: 'https://img/1.png' }],
    };

    await service.createProduct(product);

    const [url, body] = mockApiClient.post.mock.calls[0];
    expect(url).toBe('/business/products');
    expect(body).toMatchObject({ name: 'Widget', productTypeId: 'pt-1', sku: 'SKU-1', basePriceCents: 1000 });
    expect(body).not.toHaveProperty('variants');
    expect(body).not.toHaveProperty('productType');

    // Variant and image created via dedicated endpoints
    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/business/products/new-1/variants',
      expect.objectContaining({ sku: 'SKU-1', barcode: '999', priceCents: 1000 })
    );
    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/business/products/new-1/images',
      expect.objectContaining({ url: 'https://img/1.png', isPrimary: true })
    );
  });
});
