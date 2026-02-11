import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { lightColors, spacing, typography } from '../../utils/theme';
import { useCategoryContext } from '../../contexts/CategoryProvider';
import { useBasketContext } from '../../contexts/BasketProvider';
import { QuickActionsMenu, QuickAction } from '../../components/QuickActionsMenu';
import { useResponsive } from '../../hooks/useResponsive';

interface HeaderProps {
  username: string;
  cartItemTotal: number;
  onQuickAction?: (actionId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ username, cartItemTotal, onQuickAction }) => {
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
    { id: 'report', label: 'Daily Report', icon: '📊', onPress: () => onQuickAction?.('report') },
    { id: 'sync', label: 'Sync Orders', icon: '🔄', onPress: () => onQuickAction?.('sync'), badge: unsyncedOrdersCount > 0 ? unsyncedOrdersCount : undefined },
  ];

  return (
    <View style={styles.header}>
      {/* Left: Category toggle (mobile only) or store name */}
      {isMobile ? (
        <TouchableOpacity style={styles.headerButton} onPress={toggleLeftPanel}>
          <Text style={styles.headerButtonText}>☰ Categories</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.brandContainer}>
          <Text style={styles.brandText}>RetailPOS</Text>
        </View>
      )}

      {/* Center: Username + status */}
      <View style={styles.headerTitleContainer}>
        <Text style={styles.usernameText}>Hi, {username}</Text>
      </View>

      {/* Right: Cart toggle (mobile) or quick actions (all) */}
      <View style={styles.headerRightContainer}>
        {isMobile && (
          <TouchableOpacity style={styles.headerButton} onPress={toggleRightPanel}>
            <Text style={styles.headerButtonText}>
              🛒 {cartItemTotal > 0 ? `(${cartItemTotal})` : ''}
            </Text>
          </TouchableOpacity>
        )}
        <QuickActionsMenu actions={quickActions} />
      </View>
    </View>
  );
};

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
  headerButton: {
    padding: spacing.xs,
  },
  headerButtonText: {
    color: lightColors.textOnPrimary,
    fontWeight: '700',
  },
  brandContainer: {
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
});
