import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lightColors, spacing, borderRadius, typography, interactionStyle } from '../../../shared/utils/theme';
import { getSaleStateInfo, type UserFacingSaleState } from '../utils/orderStateMapper';
import { Omnibar, OmnibarHandle } from '../../catalogue/components/Omnibar';

interface TopBarProps {
  registerName?: string;
  cashierName: string;
  saleState: UserFacingSaleState;
  unsyncedCount: number;
  isSyncing?: boolean;
  onSyncPress?: () => void;
  /** true = drawer physically open (warning), undefined = no drawer configured */
  isDrawerOpen?: boolean;
  onMenuPress: () => void;
  height: number;
  // Omnibar
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onSearchSubmit: () => void;
  onCameraPress?: () => void;
  showCamera?: boolean;
  isSearching?: boolean;
  onOmnibarFocusChange?: (focused: boolean) => void;
  inputMode?: 'touch' | 'pointer';
  omnibarRef?: React.RefObject<OmnibarHandle | null>;
  /** Enabled fulfilment modes — chip hidden when ≤ 1 (spec 6.36) */
  saleModes?: string[];
  saleMode?: string;
  onCycleSaleMode?: () => void;
  /** phone-landscape: omnibar collapses to 🔍 + ▢ buttons */
  collapseOmnibar?: boolean;
}

/**
 * The single merged top bar of the sale screen
 * (docs/specs/system/sales-screen-fast-path-ux.md §4.2):
 * menu · register/cashier · omnibar · sync badge · drawer warning · sale-state chip.
 */
export const TopBar: React.FC<TopBarProps> = ({
  registerName,
  cashierName,
  saleState,
  unsyncedCount,
  isSyncing,
  onSyncPress,
  isDrawerOpen,
  onMenuPress,
  height,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onCameraPress,
  showCamera = false,
  isSearching = false,
  onOmnibarFocusChange,
  inputMode,
  omnibarRef,
  saleModes,
  saleMode,
  onCycleSaleMode,
  collapseOmnibar = false,
}) => {
  const insets = useSafeAreaInsets();
  const stateInfo = getSaleStateInfo(saleState);

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top + spacing.xs,
          paddingLeft: insets.left + spacing.sm,
          paddingRight: insets.right + spacing.sm,
          minHeight: height + insets.top,
        },
      ]}
    >
      {/* Menu */}
      <Pressable
        style={state => [styles.iconButton, interactionStyle(state)]}
        onPress={onMenuPress}
        accessibilityLabel="Open menu"
        accessibilityRole="button"
      >
        <MaterialIcons name="menu" size={24} color={lightColors.textOnPrimary} />
      </Pressable>

      {/* Register + cashier — shown when there's room */}
      <View style={styles.identity} pointerEvents="none">
        {registerName ? (
          <Text style={styles.registerText} numberOfLines={1}>
            {registerName}
          </Text>
        ) : null}
        <Text style={styles.cashierText} numberOfLines={1}>
          {cashierName}
        </Text>
      </View>

      {/* Omnibar — grows to fill */}
      <Omnibar
        ref={omnibarRef}
        value={searchQuery}
        onChangeText={onSearchChange}
        onSubmit={onSearchSubmit}
        onCameraPress={onCameraPress}
        showCamera={showCamera}
        isSearching={isSearching}
        onFocusChange={onOmnibarFocusChange}
        inputMode={inputMode}
        collapsed={collapseOmnibar}
      />

      {/* Sync badge */}
      {(unsyncedCount > 0 || isSyncing) && (
        <Pressable
          style={state => [styles.badge, styles.syncBadge, !isSyncing && interactionStyle(state)]}
          onPress={onSyncPress}
          disabled={isSyncing}
          accessibilityLabel={isSyncing ? 'Syncing orders' : `${unsyncedCount} orders pending sync`}
          accessibilityRole="button"
        >
          <MaterialIcons name={isSyncing ? 'sync' : 'cloud-off'} size={14} color={lightColors.warning} />
          <Text style={styles.syncBadgeText}>{isSyncing ? 'Syncing' : `${unsyncedCount}`}</Text>
        </Pressable>
      )}

      {/* Cash-drawer warning */}
      {isDrawerOpen === true && (
        <View style={[styles.badge, styles.drawerBadge]} accessibilityLabel="Cash drawer open">
          <MaterialIcons name="warning" size={14} color={lightColors.warning} />
          <Text style={styles.syncBadgeText}>Drawer</Text>
        </View>
      )}

      {/* Sale-state chip */}
      <View style={[styles.badge, { backgroundColor: stateInfo.bgColor }]} accessibilityLabel={`Sale state: ${stateInfo.label}`}>
        <View style={[styles.stateDot, { backgroundColor: stateInfo.color }]} />
        <Text style={[styles.stateText, { color: stateInfo.color }]}>{stateInfo.label}</Text>
      </View>

      {/* Fulfilment-mode chip — only when more than one mode is enabled */}
      {saleModes && saleModes.length > 1 && (
        <Pressable
          style={state => [styles.badge, styles.modeBadge, interactionStyle(state)]}
          onPress={onCycleSaleMode}
          accessibilityLabel={`Sale mode: ${saleMode}. Tap to switch.`}
          accessibilityRole="button"
        >
          <MaterialIcons name="local-shipping" size={14} color={lightColors.textOnPrimary} />
          <Text style={styles.modeText}>{saleMode}</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.primary,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
  },
  iconButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  identity: { maxWidth: 140 },
  registerText: { fontSize: typography.fontSize.xs, color: lightColors.primaryLight, fontWeight: '600' },
  cashierText: { fontSize: typography.fontSize.xs, color: lightColors.textOnPrimary },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.xs,
  },
  syncBadge: { backgroundColor: lightColors.warningBackground },
  drawerBadge: { backgroundColor: lightColors.warningBackground },
  syncBadgeText: { fontSize: 11, fontWeight: '600', color: lightColors.warning },
  stateDot: { width: 8, height: 8, borderRadius: 4 },
  stateText: { fontSize: 11, fontWeight: '600' },
  modeBadge: { backgroundColor: lightColors.primaryDark },
  modeText: { fontSize: 11, fontWeight: '600', color: lightColors.textOnPrimary, textTransform: 'capitalize' },
});
