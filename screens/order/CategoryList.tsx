import { TouchableOpacity, View, Text, StyleSheet, FlatList } from 'react-native';
import React, { memo, useCallback } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius } from '../../utils/theme';
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
          <TouchableOpacity
            onPress={handleGoBack}
            style={styles.backButton}
            accessibilityLabel={currentCategory ? `Back from ${currentCategory.name}` : 'Back'}
            accessibilityRole="button"
          >
            <MaterialIcons name="arrow-back" size={16} color={lightColors.primary} />
            <Text style={styles.backButtonText}>{currentCategory ? currentCategory.name : 'Back'}</Text>
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
          const isSelected = selectedCategory === item.id;
          return (
            <TouchableOpacity
              style={[styles.categoryItem, isSelected && styles.selectedCategory]}
              onPress={() => handleCategorySelect(item)}
              accessibilityLabel={item.name + (categoryHasChildren ? ', has subcategories' : '')}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              {isSelected && <View style={styles.selectedAccent} />}
              <View style={styles.categoryRow}>
                <Text style={[styles.categoryText, isSelected && styles.selectedCategoryText]} numberOfLines={1}>
                  {item.name}
                </Text>
                {categoryHasChildren && (
                  <MaterialIcons name="chevron-right" size={18} color={isSelected ? lightColors.primary : lightColors.textSecondary} />
                )}
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
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    position: 'relative',
    minHeight: 44,
    justifyContent: 'center',
  },
  selectedCategory: {
    backgroundColor: lightColors.primary + '10',
  },
  selectedAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: lightColors.primary,
    borderRadius: borderRadius.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: spacing.xs,
  },
  categoryText: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  selectedCategoryText: {
    fontWeight: '700',
    color: lightColors.primary,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
    backgroundColor: lightColors.inputBackground,
    minHeight: 44,
  },
  backButtonText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.primary,
    fontWeight: '600',
    flex: 1,
  },
});

export const CategoryList = memo(CategoryListInner);
export default CategoryList;
