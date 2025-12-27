import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSearch } from '../hooks/useSearch';
import { SearchOptions, SearchProduct } from '../services/search/searchServiceInterface';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import { Button, Input } from '../components';

interface SearchScreenProps {
  onGoBack?: () => void;
  onSelectProduct?: (product: SearchProduct) => void;
}

const SearchScreen: React.FC<SearchScreenProps> = ({ onGoBack, onSelectProduct }) => {
  const { isInitialized, isLoading, error, searchResults, searchHistory, searchProducts } = useSearch();
  const [query, setQuery] = useState('');
  const [filterOptions, setFilterOptions] = useState<SearchOptions>({
    includeEcommerce: true,
    includeLocal: true,
    inStock: false,
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchField, setSearchField] = useState<'name' | 'sku' | 'barcode' | 'all'>('all');

  // Perform search when query changes (with debounce)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (query.trim() && isInitialized) {
        handleSearch();
      }
    }, 500);

    return () => {
      clearTimeout(handler);
    };
  }, [query, filterOptions, isInitialized]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    await searchProducts(query, { ...filterOptions, searchField });
  }, [query, filterOptions, searchProducts, searchField]);

  const handleFilterChange = (key: keyof SearchOptions, value: any) => {
    setFilterOptions(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSelectProduct = (product: SearchProduct) => {
    if (onSelectProduct) {
      onSelectProduct(product);
    }
  };

  const handleHistoryItemPress = (historyItem: string) => {
    setQuery(historyItem);
    searchProducts(historyItem, filterOptions);
  };

  const renderProductItem = ({ item }: { item: SearchProduct }) => {
    // Convert string URL to ImageSourcePropType
    let imageSource: ImageSourcePropType = null;
    if (item.imageUrl) {
      imageSource = { uri: item.imageUrl };
    }

    return (
      <TouchableOpacity style={styles.productItem} onPress={() => handleSelectProduct(item)}>
        {imageSource && <Image source={imageSource} style={styles.productImage} />}
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productDescription} numberOfLines={2}>
            {item.description || 'No description available'}
          </Text>
          <View style={styles.productMetaRow}>
            <Text style={styles.productPrice}>${item.price.toFixed(2)}</Text>
            <View style={styles.badgeContainer}>
              <View
                style={[
                  styles.badge,
                  { backgroundColor: item.source === 'local' ? lightColors.secondary + '40' : lightColors.primary + '40' },
                ]}
              >
                <Text style={styles.badgeText}>{item.source === 'local' ? 'Local' : 'Online'}</Text>
              </View>
              {!item.inStock && (
                <View style={[styles.badge, { backgroundColor: lightColors.error + '40' }]}>
                  <Text style={styles.badgeText}>Out of Stock</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderSearchHistory = () => {
    if (!searchHistory.length) {
      return null;
    }

    return (
      <View style={styles.historyContainer}>
        <Text style={styles.sectionTitle}>Recent Searches</Text>
        {searchHistory.map((item, index) => (
          <TouchableOpacity key={index} style={styles.historyItem} onPress={() => handleHistoryItemPress(item)}>
            <MaterialIcons name="history" size={16} color={lightColors.textSecondary} />
            <Text style={styles.historyText}>{item}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={lightColors.primary} />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <MaterialIcons name="error-outline" size={48} color={lightColors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      );
    }

    if (!query.trim()) {
      return renderSearchHistory();
    }

    if (searchResults && searchResults.totalResults === 0) {
      return (
        <View style={styles.centerContainer}>
          <MaterialIcons name="search-off" size={48} color={lightColors.textSecondary} />
          <Text style={styles.noResultsText}>No products found matching "{query}"</Text>
        </View>
      );
    }

    return (
      searchResults && (
        <FlatList
          data={[...searchResults.localResults, ...searchResults.ecommerceResults]}
          renderItem={renderProductItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.resultsList}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )
    );
  };

  const renderFilters = () => {
    if (!showFilters) return null;

    return (
      <View style={styles.filtersContainer}>
        <Text style={styles.filterTitle}>Filter Results</Text>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Include Local Products:</Text>
          <Button
            title={filterOptions.includeLocal ? 'On' : 'Off'}
            variant={filterOptions.includeLocal ? 'success' : 'outline'}
            size="sm"
            onPress={() => handleFilterChange('includeLocal', !filterOptions.includeLocal)}
          />
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Include Online Products:</Text>
          <Button
            title={filterOptions.includeEcommerce ? 'On' : 'Off'}
            variant={filterOptions.includeEcommerce ? 'success' : 'outline'}
            size="sm"
            onPress={() => handleFilterChange('includeEcommerce', !filterOptions.includeEcommerce)}
          />
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>In Stock Only:</Text>
          <Button
            title={filterOptions.inStock ? 'On' : 'Off'}
            variant={filterOptions.inStock ? 'success' : 'outline'}
            size="sm"
            onPress={() => handleFilterChange('inStock', !filterOptions.inStock)}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Back button in header */}
      {onGoBack && (
        <View style={styles.backButton}>
          <Button title="← Back" variant="ghost" size="sm" onPress={onGoBack} />
        </View>
      )}

      {/* Large, prominent search section */}
      <View style={styles.searchSection}>
        <Text style={styles.searchTitle}>Find Products</Text>

        {/* Search input with icon inside */}
        <View style={styles.searchInputContainer}>
          <MaterialIcons name="search" size={24} color={lightColors.textHint} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for products..."
            placeholderTextColor={lightColors.textHint}
            value={query}
            onChangeText={setQuery}
            autoFocus={true}
          />
          {query.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={20} color={lightColors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Search field selection tabs */}
        <View style={styles.searchFieldTabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.searchFieldTab, searchField === 'all' && styles.activeSearchFieldTab]}
              onPress={() => setSearchField('all')}
            >
              <Text style={[styles.searchFieldTabText, searchField === 'all' && styles.activeSearchFieldTabText]}>All Fields</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.searchFieldTab, searchField === 'name' && styles.activeSearchFieldTab]}
              onPress={() => setSearchField('name')}
            >
              <Text style={[styles.searchFieldTabText, searchField === 'name' && styles.activeSearchFieldTabText]}>Name</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.searchFieldTab, searchField === 'sku' && styles.activeSearchFieldTab]}
              onPress={() => setSearchField('sku')}
            >
              <Text style={[styles.searchFieldTabText, searchField === 'sku' && styles.activeSearchFieldTabText]}>SKU</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.searchFieldTab, searchField === 'barcode' && styles.activeSearchFieldTab]}
              onPress={() => setSearchField('barcode')}
            >
              <Text style={[styles.searchFieldTabText, searchField === 'barcode' && styles.activeSearchFieldTabText]}>Barcode</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Filter toggle */}
        <TouchableOpacity style={styles.filterToggleButton} onPress={() => setShowFilters(!showFilters)}>
          <MaterialIcons name={showFilters ? 'filter-list-off' : 'filter-list'} size={20} color={lightColors.primary} />
          <Text style={styles.filterToggleText}>{showFilters ? 'Hide Filters' : 'Filters'}</Text>
        </TouchableOpacity>
      </View>

      {renderFilters()}
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  backButton: {
    position: 'absolute' as 'absolute',
    top: spacing.md,
    left: spacing.md,
    zIndex: 10,
    padding: spacing.xs,
  },
  searchSection: {
    backgroundColor: lightColors.primary,
    paddingTop: spacing.xl + spacing.md,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderBottomLeftRadius: borderRadius.lg,
    borderBottomRightRadius: borderRadius.lg,
    ...elevation.medium,
    marginBottom: spacing.md,
  },
  searchTitle: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700' as '700',
    color: lightColors.textOnPrimary,
    marginBottom: spacing.md,
  },
  searchInputContainer: {
    flexDirection: 'row' as 'row',
    alignItems: 'center' as 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    ...elevation.low,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  clearButton: {
    padding: spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 46,
    color: lightColors.textPrimary,
    fontSize: typography.fontSize.md,
  },
  searchFieldTabContainer: {
    marginBottom: spacing.md,
  },
  searchFieldTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginRight: spacing.xs,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  activeSearchFieldTab: {
    backgroundColor: lightColors.surface,
    borderColor: lightColors.surface,
    ...elevation.low,
  },
  searchFieldTabText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.sm,
    fontWeight: '500' as '500',
  },
  activeSearchFieldTabText: {
    color: lightColors.primary,
    fontWeight: '700' as '700',
  },
  filterToggleButton: {
    flexDirection: 'row' as 'row',
    alignItems: 'center' as 'center',
    justifyContent: 'center' as 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: borderRadius.round,
    alignSelf: 'center' as 'center',
  },
  filterToggleText: {
    color: lightColors.textOnPrimary,
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.sm,
    fontWeight: '500' as '500',
  },
  // Product item styling
  productItem: {
    flexDirection: 'row' as 'row',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    overflow: 'hidden' as 'hidden',
    marginBottom: spacing.sm,
    ...elevation.low,
  },
  productImage: {
    width: 80,
    height: 80,
    resizeMode: 'cover' as 'cover',
  },
  productInfo: {
    flex: 1,
    padding: spacing.sm,
  },
  productName: {
    fontSize: typography.fontSize.md,
    fontWeight: '600' as '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  productDescription: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  productMetaRow: {
    flexDirection: 'row' as 'row',
    justifyContent: 'space-between' as 'space-between',
    alignItems: 'center' as 'center',
  },
  productPrice: {
    fontSize: typography.fontSize.md,
    fontWeight: '700' as '700',
    color: lightColors.primary,
  },
  badgeContainer: {
    flexDirection: 'row' as 'row',
  },
  badge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.xs,
    justifyContent: 'center' as 'center',
    alignItems: 'center' as 'center',
  },
  badgeText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600' as '600',
  },
  // Loading, error, and empty states
  centerContainer: {
    flex: 1,
    justifyContent: 'center' as 'center',
    alignItems: 'center' as 'center',
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
  errorText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.md,
    color: lightColors.error,
    textAlign: 'center' as 'center',
  },
  noResultsText: {
    marginTop: spacing.sm,
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    textAlign: 'center' as 'center',
  },
  // Results list
  resultsList: {
    padding: spacing.sm,
  },
  separator: {
    height: spacing.sm,
  },
  // Filter section
  filtersContainer: {
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  filterTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600' as '600',
    marginBottom: spacing.sm,
    color: lightColors.textPrimary,
  },
  filterRow: {
    flexDirection: 'row' as 'row',
    justifyContent: 'space-between' as 'space-between',
    alignItems: 'center' as 'center',
    marginBottom: spacing.xs,
  },
  filterLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: lightColors.divider,
  },
  activeFilterButton: {
    backgroundColor: lightColors.primary,
  },
  filterButtonText: {
    color: lightColors.textPrimary,
    fontSize: typography.fontSize.xs,
  },
  activeFilterText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.xs,
    fontWeight: '600' as '600',
  },
  // Search history
  historyContainer: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600' as '600',
    marginBottom: spacing.sm,
    color: lightColors.textPrimary,
  },
  historyItem: {
    flexDirection: 'row' as 'row',
    alignItems: 'center' as 'center',
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  historyText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginLeft: spacing.sm,
  },
});

export default SearchScreen;
