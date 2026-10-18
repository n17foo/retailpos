import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { useOfflineProducts, Product } from '../../catalogue/hooks/useOfflineProducts';
import { useOfflineCategories } from '../../catalogue/hooks/useOfflineCategories';
import { useCurrency } from '../../platform-clients/hooks/useCurrency';
import { productManagementStyles as styles } from '../components/productManagementStyles';
import { ProductCard } from '../components/ProductCard';
import { ProductFormModal } from '../components/ProductFormModal';
import { EMPTY_PRODUCT_FORM, ProductFormData } from '../utils/productFormData';

const ProductManagementTab: React.FC = () => {
  const currency = useCurrency();
  const { products, isLoading, error, createProduct, updateProduct, deleteProduct } = useOfflineProducts();
  const { categories } = useOfflineCategories();

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({ ...EMPTY_PRODUCT_FORM });
  const [searchQuery, setSearchQuery] = useState('');

  const resetForm = () => {
    setFormData({ ...EMPTY_PRODUCT_FORM });
    setSelectedProduct(null);
    setIsEditing(false);
  };

  const handleAddProduct = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEditProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsEditing(true);
    const defaultVariant = product.variants?.[0];
    setFormData({
      title: product.title || '',
      description: product.description || '',
      price: defaultVariant?.price?.toString() || '0',
      sku: defaultVariant?.sku || '',
      barcode: defaultVariant?.barcode || '',
      stock: defaultVariant?.inventoryQuantity?.toString() || '0',
      categoryId: product.productType || '',
      imageUrl: product.images?.[0]?.url || '',
    });
    setShowModal(true);
  };

  const handleDeleteProduct = (product: Product) => {
    Alert.alert('Delete Product', `Are you sure you want to delete "${product.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const success = await deleteProduct(product.id);
          if (success) {
            Alert.alert('Success', 'Product deleted successfully.');
          } else {
            Alert.alert('Error', 'Failed to delete product.');
          }
        },
      },
    ]);
  };

  const validateForm = (): boolean => {
    if (!formData.title.trim()) {
      Alert.alert('Validation Error', 'Please enter a product title.');
      return false;
    }
    if (!formData.price || isNaN(parseFloat(formData.price)) || parseFloat(formData.price) < 0) {
      Alert.alert('Validation Error', 'Please enter a valid price.');
      return false;
    }
    return true;
  };

  const handleSaveProduct = async () => {
    if (!validateForm()) return;

    const productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      productType: formData.categoryId || undefined,
      variants: [
        {
          id: selectedProduct?.variants?.[0]?.id || `var-${Date.now()}`,
          title: 'Default',
          sku: formData.sku.trim() || undefined,
          barcode: formData.barcode.trim() || undefined,
          price: parseFloat(formData.price) || 0,
          inventoryQuantity: parseInt(formData.stock) || 0,
        },
      ],
      images: formData.imageUrl.trim() ? [{ id: 'main', url: formData.imageUrl.trim(), alt: formData.title.trim() }] : [],
    };

    try {
      if (isEditing && selectedProduct) {
        await updateProduct(selectedProduct.id, productData);
        Alert.alert('Success', 'Product updated successfully.');
      } else {
        await createProduct(productData);
        Alert.alert('Success', 'Product created successfully.');
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save product');
    }
  };

  const filteredProducts = products.filter(
    p =>
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.variants?.some(v => v.sku?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      p.variants?.some(v => v.barcode?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Product Management</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddProduct}>
          <Text style={styles.addButtonText}>+ Add Product</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search products by name, SKU, or barcode..."
        />
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
      {isLoading && <Text style={styles.loadingText}>Loading...</Text>}

      <View style={styles.productList}>
        {filteredProducts.length === 0 ? (
          <Text style={styles.emptyText}>
            {searchQuery ? 'No products match your search.' : 'No products found. Add your first product above.'}
          </Text>
        ) : (
          filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              currencyCode={currency.code}
              onEdit={handleEditProduct}
              onDelete={handleDeleteProduct}
            />
          ))
        )}
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>Total Products: {products.length}</Text>
      </View>

      <ProductFormModal
        visible={showModal}
        isEditing={isEditing}
        formData={formData}
        categories={categories}
        onFormChange={setFormData}
        onCancel={() => {
          setShowModal(false);
          resetForm();
        }}
        onSubmit={handleSaveProduct}
      />
    </ScrollView>
  );
};

export default ProductManagementTab;
