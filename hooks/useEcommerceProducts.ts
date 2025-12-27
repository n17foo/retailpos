import { useState, useEffect, useCallback } from 'react';
import { ImageSourcePropType } from 'react-native';
import { ProductServiceFactory } from '../services/product/productServiceFactory';
import { Product as ServiceProduct, ProductQueryOptions } from '../services/product/ProductServiceInterface';

// Define the product interface that matches the ProductGrid component
export interface Product {
  id: string;
  name: string;
  price: number;
  image: ImageSourcePropType | null; // Allow null for products without images
  categoryId: string;
  description?: string;
  sku?: string;
  barcode?: string;
  stock?: number;
  isEcommerceProduct?: boolean;
  variantId?: string;
}

export const useEcommerceProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Convert service products to the format expected by the UI
  const convertServiceProductsToUIProducts = (serviceProducts: ServiceProduct[]): Product[] => {
    return serviceProducts.map(p => {
      // Convert string URL to ImageSourcePropType
      let imageSource: ImageSourcePropType | null = null;
      if (p.images && p.images.length > 0 && p.images[0].url) {
        if (typeof p.images[0].url === 'string') {
          // If it's a URL string, convert to {uri: string}
          imageSource = { uri: p.images[0].url };
        } else {
          // Otherwise use as is (likely already an imported image)
          imageSource = p.images[0].url as any;
        }
      }

      return {
        id: p.id,
        name: p.title,
        price: p.variants[0]?.price || 0,
        image: imageSource,
        categoryId: p.productType || '',
        description: p.description || '',
        sku: p.variants[0]?.sku || '',
        barcode: p.variants[0]?.barcode || '',
        stock: p.variants[0]?.inventoryQuantity || 0,
        isEcommerceProduct: true, // All products from this service are e-commerce products
        variantId: p.variants[0]?.id,
      };
    });
  };

  // Fetch products from the Product service
  const fetchProducts = useCallback(async (category?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const productService = ProductServiceFactory.getInstance().getService();
      const options: ProductQueryOptions = {
        page: 1,
        limit: 100, // Get all products
      };

      if (category) {
        options.category = category;
      }

      const result = await productService.getProducts(options);
      setProducts(convertServiceProductsToUIProducts(result.products));
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch products on mount
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    fetchProducts,
    isLoading,
    error,
  };
};
