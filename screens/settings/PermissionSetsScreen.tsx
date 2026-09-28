/**
 * PermissionSetsScreen
 *
 * Admin-only screen for managing custom permission sets.
 * Accessible from Settings → User Management → Permission Sets.
 *
 * See: docs/specs/auth/permissions.md §2.3
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../utils/theme';
import { Button } from '../../components/Button';
import { permissionRepository, PermissionSet } from '../../repositories/PermissionRepository';
import { auditLogService } from '../../services/audit/AuditLogService';
import { permissionService } from '../../services/permissions/PermissionService';
import { ACTION_REGISTRY } from '../../utils/actionRegistry';
import { useAuthContext } from '../../contexts/AuthProvider';

type ScreenView = 'list' | 'edit';

interface SetWithCount extends PermissionSet {
  userCount: number;
}

const PermissionSetsScreen: React.FC = () => {
  const { user } = useAuthContext();
  const [view, setView] = useState<ScreenView>('list');
  const [sets, setSets] = useState<SetWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editingSet, setEditingSet] = useState<PermissionSet | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [overrides, setOverrides] = useState<Map<string, boolean | null>>(new Map());
  const [saving, setSaving] = useState(false);

  const loadSets = useCallback(async () => {
    setLoading(true);
    try {
      const all = await permissionRepository.findAllSets();
      const withCounts = await Promise.all(
        all.map(async s => ({
          ...s,
          userCount: await permissionRepository.countUsersForSet(s.id),
        }))
      );
      setSets(withCounts);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSets();
  }, [loadSets]);

  const handleCreate = () => {
    setEditingSet(null);
    setEditName('');
    setEditDescription('');
    setOverrides(new Map());
    setView('edit');
  };

  const handleEdit = async (set: PermissionSet) => {
    const existingOverrides = await permissionRepository.findOverridesForSet(set.id);
    const map = new Map<string, boolean | null>();
    for (const o of existingOverrides) {
      map.set(o.actionKey, o.granted);
    }
    setEditingSet(set);
    setEditName(set.name);
    setEditDescription(set.description ?? '');
    setOverrides(map);
    setView('edit');
  };

  const handleDelete = (set: PermissionSet) => {
    Alert.alert('Delete Permission Set', `Delete "${set.name}"? This will remove it from all assigned users.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!(await canManageSets())) return;
          await permissionRepository.deleteSet(set.id);
          permissionService.invalidateAll();
          await auditLogService.log('permission_set:deleted', {
            userId: user?.id,
            details: `Permission set "${set.name}" deleted`,
            metadata: { setId: set.id },
          });
          loadSets();
        },
      },
    ]);
  };

  const canManageSets = async (): Promise<boolean> => {
    if (user?.id && (await permissionService.can(user.id, 'user:edit'))) return true;
    Alert.alert('Permission Sets', 'Only administrators can manage permission sets.');
    return false;
  };

  const handleSave = async () => {
    if (!editName.trim()) return;
    if (!(await canManageSets())) return;
    setSaving(true);
    try {
      let setId: string;
      if (editingSet) {
        await permissionRepository.updateSet(editingSet.id, editName.trim(), editDescription.trim() || null);
        setId = editingSet.id;
        // Upsert / delete overrides
        for (const [actionKey, granted] of overrides.entries()) {
          if (granted === null) {
            await permissionRepository.deleteOverride(setId, actionKey);
          } else {
            await permissionRepository.upsertOverride(setId, actionKey, granted);
          }
        }
        await auditLogService.log('permission_set:updated', {
          userId: user?.id,
          details: `Permission set "${editName}" updated`,
          metadata: { setId },
        });
      } else {
        setId = await permissionRepository.createSet(editName.trim(), editDescription.trim() || null, user?.id ?? null);
        for (const [actionKey, granted] of overrides.entries()) {
          if (granted !== null) {
            await permissionRepository.upsertOverride(setId, actionKey, granted);
          }
        }
        await auditLogService.log('permission_set:created', {
          userId: user?.id,
          details: `Permission set "${editName}" created`,
          metadata: { setId },
        });
      }
      permissionService.invalidateAll();
      setView('list');
      loadSets();
    } finally {
      setSaving(false);
    }
  };

  const toggleOverride = (actionKey: string) => {
    setOverrides(prev => {
      const next = new Map(prev);
      const current = next.get(actionKey);
      if (current === undefined || current === null) {
        next.set(actionKey, true); // default → granted
      } else if (current === true) {
        next.set(actionKey, false); // granted → denied
      } else {
        next.set(actionKey, null); // denied → default (remove override)
      }
      return next;
    });
  };

  // ── Edit view ─────────────────────────────────────────────────────────
  if (view === 'edit') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>{editingSet ? 'Edit Permission Set' : 'New Permission Set'}</Text>

        <Text style={styles.label}>Name</Text>
        <TextInput
          style={styles.input}
          value={editName}
          onChangeText={setEditName}
          placeholder="e.g. Senior Cashier"
          placeholderTextColor={lightColors.textHint}
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.inputMultiline]}
          value={editDescription}
          onChangeText={setEditDescription}
          placeholder="What this permission set allows"
          placeholderTextColor={lightColors.textHint}
          multiline
          numberOfLines={2}
        />

        <Text style={styles.sectionTitle}>Action Overrides</Text>
        <Text style={styles.hint}>Tap to cycle: Default → Granted → Denied → Default</Text>

        {ACTION_REGISTRY.map(action => {
          const override = overrides.get(action.key);
          const label = override === true ? 'Granted' : override === false ? 'Denied' : 'Default';
          const color = override === true ? lightColors.success : override === false ? lightColors.error : lightColors.textSecondary;
          return (
            <TouchableOpacity key={action.key} style={styles.actionRow} onPress={() => toggleOverride(action.key)}>
              <View style={styles.actionInfo}>
                <Text style={styles.actionKey}>{action.key}</Text>
                <Text style={styles.actionDesc}>{action.description}</Text>
                <Text style={styles.actionDefault}>Default: {action.defaultMinRole}</Text>
              </View>
              <View style={[styles.overrideBadge, { backgroundColor: color + '20' }]}>
                <Text style={[styles.overrideLabel, { color }]}>{label}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={styles.editActions}>
          <Button title="Cancel" variant="outline" onPress={() => setView('list')} style={styles.actionBtn} />
          <Button
            title={saving ? 'Saving…' : 'Save'}
            variant="primary"
            onPress={handleSave}
            loading={saving}
            disabled={saving || !editName.trim()}
            style={styles.actionBtn}
          />
        </View>
      </ScrollView>
    );
  }

  // ── List view ─────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Permission Sets</Text>
        <Button title="+ New Set" variant="primary" size="sm" onPress={handleCreate} />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} color={lightColors.primary} />
      ) : sets.length === 0 ? (
        <Text style={styles.emptyText}>No permission sets yet. Create one to customise user access.</Text>
      ) : (
        <ScrollView>
          {sets.map(set => (
            <View key={set.id} style={styles.setCard}>
              <View style={styles.setInfo}>
                <Text style={styles.setName}>{set.name}</Text>
                {set.description ? <Text style={styles.setDesc}>{set.description}</Text> : null}
                <Text style={styles.setMeta}>
                  {set.userCount} user{set.userCount !== 1 ? 's' : ''} assigned
                </Text>
              </View>
              <View style={styles.setActions}>
                <TouchableOpacity onPress={() => handleEdit(set)} style={styles.iconBtn}>
                  <MaterialIcons name="edit" size={20} color={lightColors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(set)} style={styles.iconBtn}>
                  <MaterialIcons name="delete-outline" size={20} color={lightColors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: lightColors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  sectionTitle: { fontSize: typography.fontSize.lg, fontWeight: '700', color: lightColors.textPrimary, marginBottom: spacing.sm },
  hint: { fontSize: typography.fontSize.xs, color: lightColors.textSecondary, marginBottom: spacing.md },
  label: { fontSize: typography.fontSize.sm, fontWeight: '600', color: lightColors.textSecondary, marginBottom: spacing.xs },
  input: {
    backgroundColor: lightColors.surface,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    marginBottom: spacing.md,
  },
  inputMultiline: { minHeight: 60, textAlignVertical: 'top' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    ...elevation.none,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  actionInfo: { flex: 1 },
  actionKey: { fontSize: typography.fontSize.sm, fontWeight: '600', color: lightColors.textPrimary },
  actionDesc: { fontSize: typography.fontSize.xs, color: lightColors.textSecondary, marginTop: 2 },
  actionDefault: { fontSize: typography.fontSize.xs, color: lightColors.textHint, marginTop: 2 },
  overrideBadge: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: borderRadius.sm },
  overrideLabel: { fontSize: typography.fontSize.xs, fontWeight: '600' },
  editActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { flex: 1 },
  setCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...elevation.low,
  },
  setInfo: { flex: 1 },
  setName: { fontSize: typography.fontSize.md, fontWeight: '600', color: lightColors.textPrimary },
  setDesc: { fontSize: typography.fontSize.sm, color: lightColors.textSecondary, marginTop: 2 },
  setMeta: { fontSize: typography.fontSize.xs, color: lightColors.textHint, marginTop: 4 },
  setActions: { flexDirection: 'row', gap: spacing.xs },
  iconBtn: { padding: spacing.xs },
  loader: { marginTop: spacing.xl },
  emptyText: { textAlign: 'center', color: lightColors.textSecondary, padding: spacing.xl, fontSize: typography.fontSize.sm },
});

export default PermissionSetsScreen;
