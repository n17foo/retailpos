/**
 * CustomerProfileScreen
 *
 * Shows a local customer's profile: purchase history, loyalty balance,
 * store credit balance, and editable fields (name, phone, notes, segment).
 *
 * Accessible from the More menu (manager/admin only).
 * Also reachable from the basket customer badge (read-only for cashiers).
 *
 * See: docs/specs/customer/crm-loyalty.md §2.2
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../../shared/utils/theme';
import { Button } from '../../../shared/components/Button';
import { formatMoney } from '../../../shared/utils/money';
import { useCurrency } from '../../platform-clients/hooks/useCurrency';
import { useCustomerProfile } from '../hooks/useCustomerProfile';
import { localCustomerService } from '../services/customer/LocalCustomerService';
import { loyaltyService } from '../services/loyalty/LoyaltyService';
import { storeCreditService } from '../services/customer/StoreCreditService';
import { useAuthContext } from '../../authentication/contexts/AuthProvider';
import type { MoreStackScreenProps } from '../../../app/navigation/types';

type Props = MoreStackScreenProps<'CustomerProfile'>;

const CustomerProfileScreen: React.FC = () => {
  const route = useRoute<Props['route']>();
  const { user } = useAuthContext();
  const currency = useCurrency();

  const { email } = route.params;
  const { customer, orderHistory, loyaltyBalance, storeCreditDollars, isLoading, reload } = useCustomerProfile(email);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSegment, setEditSegment] = useState('');
  const [saving, setSaving] = useState(false);

  // Loyalty adjustment
  const [showLoyaltyAdj, setShowLoyaltyAdj] = useState(false);
  const [loyaltyDelta, setLoyaltyDelta] = useState('');
  const [loyaltyReason, setLoyaltyReason] = useState('');

  // Store credit issue
  const [showCreditIssue, setShowCreditIssue] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  const startEdit = () => {
    setEditName(customer?.name ?? '');
    setEditPhone(customer?.phone ?? '');
    setEditNotes(customer?.notes ?? '');
    setEditSegment(customer?.segment ?? '');
    setEditing(true);
  };

  const saveEdit = async () => {
    if (!customer) return;
    setSaving(true);
    try {
      await localCustomerService.update(
        customer.id,
        {
          name: editName || null,
          phone: editPhone || null,
          notes: editNotes || null,
          segment: editSegment || null,
        },
        user?.id
      );
      setEditing(false);
      reload();
    } finally {
      setSaving(false);
    }
  };

  const handleLoyaltyAdjust = async () => {
    const delta = parseInt(loyaltyDelta, 10);
    if (isNaN(delta) || delta === 0 || !loyaltyReason.trim()) return;
    await loyaltyService.adjustPoints(email, delta, loyaltyReason.trim(), user?.id);
    setShowLoyaltyAdj(false);
    setLoyaltyDelta('');
    setLoyaltyReason('');
    reload();
  };

  const handleCreditIssue = async () => {
    const amount = parseFloat(creditAmount);
    if (isNaN(amount) || amount <= 0 || !creditReason.trim()) return;
    const amountCents = Math.round(amount * 100);
    await storeCreditService.issue(email, amountCents, creditReason.trim(), user?.id);
    setShowCreditIssue(false);
    setCreditAmount('');
    setCreditReason('');
    reload();
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={lightColors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile header */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(customer?.name?.[0] || email[0] || '?').toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
          {editing ? (
            <>
              <TextInput style={styles.editInput} value={editName} onChangeText={setEditName} placeholder="Name" />
              <TextInput
                style={styles.editInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Phone"
                keyboardType="phone-pad"
              />
              <TextInput style={styles.editInput} value={editSegment} onChangeText={setEditSegment} placeholder="Segment tag" />
              <TextInput
                style={[styles.editInput, styles.editInputMulti]}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="Notes"
                multiline
                numberOfLines={2}
              />
              <View style={styles.editActions}>
                <Button title="Cancel" variant="outline" size="sm" onPress={() => setEditing(false)} style={styles.editBtn} />
                <Button
                  title={saving ? 'Saving…' : 'Save'}
                  variant="primary"
                  size="sm"
                  onPress={saveEdit}
                  loading={saving}
                  style={styles.editBtn}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.profileName}>{customer?.name || '(no name)'}</Text>
              <Text style={styles.profileEmail}>{email}</Text>
              {customer?.phone ? <Text style={styles.profileMeta}>{customer.phone}</Text> : null}
              {customer?.segment ? (
                <View style={styles.segmentTag}>
                  <Text style={styles.segmentText}>{customer.segment}</Text>
                </View>
              ) : null}
              {customer?.notes ? <Text style={styles.profileNotes}>{customer.notes}</Text> : null}
              <TouchableOpacity onPress={startEdit} style={styles.editLink}>
                <MaterialIcons name="edit" size={14} color={lightColors.primary} />
                <Text style={styles.editLinkText}>Edit profile</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{customer?.totalOrders ?? 0}</Text>
          <Text style={styles.statLabel}>Orders</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatMoney(customer?.totalSpend ?? 0, currency.code)}</Text>
          <Text style={styles.statLabel}>Total Spent</Text>
        </View>
      </View>

      {/* Loyalty */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Loyalty Points</Text>
          <TouchableOpacity onPress={() => setShowLoyaltyAdj(v => !v)}>
            <Text style={styles.actionLink}>Adjust</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.balanceValue}>{loyaltyBalance?.points ?? 0} pts</Text>
        <Text style={styles.balanceSub}>≈ {formatMoney((loyaltyBalance?.valueInCents ?? 0) / 100, currency.code)} value</Text>
        {loyaltyBalance?.tier ? <Text style={styles.tier}>Tier: {loyaltyBalance.tier}</Text> : null}

        {showLoyaltyAdj && (
          <View style={styles.adjForm}>
            <TextInput
              style={styles.editInput}
              value={loyaltyDelta}
              onChangeText={setLoyaltyDelta}
              placeholder="Points (e.g. 50 or -20)"
              keyboardType="numbers-and-punctuation"
            />
            <TextInput style={styles.editInput} value={loyaltyReason} onChangeText={setLoyaltyReason} placeholder="Reason" />
            <Button
              title="Apply Adjustment"
              variant="primary"
              size="sm"
              onPress={handleLoyaltyAdjust}
              disabled={!loyaltyDelta || !loyaltyReason}
            />
          </View>
        )}
      </View>

      {/* Store Credit */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Store Credit</Text>
          <TouchableOpacity onPress={() => setShowCreditIssue(v => !v)}>
            <Text style={styles.actionLink}>Issue</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.balanceValue}>{formatMoney(storeCreditDollars, currency.code)}</Text>

        {showCreditIssue && (
          <View style={styles.adjForm}>
            <TextInput
              style={styles.editInput}
              value={creditAmount}
              onChangeText={setCreditAmount}
              placeholder="Amount (e.g. 10.00)"
              keyboardType="decimal-pad"
            />
            <TextInput style={styles.editInput} value={creditReason} onChangeText={setCreditReason} placeholder="Reason" />
            <Button
              title="Issue Credit"
              variant="primary"
              size="sm"
              onPress={handleCreditIssue}
              disabled={!creditAmount || !creditReason}
            />
          </View>
        )}
      </View>

      {/* Order history */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Orders</Text>
        {orderHistory.length === 0 ? (
          <Text style={styles.emptyText}>No orders yet</Text>
        ) : (
          orderHistory.map(order => (
            <View key={order.orderId} style={styles.orderRow}>
              <View style={styles.orderInfo}>
                <Text style={styles.orderId}>#{order.orderId.slice(-8)}</Text>
                <Text style={styles.orderMeta}>
                  {new Date(order.createdAt).toLocaleDateString()} · {order.status}
                </Text>
                <Text style={styles.orderItems}>{order.items.map(i => `${i.name} ×${i.quantity}`).join(', ')}</Text>
              </View>
              <Text style={styles.orderTotal}>{formatMoney(order.total, currency.code)}</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: lightColors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  profileCard: {
    flexDirection: 'row',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...elevation.low,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: lightColors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: { fontSize: 24, fontWeight: '700', color: lightColors.primary },
  profileInfo: { flex: 1 },
  profileName: { fontSize: typography.fontSize.lg, fontWeight: '700', color: lightColors.textPrimary },
  profileEmail: { fontSize: typography.fontSize.sm, color: lightColors.textSecondary, marginTop: 2 },
  profileMeta: { fontSize: typography.fontSize.sm, color: lightColors.textSecondary, marginTop: 2 },
  profileNotes: { fontSize: typography.fontSize.sm, color: lightColors.textHint, marginTop: spacing.xs, fontStyle: 'italic' },
  segmentTag: {
    alignSelf: 'flex-start',
    backgroundColor: lightColors.primary + '15',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  segmentText: { fontSize: typography.fontSize.xs, color: lightColors.primary, fontWeight: '600' },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs },
  editLinkText: { fontSize: typography.fontSize.sm, color: lightColors.primary },
  editInput: {
    backgroundColor: lightColors.inputBackground,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  editInputMulti: { minHeight: 48, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  editBtn: { flex: 1 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    ...elevation.low,
  },
  statValue: { fontSize: typography.fontSize.xl, fontWeight: '700', color: lightColors.textPrimary },
  statLabel: { fontSize: typography.fontSize.xs, color: lightColors.textSecondary, marginTop: 2 },
  section: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...elevation.low,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle: { fontSize: typography.fontSize.md, fontWeight: '700', color: lightColors.textPrimary },
  actionLink: { fontSize: typography.fontSize.sm, color: lightColors.primary, fontWeight: '600' },
  balanceValue: { fontSize: typography.fontSize.xxl ?? 28, fontWeight: '800', color: lightColors.textPrimary },
  balanceSub: { fontSize: typography.fontSize.sm, color: lightColors.textSecondary, marginTop: 2 },
  tier: { fontSize: typography.fontSize.sm, color: lightColors.primary, fontWeight: '600', marginTop: spacing.xs },
  adjForm: { marginTop: spacing.sm, gap: spacing.xs },
  orderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
  },
  orderInfo: { flex: 1 },
  orderId: { fontSize: typography.fontSize.sm, fontWeight: '600', color: lightColors.textPrimary },
  orderMeta: { fontSize: typography.fontSize.xs, color: lightColors.textSecondary, marginTop: 2 },
  orderItems: { fontSize: typography.fontSize.xs, color: lightColors.textHint, marginTop: 2 },
  orderTotal: { fontSize: typography.fontSize.md, fontWeight: '700', color: lightColors.textPrimary },
  emptyText: { fontSize: typography.fontSize.sm, color: lightColors.textSecondary, textAlign: 'center', paddingVertical: spacing.md },
});

export default CustomerProfileScreen;
