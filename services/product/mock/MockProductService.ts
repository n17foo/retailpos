import { Product, ProductQueryOptions, ProductResult, ProductVariant, ProductServiceInterface } from '../ProductServiceInterface';
import { placeholderImage1, placeholderImage2 } from '../../../utils/placeholderImages';

export class MockProductService implements ProductServiceInterface {
  private products: Map<string, Product> = new Map();

  // Mock categories for product type assignment
  private categoryNames = ['Electronics', 'Clothing', 'Books', 'Furniture', 'Home & Garden'];

  constructor() {
    this.initializeLocalProducts();
    this.initializeEcomProducts();
  }

  private initializeLocalProducts(): void {
    const localProducts = [
      {
        id: '1',
        name: 'Poached Egg & Bacon',
        price: 60.45,
        image: placeholderImage1,
        categoryName: 'Electronics',
        barcode: '9781234567897',
      },
      {
        id: '2',
        name: 'Smoky Ham & Cheeze',
        price: 10.0,
        image: placeholderImage2,
        categoryName: 'Electronics',
        barcode: '9781234567903',
      },
    ];

    localProducts.forEach(product => {
      const ecomProduct: Product = {
        id: product.id,
        title: product.name,
        description: `${product.name} - Delicious and fresh!`,
        variants: [
          {
            id: `variant-${product.id}-1`,
            price: product.price,
            inventoryQuantity: 100,
            sku: `SKU-${product.id}`,
            barcode: product.barcode,
          },
        ],
        images: [
          {
            id: `img-${product.id}-1`,
            url:
              typeof product.image === 'string'
                ? product.image
                : product.image && typeof product.image === 'object' && 'uri' in product.image
                  ? product.image.uri
                  : '',
            alt: `${product.name} image`,
          },
        ],
        vendor: 'RetailPOS Local',
        productType: product.categoryName,
        tags: ['local', 'featured'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.products.set(product.id, ecomProduct);
    });
  }

  private initializeEcomProducts(): void {
    for (let i = 0; i < 10; i++) {
      const variants: ProductVariant[] = [];
      const variantCount = Math.floor(Math.random() * 3) + 1;
      for (let v = 0; v < variantCount; v++) {
        const variantId = `variant-${i}-${v}`;
        const quantity = Math.floor(Math.random() * 50) + 5;
        variants.push({
          id: variantId,
          price: parseFloat((Math.random() * 100 + 5).toFixed(2)),
          inventoryQuantity: quantity,
          sku: `SKU-${i}-${v}`,
          barcode: `BARCODE-${i}-${v}`,
          title: v === 0 ? undefined : `Variant ${v + 1}`,
        });
      }

      const categoryIndex = i % this.categoryNames.length;
      const categoryName = this.categoryNames[categoryIndex];
      const productId = `ecom-product-${i}`;
      const product: Product = {
        id: productId,
        title: `eCommerce Product ${i}`,
        description: `This is a detailed description of eCommerce product ${i}`,
        variants,
        images: [
          {
            id: `img-${i}-1`,
            url: `https://example.com/mock-image-${i}.jpg`,
            alt: `Product ${i} image`,
          },
        ],
        vendor: `Vendor ${Math.floor(i / 4)}`,
        productType: categoryName,
        tags: [`tag-${categoryIndex}`, i % 2 === 0 ? 'featured' : 'regular'],
        createdAt: new Date(Date.now() - Math.floor(Math.random() * 10000000000)),
        updatedAt: new Date(),
      };
      this.products.set(productId, product);
    }
  }

  async syncProducts(products: Product[]): Promise<any> {
    // In a real implementation, this would sync products to a remote service.
    // For this mock, we'll just log the products and return a success message.
    console.log('Syncing products:', products);
    return Promise.resolve({ successful: products.length, failed: 0, errors: [] });
  }

  async getProducts(options: ProductQueryOptions): Promise<ProductResult> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const startIndex = (page - 1) * limit;

    let filteredProducts = Array.from(this.products.values());

    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filteredProducts = filteredProducts.filter(
        product =>
          product.title.toLowerCase().includes(searchLower) ||
          (product.description && product.description.toLowerCase().includes(searchLower))
      );
    }

    if (options.category) {
      filteredProducts = filteredProducts.filter(p => p.productType === options.category);
    }

    if (options.ids && options.ids.length > 0) {
      filteredProducts = filteredProducts.filter(p => options.ids!.includes(p.id));
    }

    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + limit);

    return Promise.resolve({
      products: paginatedProducts,
      pagination: {
        totalItems: filteredProducts.length,
        currentPage: page,
        totalPages: Math.ceil(filteredProducts.length / limit),
        perPage: limit,
      },
    });
  }
}
