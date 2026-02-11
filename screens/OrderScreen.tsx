import React, { useCallback, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { lightColors, spacing, typography } from '../utils/theme';
import { Basket } from './order/Basket';
import { ProductGrid } from './order/ProductGrid';
import { Header } from './order/Header';
import { Category } from './order/Category';
import { CategoryList } from './order/CategoryList';
import { BasketContent } from './order/BasketContent';
import { SearchBar } from '../components/SearchBar';
import { useBasketContext, CartProduct } from '../contexts/BasketProvider';
import { useCategoryContext } from '../contexts/CategoryProvider';
import { useEcommerceSettings } from '../hooks/useEcommerceSettings';
import { useProductsForDisplay } from '../hooks/useProducts';
import { useResponsive, getProductColumns, getSidebarWidths } from '../hooks/useResponsive';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

interface OrderScreenProps {
  onLogout?: () => void;
  username?: string;
}

const OrderScreen: React.FC<OrderScreenProps> = ({ username = 'User' }) => {
  const { selectedCategory, selectedCategoryName } = useCategoryContext();
  const { cartItems, cartItemsMap, addToCart, updateQuantity, itemCount } = useBasketContext();
  const { isMobile, isTabletOrDesktop, width } = useResponsive();
  const [searchQuery, setSearchQuery] = useState('');

  // eCommerce integration
  const { currentPlatform } = useEcommerceSettings();

  // Use unified products hook
  const { products, isLoading: isProductLoading } = useProductsForDisplay(currentPlatform, selectedCategory, selectedCategoryName);

  // Filter by search query locally
  const filteredProducts = searchQuery
    ? products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : products;

  // Responsive values
  const numColumns = getProductColumns(width);
  const sidebarWidths = getSidebarWidths(width);

  // Keyboard shortcuts (desktop/web only)
  useKeyboardShortcuts(
    [
      { key: 'k', meta: true, handler: () => {/* SearchBar will gain focus via ref in future */ }, description: 'Focus search' },
    ],
    isTabletOrDesktop
  );

  // Function to handle adding/updating a product in the cart
  const handleAddToCart = useCallback(
    async (id: string, quantity: number) => {
      const product = products.find(p => p.id === id);
      if (!product) return;

      const cartItem = cartItems.find(item => item.productId === id);

      if (quantity <= 0 && cartItem) {
        await updateQuantity(cartItem.id, 0);
      } else if (cartItem) {
        await updateQuantity(cartItem.id, quantity);
      } else if (quantity > 0) {
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

  const renderProductArea = () => (
    <View style={styles.productArea}>
      {/* Inline search bar for tablet/desktop */}
      {isTabletOrDesktop && (
        <View style={styles.searchContainer}>
          <SearchBar placeholder="Search products..." onSearch={setSearchQuery} />
        </View>
      )}

      {isProductLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={lightColors.primary} />
          <Text style={styles.loadingText}>Loading products...</Text>
        </View>
      ) : (
        <ProductGrid
          products={filteredProducts}
          onAddToCart={handleAddToCart}
          cartItems={cartItemsMap}
          numColumns={numColumns}
        />
      )}
    </View>
  );

  // ===== TABLET / DESKTOP: 3-panel layout =====
  if (isTabletOrDesktop) {
    return (
      <View style={styles.container}>
        <Header username={username} cartItemTotal={itemCount} />

        <View style={styles.desktopLayout}>
          {/* Left sidebar: Categories (always visible) */}
          <View style={[styles.sidebar, styles.categorySidebar, { width: sidebarWidths.category }]}>
            <Text style={styles.sidebarTitle}>Categories</Text>
            <CategoryList showBreadcrumb />
          </View>

          {/* Center: Product Grid */}
          <View style={styles.mainContent}>
            {renderProductArea()}
          </View>

          {/* Right sidebar: Basket (always visible) */}
          <View style={[styles.sidebar, styles.basketSidebar, { width: sidebarWidths.basket }]}>
            <Text style={styles.sidebarTitle}>Cart {itemCount > 0 ? `(${itemCount})` : ''}</Text>
            <BasketContent platform={currentPlatform ?? undefined} />
          </View>
        </View>
      </View>
    );
  }

  // ===== MOBILE: Sliding panels =====
  return (
    <View style={styles.container}>
      <Header username={username} cartItemTotal={itemCount} />

      <View style={styles.content}>
        {renderProductArea()}
      </View>

      {/* Mobile: swipeable panels */}
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
  // ===== Desktop / Tablet layout =====
  desktopLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    backgroundColor: lightColors.surface,
    borderColor: lightColors.border,
  },
  categorySidebar: {
    borderRightWidth: 1,
  },
  basketSidebar: {
    borderLeftWidth: 1,
  },
  sidebarTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: lightColors.textPrimary,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  mainContent: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  // ===== Shared =====
  content: {
    flex: 1,
  },
  productArea: {
    flex: 1,
  },
  searchContainer: {
    padding: spacing.sm,
    paddingBottom: 0,
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
