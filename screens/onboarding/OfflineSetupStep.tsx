import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, FlatList } from 'react-native';
import { lightColors, spacing, borderRadius, typography, elevation, semanticColors } from '../../utils/theme';
import { CURRENCIES, getCurrencySymbol } from '../../utils/currency';

interface OfflineSetupStepProps {
  onBack: () => void;
  onComplete: (config: OfflineStoreConfig) => void;
  config: OfflineStoreConfig;
  setConfig: (config: OfflineStoreConfig) => void;
}

export interface OfflineStoreConfig {
  storeName: string;
  /** Store location — the tax destination for offline sales (D10) */
  storeAddress: string;
  categories: OfflineCategory[];
  currency: string;
}

export interface OfflineCategory {
  id: string;
  name: string;
  products: OfflineProduct[];
}

export interface OfflineProduct {
  id: string;
  name: string;
  price: string;
  sku?: string;
  barcode?: string;
}

const DEFAULT_CONFIG: OfflineStoreConfig = {
  storeName: '',
  storeAddress: '',
  categories: [],
  currency: 'GBP',
};

const OfflineSetupStep: React.FC<OfflineSetupStepProps> = ({ onBack, onComplete, config, setConfig }) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [expandedCategoryId, setExpandedCategoryId] = useState<string | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductSku, setNewProductSku] = useState('');

  const currentConfig: OfflineStoreConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    categories: config?.categories || [],
  };

  const addCategory = () => {
    const name = newCategoryName.trim();
    if (!name) {
      Alert.alert('Validation', 'Please enter a category name.');
      return;
    }
    if (currentConfig.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      Alert.alert('Duplicate', 'A category with this name already exists.');
      return;
    }
    const id = `cat_${Date.now()}`;
    setConfig({
      ...currentConfig,
      categories: [...currentConfig.categories, { id, name, products: [] }],
    });
    setNewCategoryName('');
    setExpandedCategoryId(id);
  };

  const removeCategory = (categoryId: string) => {
    Alert.alert('Remove Category', 'Are you sure? All products in this category will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setConfig({
            ...currentConfig,
            categories: currentConfig.categories.filter(c => c.id !== categoryId),
          });
          if (expandedCategoryId === categoryId) setExpandedCategoryId(null);
        },
      },
    ]);
  };

  const addProduct = (categoryId: string) => {
    const name = newProductName.trim();
    const price = newProductPrice.trim();
    if (!name) {
      Alert.alert('Validation', 'Please enter a product name.');
      return;
    }
    if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      Alert.alert('Validation', 'Please enter a valid price.');
      return;
    }
    const product: OfflineProduct = {
      id: `prod_${Date.now()}`,
      name,
      price,
      sku: newProductSku.trim() || undefined,
    };
    setConfig({
      ...currentConfig,
      categories: currentConfig.categories.map(c => (c.id === categoryId ? { ...c, products: [...c.products, product] } : c)),
    });
    setNewProductName('');
    setNewProductPrice('');
    setNewProductSku('');
  };

  const removeProduct = (categoryId: string, productId: string) => {
    setConfig({
      ...currentConfig,
      categories: currentConfig.categories.map(c =>
        c.id === categoryId ? { ...c, products: c.products.filter(p => p.id !== productId) } : c
      ),
    });
  };

  const validate = () => {
    if (!currentConfig.storeName.trim()) {
      Alert.alert('Validation', 'Please enter your store name.');
      return false;
    }
    if (currentConfig.categories.length === 0) {
      Alert.alert('Validation', 'Please add at least one category.');
      return false;
    }
    const totalProducts = currentConfig.categories.reduce((sum, c) => sum + c.products.length, 0);
    if (totalProducts === 0) {
      Alert.alert('Validation', 'Please add at least one product to any category.');
      return false;
    }
    return true;
  };

  const handleComplete = () => {
    if (validate()) {
      onComplete(currentConfig);
    }
  };

  const totalProducts = currentConfig.categories.reduce((sum, c) => sum + c.products.length, 0);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Set Up Your Store</Text>
      <Text style={styles.subtitle}>Configure your offline store with categories and products. You can always add more later.</Text>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Offline Mode</Text>
        <Text style={styles.infoText}>
          Your store runs entirely on this device. Products, categories, and orders are stored locally. No internet connection required.
        </Text>
      </View>

      {/* Store Name */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Store Details</Text>
        <Text style={styles.inputLabel}>Store Name *</Text>
        <TextInput
          style={styles.input}
          value={currentConfig.storeName}
          onChangeText={value => setConfig({ ...currentConfig, storeName: value })}
          placeholder="My Local Store"
          autoCapitalize="words"
        />

        <Text style={styles.inputLabel}>Store Address (tax destination)</Text>
        <TextInput
          style={styles.input}
          value={currentConfig.storeAddress}
          onChangeText={value => setConfig({ ...currentConfig, storeAddress: value })}
          placeholder="123 High Street, London"
          autoCapitalize="words"
        />

        <Text style={styles.inputLabel}>Currency</Text>
        <FlatList
          data={CURRENCIES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.code}
          contentContainerStyle={styles.currencyRow}
          renderItem={({ item: cur }) => (
            <TouchableOpacity
              style={[styles.currencyChip, currentConfig.currency === cur.code && styles.currencyChipActive]}
              onPress={() => setConfig({ ...currentConfig, currency: cur.code })}
            >
              <Text style={[styles.currencyText, currentConfig.currency === cur.code && styles.currencyTextActive]}>
                {cur.symbol} {cur.code}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Categories */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Categories ({currentConfig.categories.length}) &middot; Products ({totalProducts})
        </Text>

        {/* Add category */}
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, styles.addInput]}
            value={newCategoryName}
            onChangeText={setNewCategoryName}
            placeholder="Category name (e.g. Drinks)"
            autoCapitalize="words"
            onSubmitEditing={addCategory}
          />
          <TouchableOpacity style={styles.addButton} onPress={addCategory}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {/* Category list */}
        {currentConfig.categories.map(category => {
          const isExpanded = expandedCategoryId === category.id;
          return (
            <View key={category.id} style={styles.categoryCard}>
              <TouchableOpacity style={styles.categoryHeader} onPress={() => setExpandedCategoryId(isExpanded ? null : category.id)}>
                <View style={styles.categoryHeaderLeft}>
                  <Text style={styles.categoryIcon}>{isExpanded ? '▼' : '▶'}</Text>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={styles.productCount}>({category.products.length})</Text>
                </View>
                <TouchableOpacity onPress={() => removeCategory(category.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.categoryBody}>
                  {/* Products list */}
                  {category.products.map(product => (
                    <View key={product.id} style={styles.productRow}>
                      <View style={styles.productInfo}>
                        <Text style={styles.productName}>{product.name}</Text>
                        <Text style={styles.productPrice}>
                          {getCurrencySymbol(currentConfig.currency)} {parseFloat(product.price).toFixed(2)}
                        </Text>
                        {product.sku && <Text style={styles.productSku}>SKU: {product.sku}</Text>}
                      </View>
                      <TouchableOpacity onPress={() => removeProduct(category.id, product.id)}>
                        <Text style={styles.removeText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Add product form */}
                  <View style={styles.addProductForm}>
                    <TextInput
                      style={[styles.input, styles.productInput]}
                      value={newProductName}
                      onChangeText={setNewProductName}
                      placeholder="Product name"
                      autoCapitalize="words"
                    />
                    <View style={styles.priceSkuRow}>
                      <TextInput
                        style={[styles.input, styles.priceInput]}
                        value={newProductPrice}
                        onChangeText={setNewProductPrice}
                        placeholder="Price"
                        keyboardType="decimal-pad"
                      />
                      <TextInput
                        style={[styles.input, styles.skuInput]}
                        value={newProductSku}
                        onChangeText={setNewProductSku}
                        placeholder="SKU (optional)"
                        autoCapitalize="characters"
                      />
                    </View>
                    <TouchableOpacity style={styles.addProductButton} onPress={() => addProduct(category.id)}>
                      <Text style={styles.addProductButtonText}>+ Add Product</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}

        {currentConfig.categories.length === 0 && <Text style={styles.emptyText}>No categories yet. Add your first category above.</Text>}
      </View>

      {/* Navigation */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextButton} onPress={handleComplete}>
          <Text style={styles.nextButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center',
    color: lightColors.textPrimary,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    marginBottom: spacing.lg,
    textAlign: 'center',
    lineHeight: 22,
  },
  infoBox: {
    backgroundColor: semanticColors.infoBackground,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: lightColors.primary,
  },
  infoTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: semanticColors.infoText,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    lineHeight: 20,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: typography.fontSize.md,
    backgroundColor: lightColors.surface,
    marginBottom: spacing.sm,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  currencyChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.surface,
  },
  currencyChipActive: {
    backgroundColor: lightColors.primary,
    borderColor: lightColors.primary,
  },
  currencyText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: lightColors.textSecondary,
  },
  currencyTextActive: {
    color: lightColors.textOnPrimary,
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  addInput: {
    flex: 1,
    marginBottom: 0,
  },
  addButton: {
    backgroundColor: lightColors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: lightColors.textOnPrimary,
    fontWeight: '600',
    fontSize: typography.fontSize.sm,
  },
  categoryCard: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    backgroundColor: lightColors.surface,
    ...elevation.low,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  categoryIcon: {
    fontSize: 12,
    color: lightColors.textSecondary,
  },
  categoryName: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  productCount: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  removeText: {
    color: lightColors.error,
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
  categoryBody: {
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    padding: spacing.md,
  },
  productRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    marginBottom: spacing.xs,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: lightColors.textPrimary,
  },
  productPrice: {
    fontSize: typography.fontSize.sm,
    color: lightColors.success,
    fontWeight: '600',
  },
  productSku: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  addProductForm: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  productInput: {
    marginBottom: spacing.xs,
  },
  priceSkuRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priceInput: {
    flex: 1,
  },
  skuInput: {
    flex: 1,
  },
  addProductButton: {
    backgroundColor: lightColors.success,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  addProductButtonText: {
    color: lightColors.textOnPrimary,
    fontWeight: '600',
    fontSize: typography.fontSize.sm,
  },
  emptyText: {
    textAlign: 'center',
    color: lightColors.textSecondary,
    fontSize: typography.fontSize.sm,
    fontStyle: 'italic',
    paddingVertical: spacing.lg,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  backButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  backButtonText: {
    color: lightColors.textSecondary,
    fontWeight: '600',
    fontSize: typography.fontSize.md,
  },
  nextButton: {
    flex: 2,
    backgroundColor: lightColors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  nextButtonText: {
    color: lightColors.textOnPrimary,
    fontWeight: '600',
    fontSize: typography.fontSize.md,
  },
});

export default OfflineSetupStep;
