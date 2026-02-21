import React, { memo } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius } from '../../utils/theme';
import { useCategoryContext } from '../../contexts/CategoryProvider';
import { useBasketContext } from '../../contexts/BasketProvider';
import { QuickActionsMenu, QuickAction } from '../../components/QuickActionsMenu';
import { useResponsive } from '../../hooks/useResponsive';

interface HeaderProps {
  username: string;
  cartItemTotal: number;
  onQuickAction?: (actionId: string) => void;
}

const HeaderInner: React.FC<HeaderProps> = ({ username, cartItemTotal, onQuickAction }) => {
  const { isLeftPanelOpen, setIsLeftPanelOpen } = useCategoryContext();
  const { isRightPanelOpen, setIsRightPanelOpen, unsyncedOrdersCount } = useBasketContext();
  const { isMobile } = useResponsive();

  const toggleLeftPanel = () => {
    setIsLeftPanelOpen(!isLeftPanelOpen);
    if (isRightPanelOpen) setIsRightPanelOpen(false);
  };

  const toggleRightPanel = () => {
    setIsRightPanelOpen(!isRightPanelOpen);
    if (isLeftPanelOpen) setIsLeftPanelOpen(false);
  };

  const quickActions: QuickAction[] = [
    { id: 'reprint', label: 'Reprint Last Receipt', icon: '🖨', onPress: () => onQuickAction?.('reprint') },
    { id: 'report', label: 'Shift Report', icon: '📊', onPress: () => onQuickAction?.('report') },
    {
      id: 'sync',
      label: 'Sync Orders',
      icon: '🔄',
      onPress: () => onQuickAction?.('sync'),
      badge: unsyncedOrdersCount > 0 ? unsyncedOrdersCount : undefined,
    },
  ];

  return (
    <View style={styles.header}>
      {/* Left: Category toggle (mobile) or brand */}
      {isMobile ? (
        <TouchableOpacity
          style={styles.iconButton}
          onPress={toggleLeftPanel}
          accessibilityLabel="Open categories"
          accessibilityRole="button"
        >
          <MaterialIcons name={isLeftPanelOpen ? 'close' : 'menu'} size={24} color={lightColors.textOnPrimary} />
        </TouchableOpacity>
      ) : (
        <View style={styles.brandContainer}>
          <MaterialIcons name="point-of-sale" size={20} color={lightColors.textOnPrimary} />
          <Text style={styles.brandText}>RetailPOS</Text>
        </View>
      )}

      {/* Center: Username */}
      <View style={styles.headerTitleContainer}>
        <Text style={styles.usernameText} numberOfLines={1}>
          Hi, {username}
        </Text>
      </View>

      {/* Right: Cart badge (mobile) + quick actions */}
      <View style={styles.headerRightContainer}>
        {isMobile && (
          <TouchableOpacity
            style={styles.cartButton}
            onPress={toggleRightPanel}
            accessibilityLabel={cartItemTotal > 0 ? `Cart, ${cartItemTotal} items` : 'Cart, empty'}
            accessibilityRole="button"
          >
            <MaterialIcons name="shopping-cart" size={24} color={lightColors.textOnPrimary} />
            {cartItemTotal > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{cartItemTotal > 99 ? '99+' : cartItemTotal}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        <QuickActionsMenu actions={quickActions} />
      </View>
    </View>
  );
};

export const Header = memo(HeaderInner);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: lightColors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    height: 56,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  brandText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  usernameText: {
    color: lightColors.primaryLight,
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cartButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: lightColors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  cartBadgeText: {
    color: lightColors.textOnPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
});
