/**
 * InventoryCountScreen
 *
 * Start a stock-take, enter counted quantities, finalise or discard.
 * Manager/admin only.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../utils/theme';
import { Button } from '../../components/Button';
import { inventoryCountService } from '../../services/procurement/InventoryCountService';
import { InventoryCountRow, InventoryCountItemRow } from '../../repositories/ProcurementRepository';
import { useAuthContext } from '../../contexts/AuthProvider';
import { useEcommerceSettings } from '../../hooks/useEcommerceSettings';
import { ECommercePlatform } from '../../utils/platforms';

type ViewMode = 'list' | 'active';

const InventoryCountScreen: React.FC = () => {
  const { user } = useAuthContext();
  const { ecommerceSettings } = useEcommerceSettings();
  const platform = (ecommerceSettings?.platform ?? 'offline') as ECommercePlatform;

  const [counts, setCounts] = useState<InventoryCountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [activeCount, setActiveCount] = useState<InventoryCountRow | null>(null);
  const [countItems, setCountItems] = useState<InventoryCountItemRow[]>([]);
  const [countedQtys, setCountedQtys] = useState<Record<string, string>>({});
  const [finalising, setFinalising] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCounts(await inventoryCountService.findAllCounts());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCount = async (count: InventoryCountRow) => {
    const items = await inventoryCountService.findCountItems(count.id);
    const qtys: Record<string, string> = {};
    items.forEach(i => {
      qtys[i.id] = i.counted_qty !== null ? String(i.counted_qty) : '';
    });
    setActiveCount(count);
    setCountItems(items);
    setCountedQtys(qtys);
    setView('active');
  };

  const handleUpdateQty = async (itemId: string, value: string) => {
    setCountedQtys(p => ({ ...p, [itemId]: value }));
    const qty = parseInt(value, 10);
    if (!isNaN(qty) && qty >= 0) {
      await inventoryCountService.updateCountedQty(itemId, qty);
    }
  };

  const handleFinalise = async () => {
    if (!activeCount) return;
    Alert.alert('Finalise Count', 'Apply all counted quantities to inventory? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Finalise',
        onPress: async () => {
          setFinalising(true);
          try {
            const result = await inventoryCountService.finaliseCount(activeCount.id, platform, user?.id);
            if (result.success) {
              Alert.alert('Count Complete', `${result.adjustedLines} adjustment(s) applied. Total variance: ${result.totalVariance}`);
              load();
              setView('list');
            } else {
              Alert.alert('Error', result.error ?? 'Finalise failed');
            }
          } finally {
            setFinalising(false);
          }
        },
      },
    ]);
  };

  const handleDiscard = async () => {
    if (!activeCount) return;
    Alert.alert('Discard Count', 'Discard this count? No inventory changes will be made.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await inventoryCountService.discardCount(activeCount.id);
          load();
          setView('list');
        },
      },
    ]);
  };

  // ── Active count view ─────────────────────────────────────────────────
  if (view === 'active' && activeCount) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setView('list')} style={styles.backRow}>
            <MaterialIcons name="arrow-back" size={20} color={lightColors.primary} />
            <Text style={styles.backText}>Counts</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Stock Take</Text>
        </View>
        <FlatList
          data={countItems}
          keyExtractor={i => i.id}
          renderItem={({ item }) => (
            <View style={styles.countRow}>
              <View style={styles.countInfo}>
                <Text style={styles.itemName}>{item.product_name}</Text>
                {item.sku ? <Text style={styles.itemMeta}>SKU: {item.sku}</Text> : null}
                <Text style={styles.itemMeta}>Expected: {item.expected_qty}</Text>
              </View>
              <TextInput
                style={[
                  styles.qtyInput,
                  countedQtys[item.id] !== '' && parseInt(countedQtys[item.id], 10) !== item.expected_qty && styles.qtyVariance,
                ]}
                value={countedQtys[item.id] ?? ''}
                onChangeText={v => handleUpdateQty(item.id, v)}
                keyboardType="number-pad"
                placeholder="—"
                placeholderTextColor={lightColors.textHint}
                selectTextOnFocus
              />
            </View>
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        />
        <View style={styles.footer}>
          <Button title="Discard" variant="outline" onPress={handleDiscard} style={styles.actionBtn} />
          <Button
            title={finalising ? 'Finalising…' : 'Finalise Count'}
            variant="primary"
            onPress={handleFinalise}
            loading={finalising}
            style={styles.actionBtn}
          />
        </View>
      </View>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Inventory Counts</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={styles.loader} color={lightColors.primary} />
      ) : counts.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No inventory counts yet.</Text>
          <Text style={styles.emptyHint}>Start a count from the Inventory screen.</Text>
        </View>
      ) : (
        <FlatList
          data={counts}
          keyExtractor={c => c.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => (item.status === 'in_progress' ? openCount(item) : undefined)}
              disabled={item.status !== 'in_progress'}
            >
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>Count #{item.id.slice(-8)}</Text>
                <Text style={styles.cardMeta}>{new Date(item.started_at).toLocaleDateString()}</Text>
                {item.completed_at ? (
                  <Text style={styles.cardMeta}>Completed: {new Date(item.completed_at).toLocaleDateString()}</Text>
                ) : null}
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      item.status === 'completed'
                        ? lightColors.success + '20'
                        : item.status === 'in_progress'
                          ? lightColors.warning + '20'
                          : lightColors.error + '20',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        item.status === 'completed'
                          ? lightColors.success
                          : item.status === 'in_progress'
                            ? lightColors.warning
                            : lightColors.error,
                    },
                  ]}
                >
                  {item.status.replace('_', ' ')}
                </Text>
              </View>
              {item.status === 'in_progress' && <MaterialIcons name="chevron-right" size={20} color={lightColors.textSecondary} />}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  title: { fontSize: typography.fontSize.lg, fontWeight: '700', color: lightColors.textPrimary },
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
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  countInfo: { flex: 1 },
  itemName: { fontSize: typography.fontSize.sm, fontWeight: '600', color: lightColors.textPrimary },
  itemMeta: { fontSize: typography.fontSize.xs, color: lightColors.textSecondary, marginTop: 2 },
  qtyInput: {
    width: 72,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    textAlign: 'center',
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    backgroundColor: lightColors.inputBackground,
  },
  qtyVariance: { borderColor: lightColors.warning, backgroundColor: lightColors.warning + '10' },
  footer: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: lightColors.border },
  actionBtn: { flex: 1 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  backText: { fontSize: typography.fontSize.sm, color: lightColors.primary },
  loader: { marginTop: spacing.xl },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  emptyText: { fontSize: typography.fontSize.sm, color: lightColors.textSecondary, textAlign: 'center' },
  emptyHint: { fontSize: typography.fontSize.xs, color: lightColors.textHint, textAlign: 'center', marginTop: spacing.xs },
});

export default InventoryCountScreen;
