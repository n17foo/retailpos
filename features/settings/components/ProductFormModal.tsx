import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import { productManagementStyles as styles } from './productManagementStyles';
import type { ProductFormData } from '../utils/productFormData';

interface ProductFormModalProps {
  visible: boolean;
  isEditing: boolean;
  formData: ProductFormData;
  categories: Array<{ id: string; name: string }>;
  onFormChange: (data: ProductFormData) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

/** Add/Edit product modal — title, description, price, SKU, barcode, stock, category, image URL. */
export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  visible,
  isEditing,
  formData,
  categories,
  onFormChange,
  onCancel,
  onSubmit,
}) => (
  <Modal visible={visible} animationType="slide" transparent>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <Text style={styles.modalTitle}>{isEditing ? 'Edit Product' : 'Add New Product'}</Text>

          <Text style={styles.inputLabel}>Title *</Text>
          <TextInput
            style={styles.input}
            value={formData.title}
            onChangeText={text => onFormChange({ ...formData, title: text })}
            placeholder="Product title"
          />

          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={text => onFormChange({ ...formData, description: text })}
            placeholder="Product description"
            multiline
            numberOfLines={3}
          />

          <Text style={styles.inputLabel}>Price *</Text>
          <TextInput
            style={styles.input}
            value={formData.price}
            onChangeText={text => onFormChange({ ...formData, price: text })}
            placeholder="0.00"
            keyboardType="decimal-pad"
          />

          <Text style={styles.inputLabel}>SKU</Text>
          <TextInput
            style={styles.input}
            value={formData.sku}
            onChangeText={text => onFormChange({ ...formData, sku: text })}
            placeholder="Stock keeping unit"
            autoCapitalize="characters"
          />

          <Text style={styles.inputLabel}>Barcode</Text>
          <TextInput
            style={styles.input}
            value={formData.barcode}
            onChangeText={text => onFormChange({ ...formData, barcode: text })}
            placeholder="Barcode / UPC"
            keyboardType="number-pad"
          />

          <Text style={styles.inputLabel}>Stock Quantity</Text>
          <TextInput
            style={styles.input}
            value={formData.stock}
            onChangeText={text => onFormChange({ ...formData, stock: text })}
            placeholder="0"
            keyboardType="number-pad"
          />

          <Text style={styles.inputLabel}>Category</Text>
          <View style={styles.categorySelector}>
            <TouchableOpacity
              style={[styles.categoryOption, !formData.categoryId && styles.categoryOptionSelected]}
              onPress={() => onFormChange({ ...formData, categoryId: '' })}
            >
              <Text style={[styles.categoryOptionText, !formData.categoryId && styles.categoryOptionTextSelected]}>None</Text>
            </TouchableOpacity>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.categoryOption, formData.categoryId === cat.name && styles.categoryOptionSelected]}
                onPress={() => onFormChange({ ...formData, categoryId: cat.name })}
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
            onChangeText={text => onFormChange({ ...formData, imageUrl: text })}
            placeholder="https://example.com/image.jpg"
            autoCapitalize="none"
            keyboardType="url"
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={onSubmit}>
              <Text style={styles.saveButtonText}>{isEditing ? 'Update' : 'Create'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  </Modal>
);
