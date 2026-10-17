import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, Modal, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { lightColors, spacing, borderRadius, typography, elevation, interactionStyle } from '../../utils/theme';
import { composeMoreMenu } from '../../services/navigation/MoreMenuComposer';
import { getPlatformCapabilities } from '../../utils/platformCapabilities';
import { useEcommerceSettings } from '../../hooks/useEcommerceSettings';
import { canAccessTab } from '../../utils/roleAccess';
import type { UserRole } from '../../repositories/UserRepository';
import type { ECommercePlatform } from '../../utils/platforms';
import type { MainTabParamList, MoreStackParamList } from '../../navigation/types';

interface MainMenuProps {
  visible: boolean;
  onClose: () => void;
  userRole?: UserRole;
  /** Locks the register (returns to the PIN screen) */
  onLock: () => void;
  onLogout: () => void;
  /** Quick actions with real handlers — only rendered when provided */
  onReprintReceipt?: () => void;
  onShiftReport?: () => void;
  unsyncedCount?: number;
  onSyncPress?: () => void;
}

/**
 * The ☰ menu on the sale top bar — replaces the bottom tab bar
 * (docs/specs/system/sales-screen-fast-path-ux.md §4.2).
 *
 * Destinations are role- and capability-gated via the same composer that feeds
 * the old More tab. The active sale is preserved: destinations open inside the
 * (hidden) tab navigator and 'Back to sale' returns here.
 */
export const MainMenu: React.FC<MainMenuProps> = ({
  visible,
  onClose,
  userRole,
  onLock,
  onLogout,
  onReprintReceipt,
  onShiftReport,
  unsyncedCount = 0,
  onSyncPress,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { ecommerceSettings } = useEcommerceSettings();

  const platform = (ecommerceSettings.platform ?? 'offline') as ECommercePlatform;
  const capabilities = useMemo(() => getPlatformCapabilities(platform), [platform]);
  const items = useMemo(() => composeMoreMenu({ userRole, platform, capabilities }), [userRole, platform, capabilities]);

  const goTo = (route: keyof MoreStackParamList) => {
    onClose();
    navigation.navigate('More', { screen: route } as never);
  };

  const goToTab = (tab: Exclude<keyof MainTabParamList, 'More'>) => {
    onClose();
    navigation.navigate(tab);
  };

  const quickAction = (
    key: string,
    icon: React.ComponentProps<typeof MaterialIcons>['name'],
    label: string,
    onPress: (() => void) | undefined,
    badge?: number
  ) => {
    if (!onPress) return null;
    return (
      <Pressable
        key={key}
        style={state => [styles.item, interactionStyle(state)]}
        onPress={() => {
          onClose();
          onPress();
        }}
        accessibilityRole="button"
      >
        <MaterialIcons name={icon} size={22} color={lightColors.primary} />
        <Text style={styles.itemLabel}>{label}</Text>
        {badge !== undefined && badge > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{badge}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" accessibilityRole="button" />
        <View
          style={[
            styles.sheet,
            {
              paddingTop: insets.top + spacing.md,
              paddingBottom: insets.bottom + spacing.md,
              paddingLeft: insets.left,
              paddingRight: insets.right,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Menu</Text>
            <Pressable
              style={interactionStyle}
              onPress={onClose}
              accessibilityLabel="Close menu"
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons name="close" size={24} color={lightColors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Quick actions — real handlers only, never dead items */}
            {quickAction('reprint', 'print', 'Reprint last receipt', onReprintReceipt)}
            {quickAction('shift', 'assessment', 'Shift report', onShiftReport)}
            {quickAction('sync', 'sync', 'Sync orders', onSyncPress, unsyncedCount)}

            {canAccessTab(userRole, 'Inventory') && (
              <Pressable
                style={state => [styles.item, interactionStyle(state)]}
                onPress={() => goToTab('Inventory')}
                accessibilityRole="button"
              >
                <MaterialIcons name="inventory" size={22} color={lightColors.primary} />
                <Text style={styles.itemLabel}>Inventory</Text>
              </Pressable>
            )}

            {/* Role + capability gated destinations (same list as the old More tab) */}
            {items.map(item => {
              const disabled = item.status === 'disabled';
              return (
                <Pressable
                  key={item.key}
                  style={state => [styles.item, disabled && styles.itemDisabled, !disabled && interactionStyle(state)]}
                  onPress={() => !disabled && goTo(item.route)}
                  disabled={disabled}
                  accessibilityState={{ disabled }}
                  accessibilityRole="button"
                >
                  <MaterialIcons
                    name={item.icon as React.ComponentProps<typeof MaterialIcons>['name']}
                    size={22}
                    color={disabled ? lightColors.textSecondary : lightColors.primary}
                  />
                  <View style={styles.itemLabelContainer}>
                    <Text style={[styles.itemLabel, disabled && { color: lightColors.textSecondary }]}>{item.label}</Text>
                    {disabled && item.reason ? (
                      <Text style={styles.itemReason} numberOfLines={1}>
                        {item.reason}
                      </Text>
                    ) : null}
                  </View>
                  {disabled && <MaterialIcons name="block" size={16} color={lightColors.textSecondary} />}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Lock + log out are always available */}
          <View style={[styles.footer, { borderTopColor: lightColors.border }]}>
            <Pressable
              style={state => [styles.item, interactionStyle(state)]}
              onPress={() => {
                onClose();
                onLock();
              }}
              accessibilityRole="button"
            >
              <MaterialIcons name="lock" size={22} color={lightColors.textPrimary} />
              <Text style={styles.itemLabel}>Lock register</Text>
            </Pressable>
            <Pressable
              style={state => [styles.item, interactionStyle(state)]}
              onPress={() => {
                onClose();
                onLogout();
              }}
              accessibilityRole="button"
            >
              <MaterialIcons name="logout" size={22} color={lightColors.error} />
              <Text style={[styles.itemLabel, { color: lightColors.error }]}>Log out</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, flexDirection: 'row', backgroundColor: lightColors.overlay },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    width: 320,
    maxWidth: '85%',
    backgroundColor: lightColors.surface,
    ...elevation.high,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  title: { fontSize: typography.fontSize.xl, fontWeight: '700', color: lightColors.textPrimary },
  scroll: { flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  itemDisabled: { opacity: 0.6 },
  itemLabelContainer: { flex: 1 },
  itemLabel: { fontSize: typography.fontSize.md, fontWeight: '500', color: lightColors.textPrimary, flex: 1 },
  itemReason: { fontSize: typography.fontSize.xs, color: lightColors.textSecondary, marginTop: 2 },
  countBadge: {
    backgroundColor: lightColors.warning,
    borderRadius: borderRadius.round,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: lightColors.textOnPrimary },
  footer: { borderTopWidth: 1 },
});
