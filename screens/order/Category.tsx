import { TouchableOpacity, View, Text, StyleSheet, FlatList } from 'react-native';
import React from 'react';
import { lightColors, spacing, typography } from '../../utils/theme';
import { SwipeablePanel } from '../../components/SwipeablePanel';
import { useCategoryContext } from '../../contexts/CategoryProvider';
import { useCategoryNavigation } from '../../hooks/useCategories';
import { UnifiedCategory } from '../../models/UnifiedCategory';

export const Category: React.FC = () => {
  const { selectedCategory, setSelectedCategory, setSelectedCategoryName, isLeftPanelOpen, setIsLeftPanelOpen } = useCategoryContext();
  const {
    displayCategories,
    currentCategory,
    canNavigateUp,
    navigateTo,
    navigateUp,
    navigateToRoot,
    hasChildren,
    isLoading,
  } = useCategoryNavigation();

  const handleCategorySelect = (category: UnifiedCategory) => {
    // Always select this category for filtering products
    setSelectedCategory(category.id);
    setSelectedCategoryName(category.name);
    
    // If category has children, navigate into it to show subcategories
    // but keep the panel open so user can select a subcategory
    if (hasChildren(category.id)) {
      navigateTo(category.id);
    } else {
      // No children - close the panel after selection
      setIsLeftPanelOpen(false);
    }
  };

  const handleGoBack = () => {
    navigateUp();
    // When going back, select the parent category for filtering
    if (currentCategory?.parentId) {
      const parentCategory = displayCategories.find(c => c.id === currentCategory.parentId);
      if (parentCategory) {
        setSelectedCategory(parentCategory.id);
        setSelectedCategoryName(parentCategory.name);
      }
    } else {
      // Going back to root - clear selection to show all products
      setSelectedCategory(null);
      setSelectedCategoryName(null);
    }
  };

  const handleShowAll = () => {
    // Clear category selection to show all products
    setSelectedCategory(null);
    setSelectedCategoryName(null);
    navigateToRoot();
    setIsLeftPanelOpen(false);
  };

  const renderHeader = () => {
    return (
      <View>
        {/* Show All option */}
        <TouchableOpacity 
          onPress={handleShowAll} 
          style={[styles.categoryItem, !selectedCategory && styles.selectedCategory]}
        >
          <Text style={[styles.categoryText, !selectedCategory && styles.selectedCategoryText]}>
            All Products
          </Text>
        </TouchableOpacity>
        
        {/* Back button when navigated into a category */}
        {canNavigateUp && (
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>
              ← Back {currentCategory ? `from ${currentCategory.name}` : ''}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SwipeablePanel isOpen={isLeftPanelOpen} onClose={() => setIsLeftPanelOpen(false)} title="Categories" position="left">
      <View style={styles.panelContent}>
        <FlatList
          data={displayCategories}
          ListHeaderComponent={renderHeader}
          renderItem={({ item }) => {
            const categoryHasChildren = hasChildren(item.id);
            return (
              <TouchableOpacity
                style={[styles.categoryItem, selectedCategory === item.id && styles.selectedCategory]}
                onPress={() => handleCategorySelect(item)}
              >
                <View style={styles.categoryRow}>
                  <Text style={[styles.categoryText, selectedCategory === item.id && styles.selectedCategoryText]}>
                    {item.name}
                  </Text>
                  {categoryHasChildren && (
                    <Text style={styles.chevron}>›</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={true}
        />
      </View>
    </SwipeablePanel>
  );
};

const styles = StyleSheet.create({
  panelContent: {
    flex: 1,
    height: '100%',
    width: '100%',
  },
  categoryItem: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedCategory: {
    backgroundColor: lightColors.primaryLight,
  },
  categoryText: {
    fontSize: typography.fontSize.md,
  },
  selectedCategoryText: {
    fontWeight: '700',
    color: lightColors.primary,
  },
  chevron: {
    fontSize: typography.fontSize.lg,
    color: lightColors.textSecondary,
  },
  backButton: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    backgroundColor: lightColors.surface,
  },
  backButtonText: {
    fontSize: typography.fontSize.md,
    color: lightColors.primary,
    fontWeight: '700',
  },
});
