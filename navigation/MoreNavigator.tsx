import React, { lazy, Suspense } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import type { MoreStackParamList, MoreStackScreenProps } from './types';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import { canAccessMoreMenuItem } from '../utils/roleAccess';
import type { UserRole } from '../repositories/UserRepository';

const SettingsScreen = lazy(() => import('../screens/SettingsScreen'));
const RefundScreen = lazy(() => import('../screens/RefundScreen'));
const PrinterScreen = lazy(() => import('../screens/PrinterScreen'));
const PaymentTerminalScreen = lazy(() => import('../screens/PaymentTerminalScreen'));
const UsersScreen = lazy(() => import('../screens/UsersScreen'));
const DailyOrdersScreen = lazy(() => import('../screens/DailyOrdersScreen'));
const SyncQueueScreen = lazy(() => import('../screens/SyncQueueScreen'));
const ReportingScreen = lazy(() => import('../screens/ReportingScreen'));

const LazyFallback = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <ActivityIndicator size="large" color={lightColors.primary} />
  </View>
);

const Stack = createNativeStackNavigator<MoreStackParamList>();

interface MoreMenuScreenProps {
  userRole?: UserRole;
  onLogout: () => void;
}

/**
 * More Menu Screen - Shows list of additional options
 */
const MoreMenuScreen: React.FC<MoreMenuScreenProps> = ({ userRole, onLogout }) => {
  const navigation = useNavigation<MoreStackScreenProps<'MoreMenu'>['navigation']>();

  const allMenuItems = [
    {
      key: 'DailyOrders' as const,
      icon: 'receipt-long' as const,
      label: 'Daily Orders',
      onPress: () => navigation.navigate('DailyOrders'),
      color: lightColors.info,
    },
    {
      key: 'Settings' as const,
      icon: 'settings' as const,
      label: 'Settings',
      onPress: () => navigation.navigate('Settings'),
      color: lightColors.primary,
    },
    {
      key: 'Users' as const,
      icon: 'people' as const,
      label: 'User Management',
      onPress: () => navigation.navigate('Users'),
      color: lightColors.secondary,
    },
    {
      key: 'Refund' as const,
      icon: 'receipt-long' as const,
      label: 'Refunds',
      onPress: () => navigation.navigate('Refund'),
      color: lightColors.warning,
    },
    {
      key: 'Printer' as const,
      icon: 'print' as const,
      label: 'Printer',
      onPress: () => navigation.navigate('Printer'),
      color: lightColors.info,
    },
    {
      key: 'PaymentTerminal' as const,
      icon: 'payment' as const,
      label: 'Payment Terminal',
      onPress: () => navigation.navigate('PaymentTerminal', {}),
      color: lightColors.success,
    },
    {
      key: 'SyncQueue' as const,
      icon: 'sync' as const,
      label: 'Sync Queue',
      onPress: () => navigation.navigate('SyncQueue'),
      color: lightColors.info,
    },
    {
      key: 'Reports' as const,
      icon: 'bar-chart' as const,
      label: 'Reports',
      onPress: () => navigation.navigate('Reports'),
      color: lightColors.secondary,
    },
  ];

  const menuItems = [
    ...allMenuItems.filter(item => canAccessMoreMenuItem(userRole, item.key)),
    {
      key: 'Logout' as const,
      icon: 'logout' as const,
      label: 'Logout',
      onPress: onLogout,
      color: lightColors.error,
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>More Options</Text>
      <View style={styles.menuList}>
        {menuItems.map((item, index) => (
          <TouchableOpacity key={index} style={styles.menuItem} onPress={item.onPress}>
            <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
              <MaterialIcons name={item.icon} size={24} color={item.color} />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <MaterialIcons name="chevron-right" size={24} color={lightColors.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

interface MoreNavigatorProps {
  userRole?: UserRole;
  onLogout: () => void;
}

/**
 * More Stack Navigator
 * Contains Daily Orders, Settings, Refund, Printer, and PaymentTerminal screens
 */
export const MoreNavigator: React.FC<MoreNavigatorProps> = ({ userRole, onLogout }) => {
  return (
    <Stack.Navigator
      id="MoreStack"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: lightColors.surface },
        headerTintColor: lightColors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="MoreMenu" options={{ headerShown: false }}>
        {props => <MoreMenuScreen {...props} userRole={userRole} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen name="DailyOrders" options={{ title: 'Daily Orders' }}>
        {props => (
          <Suspense fallback={<LazyFallback />}>
            <DailyOrdersScreen {...props} />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Settings" options={{ title: 'Settings' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <SettingsScreen />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Users" options={{ title: 'User Management' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <UsersScreen />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Refund" options={{ title: 'Process Refund' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <RefundScreen />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Printer" options={{ title: 'Printer' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <PrinterScreen />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="PaymentTerminal" options={{ title: 'Payment Terminal' }}>
        {props => (
          <Suspense fallback={<LazyFallback />}>
            <PaymentTerminalScreen {...props} />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="SyncQueue" options={{ title: 'Sync Queue' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <SyncQueueScreen />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Reports" options={{ title: 'Reports' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <ReportingScreen />
          </Suspense>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
    padding: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  menuList: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    ...elevation.low,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  menuLabel: {
    flex: 1,
    fontSize: typography.fontSize.md,
    fontWeight: '500',
    color: lightColors.textPrimary,
  },
});

export default MoreNavigator;
