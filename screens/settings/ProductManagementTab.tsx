import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Image } from 'react-native';
import { useOfflineProducts, Product } from '../../hooks/useOfflineProducts';
import { useOfflineCategories } from '../../hooks/useOfflineCategories';
import { formatMoney } from '../../utils/money';
import { useCurrency } from '../../hooks/useCurrency';

interface ProductFormData {
  title: string;
  description: string;
  price: string;
  sku: string;
  barcode: string;
  stock: string;
  categoryId: string;
  imageUrl: string;
}

const emptyFormData: ProductFormData = {
  title: '',
  description: '',
  price: '',
  sku: '',
  barcode: '',
  stock: '',
  categoryId: '',
  imageUrl: '',
};

const ProductManagementTab: React.FC = () => {
  const currency = useCurrency();
  const { products, isLoading, error, loadProducts, createProduct, updateProduct, deleteProduct } = useOfflineProducts();
  const { categories } = useOfflineCategories();

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(emptyFormData);
  const [searchQuery, setSearchQuery] = useState('');

  const resetForm = () => {
    setFormData(emptyFormData);
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

  const renderProductCard = (product: Product) => {
    const defaultVariant = product.variants?.[0];
    const primaryImage = product.images?.[0];

    return (
      <View key={product.id} style={styles.productCard}>
        <View style={styles.productImageContainer}>
          {primaryImage?.url ? (
            <Image source={{ uri: primaryImage.url }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Text style={styles.placeholderText}>No Image</Text>
            </View>
          )}
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productTitle} numberOfLines={2}>
            {product.title}
          </Text>
          <Text style={styles.productPrice}>{formatMoney(defaultVariant?.price || 0, currency.code)}</Text>
          {defaultVariant?.sku && <Text style={styles.productSku}>SKU: {defaultVariant.sku}</Text>}
          <Text style={styles.productStock}>Stock: {defaultVariant?.inventoryQuantity || 0}</Text>
          {product.productType && <Text style={styles.productCategory}>{product.productType}</Text>}
        </View>
        <View style={styles.productActions}>
          <TouchableOpacity style={styles.editButton} onPress={() => handleEditProduct(product)}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteProduct(product)}>
            <Text style={styles.deleteButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderModal = () => (
    <Modal visible={showModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>{isEditing ? 'Edit Product' : 'Add New Product'}</Text>

            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.input}
              value={formData.title}
              onChangeText={text => setFormData({ ...formData, title: text })}
              placeholder="Product title"
            />

            <Text style={styles.inputLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={text => setFormData({ ...formData, description: text })}
              placeholder="Product description"
              multiline
              numberOfLines={3}
            />

            <Text style={styles.inputLabel}>Price *</Text>
            <TextInput
              style={styles.input}
              value={formData.price}
              onChangeText={text => setFormData({ ...formData, price: text })}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />

            <Text style={styles.inputLabel}>SKU</Text>
            <TextInput
              style={styles.input}
              value={formData.sku}
              onChangeText={text => setFormData({ ...formData, sku: text })}
              placeholder="Stock keeping unit"
              autoCapitalize="characters"
            />

            <Text style={styles.inputLabel}>Barcode</Text>
            <TextInput
              style={styles.input}
              value={formData.barcode}
              onChangeText={text => setFormData({ ...formData, barcode: text })}
              placeholder="Barcode / UPC"
              keyboardType="number-pad"
            />

            <Text style={styles.inputLabel}>Stock Quantity</Text>
            <TextInput
              style={styles.input}
              value={formData.stock}
              onChangeText={text => setFormData({ ...formData, stock: text })}
              placeholder="0"
              keyboardType="number-pad"
            />

            <Text style={styles.inputLabel}>Category</Text>
            <View style={styles.categorySelector}>
              <TouchableOpacity
                style={[styles.categoryOption, !formData.categoryId && styles.categoryOptionSelected]}
                onPress={() => setFormData({ ...formData, categoryId: '' })}
              >
                <Text style={[styles.categoryOptionText, !formData.categoryId && styles.categoryOptionTextSelected]}>None</Text>
              </TouchableOpacity>
              {categories.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryOption, formData.categoryId === cat.name && styles.categoryOptionSelected]}
                  onPress={() => setFormData({ ...formData, categoryId: cat.name })}
                >
                  <Text style={[styles.categoryOptionText, formData.categoryId === cat.name && styles.categoryOptionTextSelected]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Image URL</Text>
            <TextInput
              style={styles.input}
              value={formData.imageUrl}
              onChangeText={text => setFormData({ ...formData, imageUrl: text })}
              placeholder="https://example.com/image.jpg"
              autoCapitalize="none"
              keyboardType="url"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveProduct}>
                <Text style={styles.saveButtonText}>{isEditing ? 'Update' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
          filteredProducts.map(renderProductCard)
        )}
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>Total Products: {products.length}</Text>
      </View>

      {renderModal()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  searchContainer: {
    padding: 15,
    backgroundColor: '#fff',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  productList: {
    padding: 15,
  },
  productCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  productImageContainer: {
    width: 80,
    height: 80,
    marginRight: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  productImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 10,
    color: '#999',
  },
  productInfo: {
    flex: 1,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  productSku: {
    fontSize: 12,
    color: '#666',
  },
  productStock: {
    fontSize: 12,
    color: '#666',
  },
  productCategory: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  productActions: {
    justifyContent: 'center',
    gap: 8,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  editButtonText: {
    fontSize: 14,
    color: '#333',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#ffebee',
  },
  deleteButtonText: {
    fontSize: 14,
    color: '#dc3545',
  },
  statsContainer: {
    padding: 15,
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
    gap: 8,
  },
  categoryOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  categoryOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  categoryOptionText: {
    fontSize: 12,
    color: '#333',
  },
  categoryOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  modalButton: {
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  errorText: {
    color: '#dc3545',
    padding: 15,
    textAlign: 'center',
  },
  loadingText: {
    color: '#666',
    padding: 15,
    textAlign: 'center',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    padding: 30,
  },
});

export default ProductManagementTab;
