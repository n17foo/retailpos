import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal } from 'react-native';
import { useOfflineCategories, Category } from '../../hooks/useOfflineCategories';

interface CategoryFormData {
  name: string;
  description: string;
  parentId: string;
  image: string;
}

const emptyFormData: CategoryFormData = {
  name: '',
  description: '',
  parentId: '',
  image: '',
};

const CategoryManagementTab: React.FC = () => {
  const { categories, isLoading, error, createCategory, updateCategory, deleteCategory } = useOfflineCategories();

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(emptyFormData);

  const resetForm = () => {
    setFormData(emptyFormData);
    setSelectedCategory(null);
    setIsEditing(false);
  };

  const handleAddCategory = () => {
    resetForm();
    setShowModal(true);
  };

  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    setIsEditing(true);
    setFormData({
      name: category.name || '',
      description: category.description || '',
      parentId: category.parentId || '',
      image: category.image || '',
    });
    setShowModal(true);
  };

  const handleDeleteCategory = (category: Category) => {
    const hasSubcategories = categories.some(c => c.parentId === category.id);
    if (hasSubcategories) {
      Alert.alert('Cannot Delete', 'This category has subcategories. Please delete them first.');
      return;
    }

    Alert.alert('Delete Category', `Are you sure you want to delete "${category.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const success = await deleteCategory(category.id);
          if (success) {
            Alert.alert('Success', 'Category deleted successfully.');
          } else {
            Alert.alert('Error', 'Failed to delete category.');
          }
        },
      },
    ]);
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Please enter a category name.');
      return false;
    }
    return true;
  };

  const handleSaveCategory = async () => {
    if (!validateForm()) return;

    const categoryData: Omit<Category, 'id'> = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      parentId: formData.parentId || undefined,
      image: formData.image.trim() || undefined,
    };

    try {
      if (isEditing && selectedCategory) {
        await updateCategory(selectedCategory.id, categoryData);
        Alert.alert('Success', 'Category updated successfully.');
      } else {
        await createCategory(categoryData);
        Alert.alert('Success', 'Category created successfully.');
      }
      setShowModal(false);
      resetForm();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save category');
    }
  };

  const getRootCategories = () => categories.filter(c => !c.parentId);
  const getSubcategories = (parentId: string) => categories.filter(c => c.parentId === parentId);

  const renderCategoryCard = (category: Category, level: number = 0) => {
    const subcategories = getSubcategories(category.id);

    return (
      <View key={category.id}>
        <View style={[styles.categoryCard, { marginLeft: level * 20 }]}>
          <View style={styles.categoryInfo}>
            <Text style={styles.categoryName}>{category.name}</Text>
            {category.description && (
              <Text style={styles.categoryDescription} numberOfLines={2}>
                {category.description}
              </Text>
            )}
            {subcategories.length > 0 && <Text style={styles.subcategoryCount}>{subcategories.length} subcategories</Text>}
          </View>
          <View style={styles.categoryActions}>
            <TouchableOpacity style={styles.editButton} onPress={() => handleEditCategory(category)}>
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteCategory(category)}>
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
        {subcategories.map(sub => renderCategoryCard(sub, level + 1))}
      </View>
    );
  };

  const renderModal = () => (
    <Modal visible={showModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{isEditing ? 'Edit Category' : 'Add New Category'}</Text>

          <Text style={styles.inputLabel}>Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={text => setFormData({ ...formData, name: text })}
            placeholder="Category name"
          />

          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={text => setFormData({ ...formData, description: text })}
            placeholder="Category description"
            multiline
            numberOfLines={3}
          />

          <Text style={styles.inputLabel}>Parent Category</Text>
          <View style={styles.parentSelector}>
            <TouchableOpacity
              style={[styles.parentOption, !formData.parentId && styles.parentOptionSelected]}
              onPress={() => setFormData({ ...formData, parentId: '' })}
            >
              <Text style={[styles.parentOptionText, !formData.parentId && styles.parentOptionTextSelected]}>None (Root Category)</Text>
            </TouchableOpacity>
            {categories
              .filter(c => c.id !== selectedCategory?.id)
              .map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.parentOption, formData.parentId === cat.id && styles.parentOptionSelected]}
                  onPress={() => setFormData({ ...formData, parentId: cat.id })}
                >
                  <Text style={[styles.parentOptionText, formData.parentId === cat.id && styles.parentOptionTextSelected]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
          </View>

          <Text style={styles.inputLabel}>Image URL</Text>
          <TextInput
            style={styles.input}
            value={formData.image}
            onChangeText={text => setFormData({ ...formData, image: text })}
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
            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveCategory}>
              <Text style={styles.saveButtonText}>{isEditing ? 'Update' : 'Create'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Category Management</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddCategory}>
          <Text style={styles.addButtonText}>+ Add Category</Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
      {isLoading && <Text style={styles.loadingText}>Loading...</Text>}

      <View style={styles.categoryList}>
        {categories.length === 0 ? (
          <Text style={styles.emptyText}>No categories found. Add your first category above.</Text>
        ) : (
          getRootCategories().map(cat => renderCategoryCard(cat))
        )}
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>Total Categories: {categories.length}</Text>
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
  categoryList: {
    padding: 15,
  },
  categoryCard: {
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
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  subcategoryCount: {
    fontSize: 12,
    color: '#999',
  },
  categoryActions: {
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
  parentSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
    gap: 8,
  },
  parentOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  parentOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  parentOptionText: {
    fontSize: 12,
    color: '#333',
  },
  parentOptionTextSelected: {
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

export default CategoryManagementTab;
