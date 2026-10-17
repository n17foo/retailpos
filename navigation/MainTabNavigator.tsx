import React, { lazy, Suspense, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import SaleScreen from '../screens/SaleScreen';
import { MoreNavigator } from './MoreNavigator';
import type { MainTabParamList } from './types';
import { lightColors, typography, spacing } from '../utils/theme';
import { canAccessTab } from '../utils/roleAccess';
import type { UserRole } from '../repositories/UserRepository';

const InventoryScreen = lazy(() => import('../screens/InventoryScreen'));

const LazyFallback = () => (
  <View style={styles.fallback}>
    <ActivityIndicator size="large" color={lightColors.primary} />
  </View>
);

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const Tab = createBottomTabNavigator<MainTabParamList>();

interface MainTabNavigatorProps {
  username: string;
  userRole?: UserRole;
  /** Locks the register (returns to the PIN screen) */
  onLock: () => void;
  onLogout: () => void;
}

/**
 * Main Tab Navigator.
 *
 * The sale screen is the full-screen home — it has no visible tab bar
 * (docs/specs/system/sales-screen-fast-path-ux.md §4.2). Secondary
 * destinations (Inventory, More) keep the tab bar so the cashier can get
 * back to the sale in one tap.
 */
export const MainTabNavigator: React.FC<MainTabNavigatorProps> = ({ username, userRole, onLock, onLogout }) => {
  const renderSaleScreen = useCallback(
    () => <SaleScreen username={username} onLock={onLock} onLogout={onLogout} />,
    [username, onLock, onLogout]
  );

  const renderInventoryScreen = useCallback(
    () => (
      <Suspense fallback={<LazyFallback />}>
        <InventoryScreen />
      </Suspense>
    ),
    []
  );

  const renderMoreScreen = useCallback(() => <MoreNavigator userRole={userRole} onLogout={onLogout} />, [userRole, onLogout]);

  return (
    <Tab.Navigator
      id="MainTabs"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: lightColors.surface,
          borderTopColor: lightColors.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: spacing.xs,
          paddingTop: spacing.xs,
        },
        tabBarActiveTintColor: lightColors.primary,
        tabBarInactiveTintColor: lightColors.textSecondary,
        tabBarLabelStyle: {
          fontSize: typography.fontSize.xs,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Sale"
        options={{
          // The sale flow is full-screen: omnibar search + in-place scanning
          // replace the old Scan/Search tabs, and the ☰ menu replaces More.
          tabBarStyle: { display: 'none' },
          tabBarIcon: ({ color, size }) => <MaterialIcons name="point-of-sale" size={size} color={color} />,
          tabBarLabel: 'Sale',
        }}
      >
        {renderSaleScreen}
      </Tab.Screen>

      {canAccessTab(userRole, 'Inventory') && (
        <Tab.Screen
          name="Inventory"
          options={{
            tabBarIcon: ({ color, size }) => <MaterialIcons name="inventory" size={size} color={color} />,
            tabBarLabel: 'Inventory',
          }}
        >
          {renderInventoryScreen}
        </Tab.Screen>
      )}

      <Tab.Screen
        name="More"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="more-horiz" size={size} color={color} />,
          tabBarLabel: 'More',
        }}
      >
        {renderMoreScreen}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
