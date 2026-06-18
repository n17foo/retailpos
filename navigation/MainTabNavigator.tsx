import React, { lazy, Suspense, useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import SaleScreen from '../screens/SaleScreen';
import { MoreNavigator } from './MoreNavigator';
import type { MainTabParamList } from './types';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { lightColors, typography, spacing } from '../utils/theme';
import { canAccessTab } from '../utils/roleAccess';
import type { UserRole } from '../repositories/UserRepository';

const BarcodeScannerScreen = lazy(() => import('../screens/BarcodeScannerScreen').then(m => ({ default: m.BarcodeScannerScreen })));
const SearchScreen = lazy(() => import('../screens/SearchScreen'));
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
  onLogout: () => void;
}

/**
 * Main Tab Navigator
 * Bottom tab navigation for the main app after login
 */
export const MainTabNavigator: React.FC<MainTabNavigatorProps> = ({ username, userRole, onLogout }) => {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  // Handler for barcode scan success — navigate to Sale tab and auto-add the scanned product
  const handleScanSuccess = useCallback(
    (productId: string) => {
      navigation.navigate('Sale', { scannedProductId: productId });
    },
    [navigation]
  );

  const renderSaleScreen = useCallback(() => <SaleScreen username={username} />, [username]);

  const renderScanScreen = useCallback(
    () => (
      <Suspense fallback={<LazyFallback />}>
        <BarcodeScannerScreen onScanSuccess={handleScanSuccess} onClose={() => {}} />
      </Suspense>
    ),
    [handleScanSuccess]
  );

  const renderSearchScreen = useCallback(
    () => (
      <Suspense fallback={<LazyFallback />}>
        <SearchScreen />
      </Suspense>
    ),
    []
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
          tabBarIcon: ({ color, size }) => <MaterialIcons name="shopping-cart" size={size} color={color} />,
          tabBarLabel: 'Sale',
        }}
      >
        {renderSaleScreen}
      </Tab.Screen>

      <Tab.Screen
        name="Scan"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="qr-code-scanner" size={size} color={color} />,
          tabBarLabel: 'Scan',
        }}
      >
        {renderScanScreen}
      </Tab.Screen>

      <Tab.Screen
        name="Search"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="search" size={size} color={color} />,
          tabBarLabel: 'Search',
        }}
      >
        {renderSearchScreen}
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
