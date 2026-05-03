/**
 * TransferOrdersScreen
 *
 * Lists transfer orders with status filter. Supports create, dispatch,
 * and receive flows. Manager/admin only.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../utils/theme';
import { Button } from '../../components/Button';
import { procurementService } from '../../services/procurement/ProcurementService';
import { TransferOrderRow, TransferOrderItemRow } from '../../repositories/ProcurementRepository';
import { useAuthContext } from '../../contexts/AuthProvider';
import { useEcommerceSettings } from '../../hooks/useEcommerceSettings';
import { useProductsForDisplay } from '../../hooks/useProducts';
import { ECommercePlatform } from '../../utils/platforms';

type ViewMode = 'list' | 'detail' | 'create';
type StatusFilter = 'all' | 'draft' | 'in_transit' | 'received' | 'cancelled';

const STATUS_COLORS: Record<string, string> = {
  draft: lightColors.textSecondary,
  in_transit: lightColors.info,
  received: lightColors.success,
  cancelled: lightColors.error,
};

const TransferOrdersScreen: React.FC = () => {
  const { user } = useAuthContext();
  const { ecommerceSettings } = useEcommerceSettings();
  const { products } = useProductsForDisplay();
  const platform = (ecommerceSettings?.platform ?? 'offline') as ECommercePlatform;

  const [transfers, setTransfers] = useState<TransferOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedTransfer, setSelectedTransfer] = useState<TransferOrderRow | null>(null);
  const [transferItems, setTransferItems] = useState<TransferOrderItemRow[]>([]);
  const [processing, setProcessing] = useState(false);

  // Create form state
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Array<{ productId: string; variantId?: string; quantity: number }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const allTransfers = await procurementService.findAllTransferOrders(statusFilter === 'all' ? undefined : statusFilter);
      setTransfers(allTransfers);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (transfer: TransferOrderRow) => {
    const items = await procurementService.findTransferOrderItems(transfer.id);
    setSelectedTransfer(transfer);
    setTransferItems(items);
    setView('detail');
  };

  const openCreate = () => {
    setFromLocation('');
    setToLocation('');
    setNotes('');
    setSelectedProducts([]);
    setView('create');
  };

  const handleCreate = async () => {
    if (!fromLocation.trim() || !toLocation.trim()) {
      Alert.alert('Validation Error', 'Please enter both from and to locations.');
      return;
    }
    if (selectedProducts.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one product to transfer.');
      return;
    }

    setProcessing(true);
    try {
      const items = selectedProducts.map(sp => {
        const product = products.find(p => p.id === sp.productId);
        return {
          productId: sp.productId,
          variantId: sp.variantId ?? null,
          productName: product?.name ?? 'Unknown Product',
          transferQty: sp.quantity,
        };
      });

      await procurementService.createTransferOrder({
        fromLocation,
        toLocation,
        notes: notes || null,
        items,
        createdBy: user?.id ?? null,
      });

      Alert.alert('Success', 'Transfer order created successfully.');
      load();
      setView('list');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create transfer order');
    } finally {
      setProcessing(false);
    }
  };

  const handleDispatch = async () => {
    if (!selectedTransfer) return;
    Alert.alert('Dispatch Transfer', 'Mark this transfer as dispatched? Inventory will be decremented at the source location.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dispatch',
        onPress: async () => {
          setProcessing(true);
          try {
            await procurementService.dispatchTransferOrder(selectedTransfer.id, platform, user?.id);
            Alert.alert('Success', 'Transfer order dispatched. Inventory decremented at source.');
            load();
            setView('list');
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to dispatch transfer');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const handleReceive = async () => {
    if (!selectedTransfer) return;
    Alert.alert('Receive Transfer', 'Confirm receipt of this transfer? Inventory will be incremented at the destination location.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Receive',
        onPress: async () => {
          setProcessing(true);
          try {
            await procurementService.receiveTransferOrder(selectedTransfer.id, platform, user?.id);
            Alert.alert('Success', 'Transfer order received. Inventory incremented at destination.');
            load();
            setView('list');
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to receive transfer');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const handleCancel = async () => {
    if (!selectedTransfer) return;
    Alert.alert('Cancel Transfer', 'Cancel this transfer order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Transfer',
        style: 'destructive',
        onPress: async () => {
          setProcessing(true);
          try {
            await procurementService.cancelTransferOrder(selectedTransfer.id, user?.id);
            Alert.alert('Success', 'Transfer order cancelled.');
            load();
            setView('list');
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to cancel transfer');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const addProduct = () => {
    if (products.length === 0) {
      Alert.alert('No Products', 'Please load products first.');
      return;
    }
    // Simple implementation: add first product with quantity 1
    // In production, this would be a product picker modal
    const firstProduct = products[0];
    setSelectedProducts([...selectedProducts, { productId: firstProduct.id, quantity: 1 }]);
  };

  const removeProduct = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, quantity: string) => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) return;
    const updated = [...selectedProducts];
    updated[index].quantity = qty;
    setSelectedProducts(updated);
  };

  // List view
  if (view === 'list') {
    const filteredTransfers = statusFilter === 'all' ? transfers : transfers.filter(t => t.status === statusFilter);

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Transfer Orders</Text>
          <TouchableOpacity onPress={openCreate} style={styles.createButton}>
            <MaterialIcons name="add" size={24} color={lightColors.surface} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {(['all', 'draft', 'in_transit', 'received', 'cancelled'] as StatusFilter[]).map(status => (
            <TouchableOpacity
              key={status}
              style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
              onPress={() => setStatusFilter(status)}
            >
              <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
                {status === 'all' ? 'All' : status.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={lightColors.primary} style={styles.loader} />
        ) : filteredTransfers.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="swap-horiz" size={64} color={lightColors.textHint} />
            <Text style={styles.emptyText}>No transfer orders found</Text>
          </View>
        ) : (
          <FlatList
            data={filteredTransfers}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>
                    {item.from_location} → {item.to_location}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>{item.status.replace('_', ' ')}</Text>
                  </View>
                </View>
                {item.notes && <Text style={styles.cardNotes}>{item.notes}</Text>}
                <Text style={styles.cardDate}>Created: {new Date(item.created_at).toLocaleDateString()}</Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    );
  }

  // Detail view
  if (view === 'detail' && selectedTransfer) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView('list')} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={lightColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Transfer Details</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>From:</Text>
              <Text style={styles.detailValue}>{selectedTransfer.from_location}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>To:</Text>
              <Text style={styles.detailValue}>{selectedTransfer.to_location}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status:</Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[selectedTransfer.status] + '20' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[selectedTransfer.status] }]}>
                  {selectedTransfer.status.replace('_', ' ')}
                </Text>
              </View>
            </View>
            {selectedTransfer.notes && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Notes:</Text>
                <Text style={styles.detailValue}>{selectedTransfer.notes}</Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Items</Text>
          {transferItems.map(item => (
            <View key={item.id} style={styles.itemCard}>
              <Text style={styles.itemName}>{item.product_name}</Text>
              <Text style={styles.itemQty}>Qty: {item.transfer_qty}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.actions}>
          {selectedTransfer.status === 'draft' && (
            <>
              <Button title="Dispatch" variant="primary" onPress={handleDispatch} loading={processing} disabled={processing} />
              <Button title="Cancel" variant="outline" onPress={handleCancel} disabled={processing} />
            </>
          )}
          {selectedTransfer.status === 'in_transit' && (
            <Button title="Receive" variant="success" onPress={handleReceive} loading={processing} disabled={processing} />
          )}
        </View>
      </View>
    );
  }

  // Create view
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setView('list')} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={lightColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>New Transfer</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.label}>From Location *</Text>
        <TextInput
          style={styles.input}
          value={fromLocation}
          onChangeText={setFromLocation}
          placeholder="e.g., Main Store"
          placeholderTextColor={lightColors.textHint}
        />

        <Text style={styles.label}>To Location *</Text>
        <TextInput
          style={styles.input}
          value={toLocation}
          onChangeText={setToLocation}
          placeholder="e.g., Warehouse"
          placeholderTextColor={lightColors.textHint}
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional notes"
          placeholderTextColor={lightColors.textHint}
          multiline
          numberOfLines={3}
        />

        <View style={styles.productsHeader}>
          <Text style={styles.sectionTitle}>Products *</Text>
          <TouchableOpacity onPress={addProduct} style={styles.addProductButton}>
            <MaterialIcons name="add" size={20} color={lightColors.primary} />
            <Text style={styles.addProductText}>Add Product</Text>
          </TouchableOpacity>
        </View>

        {selectedProducts.map((sp, index) => {
          const product = products.find(p => p.id === sp.productId);
          return (
            <View key={index} style={styles.productRow}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{product?.name ?? 'Unknown'}</Text>
                <TextInput
                  style={styles.qtyInput}
                  value={String(sp.quantity)}
                  onChangeText={val => updateQuantity(index, val)}
                  keyboardType="number-pad"
                  placeholder="Qty"
                />
              </View>
              <TouchableOpacity onPress={() => removeProduct(index)}>
                <MaterialIcons name="close" size={20} color={lightColors.error} />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.actions}>
        <Button title="Create Transfer" variant="primary" onPress={handleCreate} loading={processing} disabled={processing} fullWidth />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    width: 40,
  },
  headerSpacer: {
    width: 40,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: lightColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: lightColors.surface,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.round,
    backgroundColor: lightColors.inputBackground,
    marginRight: spacing.xs,
  },
  filterChipActive: {
    backgroundColor: lightColors.primary,
  },
  filterChipText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    textTransform: 'capitalize',
  },
  filterChipTextActive: {
    color: lightColors.surface,
    fontWeight: '600',
  },
  loader: {
    marginTop: spacing.xl,
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
  listContent: {
    padding: spacing.md,
  },
  card: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.low,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cardNotes: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.xs,
  },
  cardDate: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textHint,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  detailCard: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...elevation.low,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  detailLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.sm,
  },
  itemCard: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
    flex: 1,
  },
  itemQty: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  actions: {
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    backgroundColor: lightColors.surface,
    marginBottom: spacing.md,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  productsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  addProductButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  addProductText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.primary,
    fontWeight: '600',
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  productInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  productName: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
  },
  qtyInput: {
    width: 60,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
  },
});

export default TransferOrdersScreen;
