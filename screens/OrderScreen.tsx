import React, { useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { lightColors, spacing, typography } from '../utils/theme';
import { Basket } from './order/Basket';
import { ProductGrid, DisplayProduct } from './order/ProductGrid';
import { Header } from './order/Header';
import { Category } from './order/Category';
import { useBasketContext, CartProduct } from '../contexts/BasketProvider';
import { useCategoryContext } from '../contexts/CategoryProvider';
import { useEcommerceSettings } from '../hooks/useEcommerceSettings';
import { useProductsForDisplay } from '../hooks/useProducts';

interface OrderScreenProps {
  onOrderComplete?: (orderTotal: number, items: any[]) => void;
  onLogout?: () => void;
  username?: string;
}

const OrderScreen: React.FC<OrderScreenProps> = ({ username = 'User' }) => {
  const { selectedCategory, selectedCategoryName } = useCategoryContext();
  const {
    cartItems,
    cartItemsMap,
    addToCart,
    updateQuantity,
    itemCount,
  } = useBasketContext();

  // eCommerce integration
  const { currentPlatform } = useEcommerceSettings();

  // Use unified products hook - automatically fetches and maps products
  // Pass both categoryId and categoryName for flexible filtering
  const { products, isLoading: isProductLoading } = useProductsForDisplay(
    currentPlatform,
    selectedCategory,
    selectedCategoryName
  );

  // Products are already filtered by the hook, no need for additional filtering
  const filteredProducts = products;

  // Function to handle adding/updating a product in the cart
  const handleAddToCart = useCallback(
    async (id: string, quantity: number) => {
      // Find the product to add
      const product = products.find(p => p.id === id);
      if (!product) return;

      // Find the cart item by productId (not the basket item id)
      const cartItem = cartItems.find(item => item.productId === id);
      
      if (quantity <= 0 && cartItem) {
        // Remove from cart if quantity is 0 or less
        await updateQuantity(cartItem.id, 0);
      } else if (cartItem) {
        // Update quantity if item exists
        await updateQuantity(cartItem.id, quantity);
      } else if (quantity > 0) {
        // Add new item to cart
        const cartProduct: CartProduct = {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          isEcommerceProduct: product.isEcommerceProduct,
          variantId: product.variantId,
          sku: product.sku,
          platformId: product.platformId,
          platform: product.platform,
        };
        await addToCart(cartProduct, quantity);
      }
    },
    [products, cartItems, updateQuantity, addToCart]
  );

  // Render the main screen
  return (
    <View style={styles.container}>
      <Header username={username} cartItemTotal={itemCount} />

      {/* Main content - Product Grid */}
      <View style={styles.content}>
        {isProductLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={lightColors.primary} />
            <Text style={styles.loadingText}>Loading products...</Text>
          </View>
        ) : (
          <ProductGrid products={filteredProducts} onAddToCart={handleAddToCart} cartItems={cartItemsMap} />
        )}
      </View>

      <Category />

      <Basket platform={currentPlatform} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
});

export default OrderScreen;
