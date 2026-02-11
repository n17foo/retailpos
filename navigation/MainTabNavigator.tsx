import React, { lazy, Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import OrderScreen from '../screens/OrderScreen';
import { MoreNavigator } from './MoreNavigator';
import type { MainTabParamList } from './types';
import { lightColors, typography, spacing } from '../utils/theme';

const BarcodeScannerScreen = lazy(() => import('../screens/BarcodeScannerScreen').then(m => ({ default: m.BarcodeScannerScreen })));
const SearchScreen = lazy(() => import('../screens/SearchScreen'));
const InventoryScreen = lazy(() => import('../screens/InventoryScreen'));

const LazyFallback = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color={lightColors.primary} />
  </View>
);

const Tab = createBottomTabNavigator<MainTabParamList>();

interface MainTabNavigatorProps {
  username: string;
  onLogout: () => void;
}

/**
 * Main Tab Navigator
 * Bottom tab navigation for the main app after login
 */
export const MainTabNavigator: React.FC<MainTabNavigatorProps> = ({ username, onLogout }) => {
  // Handler for barcode scan success
  const handleScanSuccess = (productId: string) => {
    // TODO: Add product to cart and navigate to Order tab
    void productId;
  };

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
        name="Order"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="shopping-cart" size={size} color={color} />,
          tabBarLabel: 'Order',
        }}
      >
        {props => <OrderScreen {...props} username={username} />}
      </Tab.Screen>

      <Tab.Screen
        name="Scan"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="qr-code-scanner" size={size} color={color} />,
          tabBarLabel: 'Scan',
        }}
      >
        {props => (
          <Suspense fallback={<LazyFallback />}>
            <BarcodeScannerScreen {...props} onScanSuccess={handleScanSuccess} onClose={() => {}} />
          </Suspense>
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Search"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="search" size={size} color={color} />,
          tabBarLabel: 'Search',
        }}
      >
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <SearchScreen />
          </Suspense>
        )}
      </Tab.Screen>

      <Tab.Screen
        name="Inventory"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="inventory" size={size} color={color} />,
          tabBarLabel: 'Inventory',
        }}
      >
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <InventoryScreen />
          </Suspense>
        )}
      </Tab.Screen>

      <Tab.Screen
        name="More"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="more-horiz" size={size} color={color} />,
          tabBarLabel: 'More',
        }}
      >
        {props => <MoreNavigator {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
