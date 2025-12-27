import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useInventory } from '../hooks/useInventory';
import { useEcommerceProducts } from '../hooks/useEcommerceProducts';
import { useEcommerceSettings } from '../hooks/useEcommerceSettings';

interface InventoryItem {
  productId: string;
  variantId?: string;
  name: string;
  sku?: string;
  quantity: number;
  lowStockThreshold?: number;
}

interface InventoryScreenProps {
  onGoBack?: () => void;
}

const LOW_STOCK_THRESHOLD = 10;

const InventoryScreen: React.FC<InventoryScreenProps> = ({ onGoBack }) => {
  const { products, isLoading: productsLoading, fetchProducts } = useEcommerceProducts();
  const { isInitialized: ecommerceInitialized } = useEcommerceSettings();
  const { isLoading: inventoryLoading, error, getInventory, adjustInventory, setInventoryQuantity } = useInventory();

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState('');

  // Load inventory data
  const loadInventory = useCallback(async () => {
    if (!ecommerceInitialized || products.length === 0) return;

    try {
      const productIds = products.map(p => p.id);
      const result = await getInventory(productIds);

      if (result) {
        // Map inventory data with product info
        const items: InventoryItem[] = result.items.map(item => {
          const product = products.find(p => p.id === item.productId);
          return {
            productId: item.productId,
            variantId: item.variantId,
            name: product?.name || 'Unknown Product',
            sku: item.sku || product?.sku,
            quantity: item.quantity,
            lowStockThreshold: LOW_STOCK_THRESHOLD,
          };
        });
        setInventoryItems(items);
      }
    } catch (err) {
      console.error('Error loading inventory:', err);
    }
  }, [ecommerceInitialized, products, getInventory]);

  // Load products and inventory on mount
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (products.length > 0) {
      loadInventory();
    }
  }, [products, loadInventory]);

  // Handle refresh
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchProducts();
    await loadInventory();
    setRefreshing(false);
  };

  // Filter inventory items
  const filteredItems = inventoryItems.filter(item => {
    // Apply search filter
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    // Apply stock filter
    switch (filter) {
      case 'low':
        return item.quantity > 0 && item.quantity <= (item.lowStockThreshold || LOW_STOCK_THRESHOLD);
      case 'out':
        return item.quantity === 0;
      case 'all':
      default:
        return true;
    }
  });

  // Handle quantity adjustment
  const handleAdjustQuantity = async (productId: string, adjustment: number, variantId?: string) => {
    const success = await adjustInventory(productId, adjustment, variantId);
    if (success) {
      // Update local state
      setInventoryItems(prev =>
        prev.map(item =>
          item.productId === productId && item.variantId === variantId
            ? { ...item, quantity: Math.max(0, item.quantity + adjustment) }
            : item
        )
      );
    } else {
      Alert.alert('Error', 'Failed to update inventory');
    }
  };

  // Handle set quantity
  const handleSetQuantity = async (productId: string, variantId?: string) => {
    const quantity = parseInt(editQuantity, 10);
    if (isNaN(quantity) || quantity < 0) {
      Alert.alert('Error', 'Please enter a valid quantity');
      return;
    }

    const success = await setInventoryQuantity(productId, quantity, variantId);
    if (success) {
      setInventoryItems(prev =>
        prev.map(item => (item.productId === productId && item.variantId === variantId ? { ...item, quantity } : item))
      );
      setEditingItem(null);
      setEditQuantity('');
    } else {
      Alert.alert('Error', 'Failed to update inventory');
    }
  };

  // Get stock status color
  const getStockColor = (quantity: number, threshold: number = LOW_STOCK_THRESHOLD): string => {
    if (quantity === 0) return lightColors.error;
    if (quantity <= threshold) return lightColors.warning;
    return lightColors.success;
  };

  // Render inventory item
  const renderInventoryItem = ({ item }: { item: InventoryItem }) => {
    const isEditing = editingItem === `${item.productId}-${item.variantId || ''}`;
    const stockColor = getStockColor(item.quantity, item.lowStockThreshold);

    return (
      <View style={styles.itemCard}>
        <View style={styles.itemHeader}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemName} numberOfLines={2}>
              {item.name}
            </Text>
            {item.sku && <Text style={styles.itemSku}>SKU: {item.sku}</Text>}
          </View>
          <View style={[styles.stockBadge, { backgroundColor: stockColor + '20' }]}>
            <Text style={[styles.stockText, { color: stockColor }]}>
              {item.quantity === 0 ? 'Out of Stock' : `${item.quantity} in stock`}
            </Text>
          </View>
        </View>

        {isEditing ? (
          <View style={styles.editContainer}>
            <Input
              value={editQuantity}
              onChangeText={setEditQuantity}
              keyboardType="numeric"
              placeholder="Enter quantity"
              size="sm"
              containerStyle={styles.editInput}
            />
            <Button
              title="Save"
              size="sm"
              variant="success"
              onPress={() => handleSetQuantity(item.productId, item.variantId)}
              loading={inventoryLoading}
            />
            <Button
              title="Cancel"
              size="sm"
              variant="ghost"
              onPress={() => {
                setEditingItem(null);
                setEditQuantity('');
              }}
            />
          </View>
        ) : (
          <View style={styles.actionContainer}>
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={styles.adjustButton}
                onPress={() => handleAdjustQuantity(item.productId, -1, item.variantId)}
                disabled={item.quantity === 0}
              >
                <Text style={styles.adjustButtonText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.quantityDisplay}>{item.quantity}</Text>
              <TouchableOpacity style={styles.adjustButton} onPress={() => handleAdjustQuantity(item.productId, 1, item.variantId)}>
                <Text style={styles.adjustButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            <Button
              title="Edit"
              size="sm"
              variant="outline"
              onPress={() => {
                setEditingItem(`${item.productId}-${item.variantId || ''}`);
                setEditQuantity(item.quantity.toString());
              }}
            />
          </View>
        )}
      </View>
    );
  };

  // Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>
        {!ecommerceInitialized ? 'E-Commerce Not Configured' : productsLoading ? 'Loading Products...' : 'No Products Found'}
      </Text>
      <Text style={styles.emptyStateText}>
        {!ecommerceInitialized
          ? 'Configure your e-commerce platform in Settings to manage inventory.'
          : 'Add products to your store to start tracking inventory.'}
      </Text>
    </View>
  );

  const isLoading = productsLoading || inventoryLoading;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onGoBack && (
          <TouchableOpacity onPress={onGoBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Inventory Management</Text>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <Input
          placeholder="Search by name or SKU..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          showClearButton
          containerStyle={styles.searchInput}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterTabs}>
        <TouchableOpacity style={[styles.filterTab, filter === 'all' && styles.activeFilterTab]} onPress={() => setFilter('all')}>
          <Text style={[styles.filterTabText, filter === 'all' && styles.activeFilterTabText]}>All ({inventoryItems.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterTab, filter === 'low' && styles.activeFilterTab]} onPress={() => setFilter('low')}>
          <Text style={[styles.filterTabText, filter === 'low' && styles.activeFilterTabText]}>
            Low Stock ({inventoryItems.filter(i => i.quantity > 0 && i.quantity <= LOW_STOCK_THRESHOLD).length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterTab, filter === 'out' && styles.activeFilterTab]} onPress={() => setFilter('out')}>
          <Text style={[styles.filterTabText, filter === 'out' && styles.activeFilterTabText]}>
            Out of Stock ({inventoryItems.filter(i => i.quantity === 0).length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Error Display */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Inventory List */}
      {isLoading && inventoryItems.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={lightColors.primary} />
          <Text style={styles.loadingText}>Loading inventory...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderInventoryItem}
          keyExtractor={item => `${item.productId}-${item.variantId || ''}`}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        />
      )}

      {/* Summary Footer */}
      {inventoryItems.length > 0 && (
        <View style={styles.footer}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Products</Text>
            <Text style={styles.summaryValue}>{inventoryItems.length}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Low Stock</Text>
            <Text style={[styles.summaryValue, { color: lightColors.warning }]}>
              {inventoryItems.filter(i => i.quantity > 0 && i.quantity <= LOW_STOCK_THRESHOLD).length}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Out of Stock</Text>
            <Text style={[styles.summaryValue, { color: lightColors.error }]}>{inventoryItems.filter(i => i.quantity === 0).length}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  backButton: {
    marginRight: spacing.md,
  },
  backButtonText: {
    color: lightColors.primary,
    fontSize: typography.fontSize.md,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  searchContainer: {
    padding: spacing.md,
    backgroundColor: lightColors.surface,
  },
  searchInput: {
    marginBottom: 0,
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  filterTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeFilterTab: {
    borderBottomColor: lightColors.primary,
  },
  filterTabText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  activeFilterTabText: {
    color: lightColors.primary,
    fontWeight: '600',
  },
  errorContainer: {
    margin: spacing.md,
    padding: spacing.md,
    backgroundColor: lightColors.error + '15',
    borderRadius: borderRadius.md,
  },
  errorText: {
    color: lightColors.error,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: lightColors.textSecondary,
  },
  listContent: {
    padding: spacing.md,
  },
  itemCard: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.low,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemName: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  itemSku: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  stockBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
  },
  stockText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adjustButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    backgroundColor: lightColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adjustButtonText: {
    fontSize: typography.fontSize.xl,
    color: lightColors.textOnPrimary,
    fontWeight: '700',
  },
  quantityDisplay: {
    minWidth: 50,
    textAlign: 'center',
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  editContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  editInput: {
    flex: 1,
    marginBottom: 0,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyStateTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
});

export default InventoryScreen;
