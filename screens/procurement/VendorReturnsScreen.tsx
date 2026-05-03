/**
 * VendorReturnsScreen
 *
 * Lists vendor returns with status filter. Supports create and confirm flows.
 * Manager/admin only.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../utils/theme';
import { Button } from '../../components/Button';
import { procurementService } from '../../services/procurement/ProcurementService';
import { vendorService } from '../../services/procurement/VendorService';
import {
  VendorReturnRow,
  VendorReturnItemRow,
  PurchaseOrderRow,
  PurchaseOrderItemRow,
  VendorRow,
} from '../../repositories/ProcurementRepository';
import { useAuthContext } from '../../contexts/AuthProvider';
import { useEcommerceSettings } from '../../hooks/useEcommerceSettings';
import { ECommercePlatform } from '../../utils/platforms';

type ViewMode = 'list' | 'detail' | 'create';
type StatusFilter = 'all' | 'pending' | 'confirmed' | 'cancelled';

const STATUS_COLORS: Record<string, string> = {
  pending: lightColors.warning,
  confirmed: lightColors.success,
  cancelled: lightColors.error,
};

const VendorReturnsScreen: React.FC = () => {
  const { user } = useAuthContext();
  const { ecommerceSettings } = useEcommerceSettings();
  const platform = (ecommerceSettings?.platform ?? 'offline') as ECommercePlatform;

  const [returns, setReturns] = useState<VendorReturnRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedReturn, setSelectedReturn] = useState<VendorReturnRow | null>(null);
  const [returnItems, setReturnItems] = useState<VendorReturnItemRow[]>([]);
  const [processing, setProcessing] = useState(false);

  // Create form state
  const [selectedPOId, setSelectedPOId] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [notes, setNotes] = useState('');
  const [poItems, setPoItems] = useState<PurchaseOrderItemRow[]>([]);
  const [returnQtys, setReturnQtys] = useState<Record<string, { qty: string; reason: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allReturns, allVendors, allPOs] = await Promise.all([
        procurementService.findAllVendorReturns(statusFilter === 'all' ? undefined : statusFilter),
        vendorService.findAll(),
        procurementService.findAllPOs('received'),
      ]);
      setReturns(allReturns);
      setVendors(allVendors);
      setPurchaseOrders(allPOs);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (vendorReturn: VendorReturnRow) => {
    const items = await procurementService.findVendorReturnItems(vendorReturn.id);
    setSelectedReturn(vendorReturn);
    setReturnItems(items);
    setView('detail');
  };

  const openCreate = () => {
    setSelectedPOId('');
    setSelectedVendorId('');
    setNotes('');
    setPoItems([]);
    setReturnQtys({});
    setView('create');
  };

  const handlePOSelect = async (poId: string) => {
    setSelectedPOId(poId);
    if (!poId) {
      setPoItems([]);
      setReturnQtys({});
      return;
    }

    const po = purchaseOrders.find(p => p.id === poId);
    if (po) {
      setSelectedVendorId(po.vendor_id ?? '');
      const items = await procurementService.findPOItems(poId);
      setPoItems(items);
      const qtys: Record<string, { qty: string; reason: string }> = {};
      items.forEach(item => {
        qtys[item.id] = { qty: '', reason: '' };
      });
      setReturnQtys(qtys);
    }
  };

  const handleCreate = async () => {
    if (!selectedPOId || !selectedVendorId) {
      Alert.alert('Validation Error', 'Please select a purchase order.');
      return;
    }

    const itemsToReturn = Object.entries(returnQtys)
      .filter(([_, data]) => parseInt(data.qty, 10) > 0)
      .map(([itemId, data]) => {
        const poItem = poItems.find(i => i.id === itemId);
        return {
          poItemId: itemId,
          productId: poItem!.product_id,
          variantId: poItem!.variant_id ?? null,
          productName: poItem!.product_name,
          returnQty: parseInt(data.qty, 10),
          reason: data.reason || null,
        };
      });

    if (itemsToReturn.length === 0) {
      Alert.alert('Validation Error', 'Please enter at least one return quantity.');
      return;
    }

    setProcessing(true);
    try {
      await procurementService.createVendorReturn({
        purchaseOrderId: selectedPOId,
        vendorId: selectedVendorId,
        notes: notes || null,
        items: itemsToReturn,
        createdBy: user?.id ?? null,
      });

      Alert.alert('Success', 'Vendor return created successfully.');
      load();
      setView('list');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create vendor return');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedReturn) return;
    Alert.alert('Confirm Return', 'Confirm this vendor return? Inventory will be decremented for all returned items.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setProcessing(true);
          try {
            await procurementService.confirmVendorReturn(selectedReturn.id, platform, user?.id);
            Alert.alert('Success', 'Vendor return confirmed. Inventory decremented.');
            load();
            setView('list');
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to confirm return');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const handleCancel = async () => {
    if (!selectedReturn) return;
    Alert.alert('Cancel Return', 'Cancel this vendor return?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Return',
        style: 'destructive',
        onPress: async () => {
          setProcessing(true);
          try {
            await procurementService.cancelVendorReturn(selectedReturn.id, user?.id);
            Alert.alert('Success', 'Vendor return cancelled.');
            load();
            setView('list');
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to cancel return');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const updateReturnQty = (itemId: string, field: 'qty' | 'reason', value: string) => {
    setReturnQtys(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  // List view
  if (view === 'list') {
    const filteredReturns = statusFilter === 'all' ? returns : returns.filter(r => r.status === statusFilter);

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Vendor Returns</Text>
          <TouchableOpacity onPress={openCreate} style={styles.createButton}>
            <MaterialIcons name="add" size={24} color={lightColors.surface} />
          </TouchableOpacity>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {(['all', 'pending', 'confirmed', 'cancelled'] as StatusFilter[]).map(status => (
            <TouchableOpacity
              key={status}
              style={[styles.filterChip, statusFilter === status && styles.filterChipActive]}
              onPress={() => setStatusFilter(status)}
            >
              <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
                {status === 'all' ? 'All' : status}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator size="large" color={lightColors.primary} style={styles.loader} />
        ) : filteredReturns.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="assignment-return" size={64} color={lightColors.textHint} />
            <Text style={styles.emptyText}>No vendor returns found</Text>
          </View>
        ) : (
          <FlatList
            data={filteredReturns}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const vendor = vendors.find(v => v.id === item.vendor_id);
              return (
                <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{vendor?.name ?? 'Unknown Vendor'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
                      <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>{item.status}</Text>
                    </View>
                  </View>
                  {item.notes && <Text style={styles.cardNotes}>{item.notes}</Text>}
                  <Text style={styles.cardDate}>Created: {new Date(item.created_at).toLocaleDateString()}</Text>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.listContent}
          />
        )}
      </View>
    );
  }

  // Detail view
  if (view === 'detail' && selectedReturn) {
    const vendor = vendors.find(v => v.id === selectedReturn.vendor_id);

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView('list')} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={lightColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Return Details</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Vendor:</Text>
              <Text style={styles.detailValue}>{vendor?.name ?? 'Unknown'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status:</Text>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[selectedReturn.status] + '20' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[selectedReturn.status] }]}>{selectedReturn.status}</Text>
              </View>
            </View>
            {selectedReturn.notes && (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Notes:</Text>
                <Text style={styles.detailValue}>{selectedReturn.notes}</Text>
              </View>
            )}
          </View>

          <Text style={styles.sectionTitle}>Items</Text>
          {returnItems.map(item => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                {item.reason && <Text style={styles.itemReason}>Reason: {item.reason}</Text>}
              </View>
              <Text style={styles.itemQty}>Qty: {item.return_qty}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.actions}>
          {selectedReturn.status === 'pending' && (
            <>
              <Button title="Confirm Return" variant="success" onPress={handleConfirm} loading={processing} disabled={processing} />
              <Button title="Cancel" variant="outline" onPress={handleCancel} disabled={processing} />
            </>
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
        <Text style={styles.title}>New Vendor Return</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.label}>Purchase Order *</Text>
        <View style={styles.pickerContainer}>
          <TouchableOpacity
            style={styles.picker}
            onPress={() => {
              Alert.alert('Select Purchase Order', 'Choose a received purchase order', [
                ...purchaseOrders.map(po => ({
                  text: `PO ${po.id.slice(-8)} - ${vendors.find(v => v.id === po.vendor_id)?.name ?? 'Unknown'}`,
                  onPress: () => handlePOSelect(po.id),
                })),
                { text: 'Cancel', style: 'cancel' as const },
              ]);
            }}
          >
            <Text style={selectedPOId ? styles.pickerText : styles.pickerPlaceholder}>
              {selectedPOId
                ? `PO ${selectedPOId.slice(-8)} - ${vendors.find(v => v.id === selectedVendorId)?.name ?? 'Unknown'}`
                : 'Select a purchase order'}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={24} color={lightColors.textSecondary} />
          </TouchableOpacity>
        </View>

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

        {poItems.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Items to Return</Text>
            {poItems.map(item => (
              <View key={item.id} style={styles.returnItemCard}>
                <View style={styles.returnItemInfo}>
                  <Text style={styles.returnItemName}>{item.product_name}</Text>
                  <Text style={styles.returnItemReceived}>Received: {item.received_qty}</Text>
                </View>
                <View style={styles.returnItemInputs}>
                  <TextInput
                    style={styles.qtyInput}
                    value={returnQtys[item.id]?.qty ?? ''}
                    onChangeText={val => updateReturnQty(item.id, 'qty', val)}
                    placeholder="Qty"
                    keyboardType="number-pad"
                    placeholderTextColor={lightColors.textHint}
                  />
                  <TextInput
                    style={styles.reasonInput}
                    value={returnQtys[item.id]?.reason ?? ''}
                    onChangeText={val => updateReturnQty(item.id, 'reason', val)}
                    placeholder="Reason (optional)"
                    placeholderTextColor={lightColors.textHint}
                  />
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={styles.actions}>
        <Button
          title="Create Return"
          variant="primary"
          onPress={handleCreate}
          loading={processing}
          disabled={processing || !selectedPOId}
          fullWidth
        />
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
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
    marginBottom: 2,
  },
  itemReason: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    fontStyle: 'italic',
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
  pickerContainer: {
    marginBottom: spacing.md,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    backgroundColor: lightColors.surface,
  },
  pickerText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  pickerPlaceholder: {
    fontSize: typography.fontSize.md,
    color: lightColors.textHint,
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
  returnItemCard: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  returnItemInfo: {
    marginBottom: spacing.xs,
  },
  returnItemName: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: 2,
  },
  returnItemReceived: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  returnItemInputs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  qtyInput: {
    width: 80,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
    backgroundColor: lightColors.inputBackground,
  },
  reasonInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
    fontSize: typography.fontSize.sm,
    backgroundColor: lightColors.inputBackground,
  },
});

export default VendorReturnsScreen;
