import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSearch } from '../hooks/useSearch';
import { SearchOptions, SearchProduct } from '../services/search/SearchServiceInterface';
import { lightColors, spacing, typography, borderRadius } from '../utils/theme';
import SearchHeader from './search/SearchHeader';
import FilterPanel from './search/FilterPanel';
import ProductResultItem from './search/ProductResultItem';
import SearchHistory from './search/SearchHistory';

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

  const handleFilterChange = (key: keyof SearchOptions, value: SearchOptions[keyof SearchOptions]) => {
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

  const renderProductItem = ({ item }: { item: SearchProduct }) => <ProductResultItem product={item} onSelect={handleSelectProduct} />;

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
      return <SearchHistory history={searchHistory} onHistoryItemPress={handleHistoryItemPress} />;
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

  return (
    <View style={styles.container}>
      {/* Back button row */}
      {onGoBack && (
        <View style={styles.backRow}>
          <TouchableOpacity onPress={onGoBack} style={styles.backButton} accessibilityLabel="Go back" accessibilityRole="button">
            <MaterialIcons name="arrow-back" size={24} color={lightColors.primary} />
          </TouchableOpacity>
        </View>
      )}

      <SearchHeader
        query={query}
        searchField={searchField}
        showFilters={showFilters}
        onQueryChange={setQuery}
        onSearchFieldChange={setSearchField}
        onToggleFilters={() => setShowFilters(!showFilters)}
      />

      {showFilters && <FilterPanel filterOptions={filterOptions} onFilterChange={handleFilterChange} />}
      {renderContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
  },
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
  resultsList: {
    padding: spacing.sm,
  },
  separator: {
    height: spacing.sm,
  },
});

export default SearchScreen;
