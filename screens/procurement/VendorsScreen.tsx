/**
 * VendorsScreen
 *
 * Lists all vendors with create/edit/delete actions.
 * Admin only.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../utils/theme';
import { Button } from '../../components/Button';
import { vendorService } from '../../services/procurement/VendorService';
import { VendorRow } from '../../repositories/ProcurementRepository';
import { useAuthContext } from '../../contexts/AuthProvider';

type ViewMode = 'list' | 'form';

const EMPTY_FORM = { name: '', contactName: '', email: '', phone: '', address: '', notes: '' };

const VendorsScreen: React.FC = () => {
  const { user } = useAuthContext();
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [editing, setEditing] = useState<VendorRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setVendors(await vendorService.findAll());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setView('form');
  };
  const openEdit = (v: VendorRow) => {
    setEditing(v);
    setForm({
      name: v.name,
      contactName: v.contact_name ?? '',
      email: v.email ?? '',
      phone: v.phone ?? '',
      address: v.address ?? '',
      notes: v.notes ?? '',
    });
    setView('form');
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await vendorService.update(
          editing.id,
          {
            name: form.name,
            contactName: form.contactName || null,
            email: form.email || null,
            phone: form.phone || null,
            address: form.address || null,
            notes: form.notes || null,
          },
          user?.id
        );
      } else {
        await vendorService.create(
          {
            name: form.name,
            contactName: form.contactName || null,
            email: form.email || null,
            phone: form.phone || null,
            address: form.address || null,
            notes: form.notes || null,
          },
          user?.id
        );
      }
      setView('list');
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (v: VendorRow) => {
    Alert.alert('Delete Vendor', `Delete "${v.name}"? Existing purchase orders will be preserved.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await vendorService.softDelete(v.id, user?.id);
          load();
        },
      },
    ]);
  };

  if (view === 'form') {
    const fields: Array<{ key: keyof typeof form; label: string; keyboard?: 'default' | 'email-address' | 'phone-pad' }> = [
      { key: 'name', label: 'Name *' },
      { key: 'contactName', label: 'Contact Name' },
      { key: 'email', label: 'Email', keyboard: 'email-address' },
      { key: 'phone', label: 'Phone', keyboard: 'phone-pad' },
      { key: 'address', label: 'Address' },
      { key: 'notes', label: 'Notes' },
    ];
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{editing ? 'Edit Vendor' : 'New Vendor'}</Text>
        {fields.map(f => (
          <View key={f.key} style={styles.fieldGroup}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput
              style={styles.input}
              value={form[f.key]}
              onChangeText={v => setForm(p => ({ ...p, [f.key]: v }))}
              keyboardType={f.keyboard ?? 'default'}
              autoCapitalize="none"
              placeholderTextColor={lightColors.textHint}
            />
          </View>
        ))}
        <View style={styles.formActions}>
          <Button title="Cancel" variant="outline" onPress={() => setView('list')} style={styles.actionBtn} />
          <Button
            title={saving ? 'Saving…' : 'Save'}
            variant="primary"
            onPress={handleSave}
            loading={saving}
            disabled={saving || !form.name.trim()}
            style={styles.actionBtn}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Vendors</Text>
        <Button title="+ Add" variant="primary" size="sm" onPress={openCreate} />
      </View>
      {loading ? (
        <ActivityIndicator style={styles.loader} color={lightColors.primary} />
      ) : vendors.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No vendors yet. Add your first supplier.</Text>
        </View>
      ) : (
        <FlatList
          data={vendors}
          keyExtractor={v => v.id}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.name}</Text>
                {item.contact_name ? <Text style={styles.cardMeta}>{item.contact_name}</Text> : null}
                {item.email ? <Text style={styles.cardMeta}>{item.email}</Text> : null}
                {item.phone ? <Text style={styles.cardMeta}>{item.phone}</Text> : null}
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
                  <MaterialIcons name="edit" size={20} color={lightColors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.iconBtn}>
                  <MaterialIcons name="delete-outline" size={20} color={lightColors.error} />
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: lightColors.background, padding: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: typography.fontSize.lg, fontWeight: '700', color: lightColors.textPrimary },
  list: { paddingBottom: spacing.xl },
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
  cardActions: { flexDirection: 'row', gap: spacing.xs },
  iconBtn: { padding: spacing.xs },
  fieldGroup: { marginBottom: spacing.sm },
  label: { fontSize: typography.fontSize.sm, fontWeight: '600', color: lightColors.textSecondary, marginBottom: spacing.xs },
  input: {
    backgroundColor: lightColors.surface,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  formActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { flex: 1 },
  loader: { marginTop: spacing.xl },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: typography.fontSize.sm, color: lightColors.textSecondary, textAlign: 'center' },
});

export default VendorsScreen;
