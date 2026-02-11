import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { lightColors, spacing, borderRadius, typography, elevation } from '../utils/theme';

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  onPress: () => void;
  badge?: number;
  disabled?: boolean;
}

interface QuickActionsMenuProps {
  actions: QuickAction[];
  triggerIcon?: string;
}

export const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({ actions, triggerIcon = '⋮' }) => {
  const [visible, setVisible] = useState(false);

  const handleAction = (action: QuickAction) => {
    setVisible(false);
    action.onPress();
  };

  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} style={styles.trigger}>
        <Text style={styles.triggerText}>{triggerIcon}</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <View style={styles.menu}>
            {actions.map(action => (
              <TouchableOpacity
                key={action.id}
                style={[styles.menuItem, action.disabled && styles.menuItemDisabled]}
                onPress={() => handleAction(action)}
                disabled={action.disabled}
              >
                <Text style={styles.menuIcon}>{action.icon}</Text>
                <Text style={[styles.menuLabel, action.disabled && styles.menuLabelDisabled]}>{action.label}</Text>
                {action.badge !== undefined && action.badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{action.badge}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  trigger: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerText: {
    fontSize: 20,
    color: lightColors.textOnPrimary,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingRight: spacing.md,
  },
  menu: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    minWidth: 220,
    ...elevation.high,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.divider,
  },
  menuItemDisabled: {
    opacity: 0.4,
  },
  menuIcon: {
    fontSize: 18,
    marginRight: spacing.sm,
    width: 28,
    textAlign: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  menuLabelDisabled: {
    color: lightColors.textDisabled,
  },
  badge: {
    backgroundColor: lightColors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.xs,
    fontWeight: '700',
  },
});

export default QuickActionsMenu;
