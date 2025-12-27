import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import OrderScreen from '../screens/OrderScreen';
import { BarcodeScannerScreen } from '../screens/BarcodeScannerScreen';
import SearchScreen from '../screens/SearchScreen';
import InventoryScreen from '../screens/InventoryScreen';
import { MoreNavigator } from './MoreNavigator';
import type { MainTabParamList } from './types';
import { lightColors, typography, spacing } from '../utils/theme';

const Tab = createBottomTabNavigator<MainTabParamList>();

interface MainTabNavigatorProps {
  username: string;
  onOrderComplete: (orderTotal: number, items: any[]) => void;
  onLogout: () => void;
}

/**
 * Main Tab Navigator
 * Bottom tab navigation for the main app after login
 */
export const MainTabNavigator: React.FC<MainTabNavigatorProps> = ({ username, onOrderComplete, onLogout }) => {
  // Handler for barcode scan success
  const handleScanSuccess = (productId: string) => {
    console.log('Scanned product:', productId);
    // TODO: Add product to cart and navigate to Order tab
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
        {props => <OrderScreen {...props} username={username} onOrderComplete={onOrderComplete} />}
      </Tab.Screen>

      <Tab.Screen
        name="Scan"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="qr-code-scanner" size={size} color={color} />,
          tabBarLabel: 'Scan',
        }}
      >
        {props => <BarcodeScannerScreen {...props} onScanSuccess={handleScanSuccess} onClose={() => {}} />}
      </Tab.Screen>

      <Tab.Screen
        name="Search"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="search" size={size} color={color} />,
          tabBarLabel: 'Search',
        }}
      >
        {() => <SearchScreen />}
      </Tab.Screen>

      <Tab.Screen
        name="Inventory"
        options={{
          tabBarIcon: ({ color, size }) => <MaterialIcons name="inventory" size={size} color={color} />,
          tabBarLabel: 'Inventory',
        }}
      >
        {() => <InventoryScreen />}
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
