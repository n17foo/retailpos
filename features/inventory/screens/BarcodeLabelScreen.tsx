/**
 * BarcodeLabelScreen
 *
 * Multi-select products and print barcode labels. Supports label format
 * configuration and CSV export fallback.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../../shared/utils/theme';
import { formatMoney } from '../../../shared/utils/money';
import { useCurrency } from '../../platform-clients/hooks/useCurrency';
import { Button } from '../../../shared/components/Button';
import { Input } from '../../../shared/components/Input';
import { Card } from '../../../shared/components/Card';
import { useProductsForDisplay } from '../../catalogue/hooks/useProducts';
import { barcodeLabelService, LabelData, LabelFormat } from '../services/BarcodeLabelService';
import { useAuthContext } from '../../authentication/contexts/AuthProvider';
import { Paths, File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

interface ProductSelection {
  productId: string;
  variantId?: string;
  name: string;
  sku?: string;
  price?: number;
  selected: boolean;
  quantity: number;
}

const BarcodeLabelScreen: React.FC = () => {
  const { products } = useProductsForDisplay();
  const { user } = useAuthContext();
  const currency = useCurrency();

  const [productSelections, setProductSelections] = useState<ProductSelection[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectAll, setSelectAll] = useState(false);
  const [labelFormat, setLabelFormat] = useState<LabelFormat>(barcodeLabelService.getDefaultFormat());
  const [printing, setPrinting] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Initialize product selections
  useEffect(() => {
    const selections: ProductSelection[] = products.map(product => ({
      productId: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price,
      selected: false,
      quantity: 1,
    }));
    setProductSelections(selections);
  }, [products]);

  // Filter products by search query
  const filteredProducts = productSelections.filter(
    product =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.sku && product.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Get selected products
  const selectedProducts = productSelections.filter(p => p.selected);
  const totalLabels = selectedProducts.reduce((sum, p) => sum + p.quantity, 0);

  // Toggle product selection
  const toggleProduct = (productId: string) => {
    setProductSelections(prev => prev.map(p => (p.productId === productId ? { ...p, selected: !p.selected } : p)));
  };

  // Update quantity for a product
  const updateQuantity = (productId: string, quantity: string) => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) return;

    setProductSelections(prev => prev.map(p => (p.productId === productId ? { ...p, quantity: qty } : p)));
  };

  // Toggle select all
  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setProductSelections(prev => prev.map(p => ({ ...p, selected: newSelectAll })));
  };

  // Print labels
  const handlePrint = async () => {
    if (selectedProducts.length === 0) {
      Alert.alert('No Selection', 'Please select at least one product to print labels.');
      return;
    }

    const labelData: LabelData[] = selectedProducts.map(product => ({
      productId: product.productId,
      variantId: product.variantId,
      name: product.name,
      sku: product.sku,
      price: product.price,
      barcode: product.sku, // Use SKU as barcode
      quantity: product.quantity,
    }));

    const validation = barcodeLabelService.validateLabelData(labelData);
    if (!validation.valid) {
      Alert.alert('Validation Error', validation.errors.join('\n'));
      return;
    }

    setPrinting(true);
    try {
      const result = await barcodeLabelService.printLabels(labelData, labelFormat, user?.id);

      if (result.success) {
        if (result.failed > 0) {
          Alert.alert('Partial Success', `Printed ${result.printed} labels successfully. ${result.failed} labels failed to print.`);
        } else {
          Alert.alert('Success', `Printed ${result.printed} labels successfully.`);
        }

        // Clear selections after successful print
        setProductSelections(prev => prev.map(p => ({ ...p, selected: false, quantity: 1 })));
        setSelectAll(false);
      } else {
        // Offer CSV export as fallback
        Alert.alert('Print Failed', `Failed to print labels: ${result.error}\n\nWould you like to export to CSV instead?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Export CSV', onPress: () => handleExportCsv() },
        ]);
      }
    } catch {
      Alert.alert('Error', 'Failed to print labels. Please try again.');
    } finally {
      setPrinting(false);
    }
  };

  // Export to CSV
  const handleExportCsv = async () => {
    if (selectedProducts.length === 0) {
      Alert.alert('No Selection', 'Please select at least one product to export.');
      return;
    }

    const labelData: LabelData[] = selectedProducts.map(product => ({
      productId: product.productId,
      variantId: product.variantId,
      name: product.name,
      sku: product.sku,
      price: product.price,
      quantity: product.quantity,
    }));

    setExporting(true);
    try {
      const csvContent = await barcodeLabelService.exportToCsv(labelData);

      // Save to file and share using new expo-file-system API
      const fileName = `barcode_labels_${new Date().toISOString().split('T')[0]}.csv`;
      const file = new File(Paths.document, fileName);

      file.write(csvContent);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Barcode Labels',
        });
      } else {
        Alert.alert('Export Complete', `Labels exported to ${fileName}`);
      }

      // Clear selections after successful export
      setProductSelections(prev => prev.map(p => ({ ...p, selected: false, quantity: 1 })));
      setSelectAll(false);
    } catch {
      Alert.alert('Error', 'Failed to export labels. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // Render product item
  const renderProduct = ({ item }: { item: ProductSelection }) => (
    <TouchableOpacity
      style={[styles.productCard, item.selected && styles.productCardSelected]}
      onPress={() => toggleProduct(item.productId)}
    >
      <View style={styles.productHeader}>
        <View style={styles.checkbox}>
          <MaterialIcons
            name={item.selected ? 'check-box' : 'check-box-outline-blank'}
            size={24}
            color={item.selected ? lightColors.primary : lightColors.textSecondary}
          />
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          {item.sku && <Text style={styles.productSku}>SKU: {item.sku}</Text>}
          {item.price !== undefined && <Text style={styles.productPrice}>{formatMoney(item.price, currency.code)}</Text>}
        </View>
        {item.selected && (
          <View style={styles.quantityContainer}>
            <Text style={styles.quantityLabel}>Qty:</Text>
            <TextInput
              style={styles.quantityInput}
              value={item.quantity.toString()}
              onChangeText={val => updateQuantity(item.productId, val)}
              keyboardType="number-pad"
              selectTextOnFocus
            />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Print Barcode Labels</Text>
        <Text style={styles.subtitle}>
          {selectedProducts.length > 0
            ? `${selectedProducts.length} products selected (${totalLabels} labels)`
            : 'Select products to print labels'}
        </Text>
      </View>

      {/* Search and Select All */}
      <View style={styles.controls}>
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          showClearButton
          containerStyle={styles.searchInput}
        />
        <TouchableOpacity style={styles.selectAllButton} onPress={toggleSelectAll}>
          <MaterialIcons name={selectAll ? 'check-box' : 'check-box-outline-blank'} size={20} color={lightColors.primary} />
          <Text style={styles.selectAllText}>Select All</Text>
        </TouchableOpacity>
      </View>

      {/* Product List */}
      <FlatList
        data={filteredProducts}
        keyExtractor={item => item.productId}
        renderItem={renderProduct}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="label" size={64} color={lightColors.textHint} />
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
      />

      {/* Label Format Settings */}
      {selectedProducts.length > 0 && (
        <Card style={styles.formatCard}>
          <Text style={styles.formatTitle}>Label Format</Text>
          <View style={styles.formatOptions}>
            <View style={styles.formatRow}>
              <Text style={styles.formatLabel}>Font Size:</Text>
              <View style={styles.fontSizeButtons}>
                {(['small', 'medium', 'large'] as const).map(size => (
                  <TouchableOpacity
                    key={size}
                    style={[styles.fontSizeButton, labelFormat.fontSize === size && styles.fontSizeButtonActive]}
                    onPress={() => setLabelFormat(prev => ({ ...prev, fontSize: size }))}
                  >
                    <Text style={[styles.fontSizeButtonText, labelFormat.fontSize === size && styles.fontSizeButtonTextActive]}>
                      {size}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View style={styles.formatCheckboxes}>
              {[
                { key: 'includeName', label: 'Product Name' },
                { key: 'includeSku', label: 'SKU' },
                { key: 'includePrice', label: 'Price' },
              ].map(option => (
                <TouchableOpacity
                  key={option.key}
                  style={styles.formatCheckbox}
                  onPress={() =>
                    setLabelFormat(prev => ({
                      ...prev,
                      [option.key]: !prev[option.key as keyof LabelFormat],
                    }))
                  }
                >
                  <MaterialIcons
                    name={labelFormat[option.key as keyof LabelFormat] ? 'check-box' : 'check-box-outline-blank'}
                    size={20}
                    color={lightColors.primary}
                  />
                  <Text style={styles.formatCheckboxText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </Card>
      )}

      {/* Action Buttons */}
      {selectedProducts.length > 0 && (
        <View style={styles.actions}>
          <Button
            title={`Print ${totalLabels} Labels`}
            variant="primary"
            onPress={handlePrint}
            loading={printing}
            disabled={printing || exporting}
            style={styles.actionButton}
          />
          <Button
            title="Export CSV"
            variant="outline"
            onPress={handleExportCsv}
            loading={exporting}
            disabled={printing || exporting}
            style={styles.actionButton}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  header: {
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    gap: spacing.md,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectAllText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.primary,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
  },
  productCard: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: lightColors.background,
    ...elevation.low,
  },
  productCardSelected: {
    borderColor: lightColors.primary,
    backgroundColor: lightColors.primary + '08',
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checkbox: {
    width: 24,
    height: 24,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  productSku: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  productPrice: {
    fontSize: typography.fontSize.sm,
    color: lightColors.success,
    fontWeight: '600',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  quantityLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  quantityInput: {
    width: 50,
    height: 32,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    textAlign: 'center',
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
    backgroundColor: lightColors.inputBackground,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    marginTop: spacing.md,
  },
  formatCard: {
    margin: spacing.md,
    marginTop: 0,
  },
  formatTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.md,
  },
  formatOptions: {
    gap: spacing.md,
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  formatLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  fontSizeButtons: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  fontSizeButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.inputBackground,
  },
  fontSizeButtonActive: {
    borderColor: lightColors.primary,
    backgroundColor: lightColors.primary,
  },
  fontSizeButtonText: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    textTransform: 'capitalize',
  },
  fontSizeButtonTextActive: {
    color: lightColors.textOnPrimary,
    fontWeight: '600',
  },
  formatCheckboxes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  formatCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  formatCheckboxText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});

export default BarcodeLabelScreen;
