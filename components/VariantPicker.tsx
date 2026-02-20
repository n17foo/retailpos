import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import { formatMoney } from '../utils/money';
import { UnifiedProductVariant, UnifiedProductOption } from '../services/product/types';
import { useTranslate } from '../hooks/useTranslate';

interface VariantPickerProps {
  variants: UnifiedProductVariant[];
  options: UnifiedProductOption[];
  currencyCode: string;
  onSelect: (variant: UnifiedProductVariant) => void;
  onClose: () => void;
  visible: boolean;
  productTitle: string;
}

const VariantPicker: React.FC<VariantPickerProps> = ({ variants, options, currencyCode, onSelect, onClose, visible, productTitle }) => {
  const { t } = useTranslate();
  // Track selected option value per option name
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  // Filter variants based on selected options
  const filteredVariants = useMemo(() => {
    const selectedEntries = Object.entries(selectedOptions).filter(([, v]) => v !== '');
    if (selectedEntries.length === 0) return variants;

    return variants.filter(variant => {
      return selectedEntries.every(([optName, optValue]) => {
        const optIndex = options.findIndex(o => o.name === optName);
        if (optIndex === -1) return true;
        return variant.optionValues[optIndex] === optValue;
      });
    });
  }, [variants, options, selectedOptions]);

  const handleOptionSelect = (optionName: string, value: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [optionName]: prev[optionName] === value ? '' : value,
    }));
  };

  const handleVariantSelect = (variant: UnifiedProductVariant) => {
    onSelect(variant);
    setSelectedOptions({});
  };

  const handleClose = () => {
    setSelectedOptions({});
    onClose();
  };

  const renderVariantItem = ({ item }: { item: UnifiedProductVariant }) => {
    const isOutOfStock = item.trackInventory && item.inventoryQuantity <= 0 && !item.allowBackorder;

    return (
      <TouchableOpacity
        style={[styles.variantItem, isOutOfStock && styles.variantItemDisabled]}
        onPress={() => !isOutOfStock && handleVariantSelect(item)}
        disabled={isOutOfStock}
        accessibilityLabel={`${item.title}, ${formatMoney(item.price, currencyCode)}${isOutOfStock ? `, ${t('variantPicker.outOfStock')}` : ''}`}
        accessibilityRole="button"
        accessibilityState={{ disabled: isOutOfStock }}
        accessibilityHint={isOutOfStock ? t('variantPicker.outOfStockHint') : t('variantPicker.addToCart')}
      >
        <View style={styles.variantInfo}>
          <Text style={[styles.variantTitle, isOutOfStock && styles.variantTitleDisabled]}>{item.title}</Text>
          {item.sku && <Text style={styles.variantSku}>{t('basket.sku', { sku: item.sku })}</Text>}
          {item.trackInventory && (
            <Text style={[styles.variantStock, isOutOfStock && styles.variantStockOut]}>
              {isOutOfStock ? t('variantPicker.outOfStock') : t('variantPicker.inStock', { count: item.inventoryQuantity })}
            </Text>
          )}
        </View>
        <View style={styles.variantPriceCol}>
          <Text style={[styles.variantPrice, isOutOfStock && styles.variantTitleDisabled]}>{formatMoney(item.price, currencyCode)}</Text>
          {item.compareAtPrice != null && item.compareAtPrice > item.price && (
            <Text style={styles.variantComparePrice}>{formatMoney(item.compareAtPrice, currencyCode)}</Text>
          )}
        </View>
        {!isOutOfStock && <MaterialIcons name="add-circle-outline" size={22} color={lightColors.primary} />}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {productTitle}
              </Text>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeButton}
                accessibilityLabel={t('variantPicker.closeLabel')}
                accessibilityRole="button"
              >
                <MaterialIcons name="close" size={22} color={lightColors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>
              {filteredVariants.length === 1
                ? t('variantPicker.variantCount', { count: 1 })
                : t('variantPicker.variantCount_plural', { count: filteredVariants.length })}
            </Text>
          </View>

          {/* Option filters */}
          {options.length > 0 && (
            <View style={styles.optionsSection}>
              {options.map(option => (
                <View key={option.id} style={styles.optionGroup}>
                  <Text style={styles.optionLabel}>{option.name}</Text>
                  <View style={styles.optionValues}>
                    {option.values.map(value => {
                      const isSelected = selectedOptions[option.name] === value;
                      return (
                        <TouchableOpacity
                          key={value}
                          style={[styles.optionChip, isSelected && styles.optionChipSelected]}
                          onPress={() => handleOptionSelect(option.name, value)}
                          accessibilityLabel={`${option.name}: ${value}`}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                        >
                          <Text style={[styles.optionChipText, isSelected && styles.optionChipTextSelected]}>{value}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Variant list */}
          <FlatList
            data={filteredVariants}
            keyExtractor={item => item.id}
            renderItem={renderVariantItem}
            style={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>{t('variantPicker.noMatchingVariants')}</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: lightColors.surface,
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    maxHeight: '80%',
    ...elevation.high,
  },
  header: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.xs,
  },
  optionsSection: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  optionGroup: {
    marginBottom: spacing.sm,
  },
  optionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  optionValues: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  optionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: lightColors.border,
    backgroundColor: lightColors.background,
  },
  optionChipSelected: {
    borderColor: lightColors.primary,
    backgroundColor: lightColors.primary + '15',
  },
  optionChipText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
  },
  optionChipTextSelected: {
    color: lightColors.primary,
    fontWeight: '600',
  },
  list: {
    flex: 1,
  },
  variantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  variantItemDisabled: {
    opacity: 0.5,
  },
  variantInfo: {
    flex: 1,
  },
  variantTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  variantTitleDisabled: {
    color: lightColors.textSecondary,
  },
  variantSku: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  variantStock: {
    fontSize: typography.fontSize.xs,
    color: lightColors.success,
    marginTop: 2,
  },
  variantStockOut: {
    color: lightColors.error,
  },
  variantPriceCol: {
    alignItems: 'flex-end',
    marginRight: spacing.sm,
  },
  variantPrice: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  variantComparePrice: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    textDecorationLine: 'line-through',
    marginTop: 2,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
});

export default VariantPicker;
