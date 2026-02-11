import { TouchableOpacity, View, Text, StyleSheet, FlatList } from 'react-native';
import React, { memo, useCallback } from 'react';
import { lightColors, spacing, typography } from '../../utils/theme';
import { useCategoryContext } from '../../contexts/CategoryProvider';
import { useCategoryNavigation } from '../../hooks/useCategories';
import { Breadcrumb, BreadcrumbItem } from '../../components/Breadcrumb';
import { UnifiedCategory } from '../../services/category/types';

interface CategoryListProps {
  showBreadcrumb?: boolean;
}

/**
 * Inline category list component that can be used both in a sidebar and in a SwipeablePanel.
 */
const CategoryListInner: React.FC<CategoryListProps> = ({ showBreadcrumb = false }) => {
  const { selectedCategory, setSelectedCategory, setSelectedCategoryName } = useCategoryContext();
  const { displayCategories, currentCategory, canNavigateUp, navigateTo, navigateUp, navigateToRoot, hasChildren, breadcrumb } =
    useCategoryNavigation();

  const handleCategorySelect = (category: UnifiedCategory) => {
    setSelectedCategory(category.id);
    setSelectedCategoryName(category.name);

    if (hasChildren(category.id)) {
      navigateTo(category.id);
    }
  };

  const handleGoBack = () => {
    navigateUp();
    if (currentCategory?.parentId) {
      const parentCategory = displayCategories.find(c => c.id === currentCategory.parentId);
      if (parentCategory) {
        setSelectedCategory(parentCategory.id);
        setSelectedCategoryName(parentCategory.name);
      }
    } else {
      setSelectedCategory(null);
      setSelectedCategoryName(null);
    }
  };

  const handleShowAll = () => {
    setSelectedCategory(null);
    setSelectedCategoryName(null);
    navigateToRoot();
  };

  const handleBreadcrumbNavigate = (id: string | null) => {
    if (!id) {
      handleShowAll();
    } else {
      navigateTo(id);
      setSelectedCategory(id);
      const cat = displayCategories.find(c => c.id === id);
      if (cat) setSelectedCategoryName(cat.name);
    }
  };

  // Build breadcrumb items from the trail
  const breadcrumbItems: BreadcrumbItem[] = (breadcrumb || []).map(cat => ({
    id: cat.id,
    label: cat.name,
  }));

  const renderHeader = () => {
    return (
      <View>
        {showBreadcrumb && breadcrumbItems.length > 0 && <Breadcrumb items={breadcrumbItems} onNavigate={handleBreadcrumbNavigate} />}

        {/* Show All option */}
        <TouchableOpacity onPress={handleShowAll} style={[styles.categoryItem, !selectedCategory && styles.selectedCategory]}>
          <Text style={[styles.categoryText, !selectedCategory && styles.selectedCategoryText]}>All Products</Text>
        </TouchableOpacity>

        {/* Back button when navigated into a category */}
        {canNavigateUp && (
          <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back {currentCategory ? `from ${currentCategory.name}` : ''}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
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
                <Text style={[styles.categoryText, selectedCategory === item.id && styles.selectedCategoryText]}>{item.name}</Text>
                {categoryHasChildren && <Text style={styles.chevron}>›</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={true}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={5}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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

export const CategoryList = memo(CategoryListInner);
export default CategoryList;
