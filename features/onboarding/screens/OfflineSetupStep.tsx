import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { offlineSetupStyles as styles } from '../components/offlineSetupStyles';
import { OfflineStoreDetailsSection } from '../components/OfflineStoreDetailsSection';
import { OfflineCategoryCard } from '../components/OfflineCategoryCard';

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

      {/* Store Details */}
      <OfflineStoreDetailsSection
        storeName={currentConfig.storeName}
        storeAddress={currentConfig.storeAddress}
        currency={currentConfig.currency}
        onStoreNameChange={value => setConfig({ ...currentConfig, storeName: value })}
        onStoreAddressChange={value => setConfig({ ...currentConfig, storeAddress: value })}
        onCurrencyChange={code => setConfig({ ...currentConfig, currency: code })}
      />

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

        {currentConfig.categories.map(category => (
          <OfflineCategoryCard
            key={category.id}
            category={category}
            isExpanded={expandedCategoryId === category.id}
            currency={currentConfig.currency}
            newProductName={newProductName}
            newProductPrice={newProductPrice}
            newProductSku={newProductSku}
            onToggleExpand={id => setExpandedCategoryId(expandedCategoryId === id ? null : id)}
            onRemoveCategory={removeCategory}
            onRemoveProduct={removeProduct}
            onAddProduct={addProduct}
            onNewProductNameChange={setNewProductName}
            onNewProductPriceChange={setNewProductPrice}
            onNewProductSkuChange={setNewProductSku}
          />
        ))}

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

export default OfflineSetupStep;
