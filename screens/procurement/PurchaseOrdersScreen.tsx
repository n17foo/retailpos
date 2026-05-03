/**
 * PurchaseOrdersScreen
 *
 * Lists purchase orders with status filter. Supports create, submit,
 * receive, and cancel flows. Manager/admin only.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../utils/theme';
import { Button } from '../../components/Button';
import { formatMoney } from '../../utils/money';
import { useCurrency } from '../../hooks/useCurrency';
import { procurementService } from '../../services/procurement/ProcurementService';
import { vendorService } from '../../services/procurement/VendorService';
import { PurchaseOrderRow, PurchaseOrderItemRow, VendorRow } from '../../repositories/ProcurementRepository';
import { useAuthContext } from '../../contexts/AuthProvider';
import { useEcommerceSettings } from '../../hooks/useEcommerceSettings';
import { ECommercePlatform } from '../../utils/platforms';

type ViewMode = 'list' | 'detail' | 'receive';

const STATUS_COLORS: Record<string, string> = {
  draft: lightColors.textSecondary,
  ordered: lightColors.info,
  partially_received: lightColors.warning,
  received: lightColors.success,
  cancelled: lightColors.error,
};

const PurchaseOrdersScreen: React.FC = () => {
  const { user } = useAuthContext();
  const currency = useCurrency();
  const { ecommerceSettings } = useEcommerceSettings();
  const platform = (ecommerceSettings?.platform ?? 'offline') as ECommercePlatform;

  const [pos, setPos] = useState<PurchaseOrderRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrderRow | null>(null);
  const [poItems, setPoItems] = useState<PurchaseOrderItemRow[]>([]);
  const [receiveQtys, setReceiveQtys] = useState<Record<string, string>>({});
  const [receiving, setReceiving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allPos, allVendors] = await Promise.all([procurementService.findAllPOs(), vendorService.findAll()]);
      setPos(allPos);
      setVendors(allVendors);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (po: PurchaseOrderRow) => {
    const items = await procurementService.findPOItems(po.id);
    setSelectedPO(po);
    setPoItems(items);
    setView('detail');
  };

  const openReceive = () => {
    const defaults: Record<string, string> = {};
    poItems.forEach(i => {
      defaults[i.id] = String(Math.max(0, i.ordered_qty - i.received_qty));
    });
    setReceiveQtys(defaults);
    setView('receive');
  };

  const handleSubmit = async () => {
    if (!selectedPO) return;
    Alert.alert('Submit PO', 'Mark this purchase order as submitted to the vendor?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit',
        onPress: async () => {
          await procurementService.submitPO(selectedPO.id, user?.id);
          load();
          setView('list');
        },
      },
    ]);
  };

  const handleCancel = async () => {
    if (!selectedPO) return;
    Alert.alert('Cancel PO', 'Cancel this purchase order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel PO',
        style: 'destructive',
        onPress: async () => {
          await procurementService.cancelPO(selectedPO.id, user?.id);
          load();
          setView('list');
        },
      },
    ]);
  };

  const handleReceive = async () => {
    if (!selectedPO) return;
    setReceiving(true);
    try {
      const lines = poItems.map(i => ({ itemId: i.id, receiveNow: parseInt(receiveQtys[i.id] ?? '0', 10) || 0 }));
      const result = await procurementService.receivePO(selectedPO.id, lines, platform, user?.id);
      if (result.success) {
        Alert.alert('Received', `Status updated to: ${result.newStatus.replace('_', ' ')}`);
        load();
        setView('list');
      } else {
        Alert.alert('Error', result.error ?? 'Receiving failed');
      }
    } finally {
      setReceiving(false);
    }
  };

  const vendorName = (vendorId: string | null) => vendors.find(v => v.id === vendorId)?.name ?? '(no vendor)';

  // ── Receive view ──────────────────────────────────────────────────────
  if (view === 'receive' && selectedPO) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Receive Goods</Text>
        <Text style={styles.subtitle}>
          PO #{selectedPO.id.slice(-8)} · {vendorName(selectedPO.vendor_id)}
        </Text>
        {poItems.map(item => (
          <View key={item.id} style={styles.receiveRow}>
            <View style={styles.receiveInfo}>
              <Text style={styles.itemName}>{item.product_name}</Text>
              <Text style={styles.itemMeta}>
                Ordered: {item.ordered_qty} · Received: {item.received_qty}
              </Text>
            </View>
            <TextInput
              style={styles.qtyInput}
              value={receiveQtys[item.id] ?? '0'}
              onChangeText={v => setReceiveQtys(p => ({ ...p, [item.id]: v }))}
              keyboardType="number-pad"
              selectTextOnFocus
            />
          </View>
        ))}
        <View style={styles.formActions}>
          <Button title="Back" variant="outline" onPress={() => setView('detail')} style={styles.actionBtn} />
          <Button
            title={receiving ? 'Saving…' : 'Confirm Receipt'}
            variant="primary"
            onPress={handleReceive}
            loading={receiving}
            style={styles.actionBtn}
          />
        </View>
      </ScrollView>
    );
  }

  // ── Detail view ───────────────────────────────────────────────────────
  if (view === 'detail' && selectedPO) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => setView('list')} style={styles.backRow}>
          <MaterialIcons name="arrow-back" size={20} color={lightColors.primary} />
          <Text style={styles.backText}>Purchase Orders</Text>
        </TouchableOpacity>
        <Text style={styles.title}>PO #{selectedPO.id.slice(-8)}</Text>
        <Text style={styles.subtitle}>{vendorName(selectedPO.vendor_id)}</Text>
        <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[selectedPO.status] ?? lightColors.textSecondary) + '20' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[selectedPO.status] ?? lightColors.textSecondary }]}>
            {selectedPO.status.replace('_', ' ').toUpperCase()}
          </Text>
        </View>
        {poItems.map(item => (
          <View key={item.id} style={styles.lineRow}>
            <View style={styles.lineInfo}>
              <Text style={styles.itemName}>{item.product_name}</Text>
              <Text style={styles.itemMeta}>
                Ordered: {item.ordered_qty} · Received: {item.received_qty} · Cost: {formatMoney(item.unit_cost, currency.code)}
              </Text>
            </View>
          </View>
        ))}
        <View style={styles.formActions}>
          {selectedPO.status === 'draft' && (
            <>
              <Button title="Submit" variant="primary" onPress={handleSubmit} style={styles.actionBtn} />
              <Button title="Cancel PO" variant="outline" onPress={handleCancel} style={styles.actionBtn} />
            </>
          )}
          {(selectedPO.status === 'ordered' || selectedPO.status === 'partially_received') && (
            <>
              <Button title="Receive Goods" variant="primary" onPress={openReceive} style={styles.actionBtn} />
              <Button title="Cancel PO" variant="outline" onPress={handleCancel} style={styles.actionBtn} />
            </>
          )}
        </View>
      </ScrollView>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Purchase Orders</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={styles.loader} color={lightColors.primary} />
      ) : pos.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No purchase orders yet.</Text>
        </View>
      ) : (
        <FlatList
          data={pos}
          keyExtractor={p => p.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => openDetail(item)}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>PO #{item.id.slice(-8)}</Text>
                <Text style={styles.cardMeta}>{vendorName(item.vendor_id)}</Text>
                {item.expected_date ? (
                  <Text style={styles.cardMeta}>Expected: {new Date(item.expected_date).toLocaleDateString()}</Text>
                ) : null}
              </View>
              <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[item.status] ?? lightColors.textSecondary) + '20' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] ?? lightColors.textSecondary }]}>
                  {item.status.replace('_', ' ')}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={lightColors.textSecondary} />
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: lightColors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  title: { fontSize: typography.fontSize.lg, fontWeight: '700', color: lightColors.textPrimary, marginBottom: spacing.xs },
  subtitle: { fontSize: typography.fontSize.sm, color: lightColors.textSecondary, marginBottom: spacing.sm },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...elevation.low,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: typography.fontSize.md, fontWeight: '600', color: lightColors.textPrimary },
  cardMeta: { fontSize: typography.fontSize.sm, color: lightColors.textSecondary, marginTop: 2 },
  statusBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm, marginRight: spacing.sm },
  statusText: { fontSize: typography.fontSize.xs, fontWeight: '600' },
  lineRow: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  lineInfo: { flex: 1 },
  itemName: { fontSize: typography.fontSize.sm, fontWeight: '600', color: lightColors.textPrimary },
  itemMeta: { fontSize: typography.fontSize.xs, color: lightColors.textSecondary, marginTop: 2 },
  receiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  receiveInfo: { flex: 1 },
  qtyInput: {
    width: 64,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    textAlign: 'center',
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    backgroundColor: lightColors.inputBackground,
  },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { flex: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  backText: { fontSize: typography.fontSize.sm, color: lightColors.primary },
  loader: { marginTop: spacing.xl },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyText: { fontSize: typography.fontSize.sm, color: lightColors.textSecondary, textAlign: 'center' },
});

export default PurchaseOrdersScreen;
