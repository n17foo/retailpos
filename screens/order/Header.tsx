import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { lightColors, spacing, typography } from '../../utils/theme';
import { useCategoryContext } from '../../contexts/CategoryProvider';
import { useBasketContext } from '../../contexts/BasketProvider';

export const Header: React.FC<{
  username: string;
  cartItemTotal: number;
}> = ({ username, cartItemTotal }) => {
  const { isLeftPanelOpen, setIsLeftPanelOpen } = useCategoryContext();
  const { isRightPanelOpen, setIsRightPanelOpen } = useBasketContext();

  const toggleLeftPanel = () => {
    setIsLeftPanelOpen(!isLeftPanelOpen);
    if (isRightPanelOpen) setIsRightPanelOpen(false);
  };

  const toggleRightPanel = () => {
    setIsRightPanelOpen(!isRightPanelOpen);
    if (isLeftPanelOpen) setIsLeftPanelOpen(false);
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity style={styles.headerButton} onPress={toggleLeftPanel}>
        <Text style={styles.headerButtonText}>☰ Categories</Text>
      </TouchableOpacity>

      <View style={styles.headerTitleContainer}>
        <Text style={styles.usernameText}>Hi, {username}</Text>
      </View>

      <TouchableOpacity style={styles.headerButton} onPress={toggleRightPanel}>
        <Text style={styles.headerButtonText}>Cart {cartItemTotal > 0 ? `(${cartItemTotal})` : ''} ☰</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: lightColors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  headerButton: {
    padding: spacing.xs,
  },
  headerButtonText: {
    color: lightColors.textOnPrimary,
    fontWeight: '700', // Using literal value as React Native expects specific string literals
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.lg,
    fontWeight: '700', // Using literal value as React Native expects specific string literals
  },
  usernameText: {
    color: lightColors.primaryLight,
    fontSize: typography.fontSize.xs,
    marginTop: spacing.xs / 2, // Half of the smallest spacing unit
  },
  headerRightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
