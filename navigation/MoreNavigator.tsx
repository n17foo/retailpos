import React, { lazy, Suspense, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import type { MoreStackParamList, MoreStackScreenProps } from './types';
import { spacing, typography, borderRadius, elevation } from '../utils/theme';
import type { UserRole } from '../repositories/UserRepository';
import { composeMoreMenu } from '../services/navigation/MoreMenuComposer';
import { getPlatformCapabilities } from '../utils/platformCapabilities';
import { useEcommerceSettings } from '../hooks/useEcommerceSettings';
import { setupProgressService } from '../services/setup/SetupProgressService';
import { useTheme } from '../contexts/ThemeProvider';
import { PermissionGate } from '../components/PermissionGate';
import type { ECommercePlatform } from '../utils/platforms';

const SettingsScreen = lazy(() => import('../screens/SettingsScreen'));
const RefundScreen = lazy(() => import('../screens/RefundScreen'));
const PrinterScreen = lazy(() => import('../screens/PrinterScreen'));
const PaymentTerminalScreen = lazy(() => import('../screens/PaymentTerminalScreen'));
const UsersScreen = lazy(() => import('../screens/UsersScreen'));
const OrderHistoryScreen = lazy(() => import('../screens/OrderHistoryScreen'));
const SyncQueueScreen = lazy(() => import('../screens/SyncQueueScreen'));
const ReportingScreen = lazy(() => import('../screens/ReportingScreen'));
const ThemeSettingsTab = lazy(() => import('../screens/settings/ThemeSettingsTab'));
const ExchangeScreen = lazy(() => import('../screens/ExchangeScreen'));
const PermissionSetsScreen = lazy(() => import('../screens/settings/PermissionSetsScreen'));
const CustomersScreen = lazy(() => import('../screens/CustomersScreen'));
const CustomerProfileScreen = lazy(() => import('../screens/CustomerProfileScreen'));
const VendorsScreen = lazy(() => import('../screens/procurement/VendorsScreen'));
const PurchaseOrdersScreen = lazy(() => import('../screens/procurement/PurchaseOrdersScreen'));
const InventoryCountScreen = lazy(() => import('../screens/procurement/InventoryCountScreen'));
const ProcurementScreen = lazy(() => import('../screens/procurement/ProcurementScreen'));
const TransferOrdersScreen = lazy(() => import('../screens/procurement/TransferOrdersScreen'));
const VendorReturnsScreen = lazy(() => import('../screens/procurement/VendorReturnsScreen'));
const ReorderPointConfigScreen = lazy(() => import('../screens/inventory/ReorderPointConfigScreen'));
const BarcodeLabelScreen = lazy(() => import('../screens/inventory/BarcodeLabelScreen'));

const LazyFallback = () => {
  const { colors } = useTheme();
  return (
    <View style={styles.fallback}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
};

const Stack = createNativeStackNavigator<MoreStackParamList>();

interface MoreMenuScreenProps {
  userRole?: UserRole;
  onLogout: () => void;
}

/**
 * More Menu Screen - Shows list of additional options.
 * Items are composed dynamically based on user role + platform capabilities.
 */
const MoreMenuScreen: React.FC<MoreMenuScreenProps> = ({ userRole, onLogout }) => {
  const navigation = useNavigation<MoreStackScreenProps<'MoreMenu'>['navigation']>();
  const { ecommerceSettings } = useEcommerceSettings();
  const { colors, preset } = useTheme();

  const platform = (ecommerceSettings.platform ?? 'offline') as ECommercePlatform;
  const capabilities = useMemo(() => getPlatformCapabilities(platform), [platform]);
  const hasDeferredSetup = setupProgressService.hasDeferredSetup();

  const composedItems = useMemo(() => composeMoreMenu({ userRole, platform, capabilities }), [userRole, platform, capabilities]);

  const handleNavigate = (route: keyof MoreStackParamList) => {
    if (route === 'PaymentTerminal') {
      navigation.navigate('PaymentTerminal', {});
    } else if (route === 'Exchange') {
      navigation.navigate('Exchange', undefined);
    } else if (route === 'Customers') {
      navigation.navigate('Customers');
    } else if (route === 'Procurement') {
      navigation.navigate('Procurement');
    } else {
      navigation.navigate(
        route as Exclude<
          keyof MoreStackParamList,
          'PaymentTerminal' | 'MoreMenu' | 'Exchange' | 'Customers' | 'CustomerProfile' | 'Procurement'
        >
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>More Options</Text>

      {/* Deferred setup reminder */}
      {hasDeferredSetup && (
        <TouchableOpacity
          style={[styles.setupBanner, { backgroundColor: colors.warning + '18', borderColor: colors.warning + '40' }]}
          onPress={() => navigation.navigate('Settings')}
        >
          <MaterialIcons name="build" size={20} color={colors.warning} />
          <Text style={[styles.setupBannerText, { color: colors.textPrimary }]}>Finish setup — some features need configuration</Text>
          <MaterialIcons name="chevron-right" size={20} color={colors.warning} />
        </TouchableOpacity>
      )}

      {/* Active theme indicator */}
      <TouchableOpacity
        style={[styles.themeBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onPress={() => navigation.navigate('Theme')}
        accessibilityLabel={`Current theme: ${preset.name}. Tap to change.`}
      >
        <View style={styles.themeSwatches}>
          {preset.swatch.map((color, i) => (
            <View key={i} style={[styles.themeSwatch, { backgroundColor: color, borderColor: colors.border }]} />
          ))}
        </View>
        <Text style={[styles.themeBannerText, { color: colors.textSecondary }]}>
          Theme: <Text style={[styles.themeBannerName, { color: colors.textPrimary }]}>{preset.name}</Text>
        </Text>
        <MaterialIcons name="palette" size={18} color={colors.primary} />
      </TouchableOpacity>

      <View style={[styles.menuList, { backgroundColor: colors.surface }]}>
        {composedItems.map((item, index) => {
          const isDisabled = item.status === 'disabled';
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.menuItem,
                { borderBottomColor: colors.border },
                index === composedItems.length - 1 && styles.menuItemLast,
                isDisabled && styles.menuItemDisabled,
              ]}
              onPress={() => !isDisabled && handleNavigate(item.route)}
              disabled={isDisabled}
              accessibilityState={{ disabled: isDisabled }}
            >
              <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
                <MaterialIcons
                  name={item.icon as React.ComponentProps<typeof MaterialIcons>['name']}
                  size={24}
                  color={isDisabled ? colors.textSecondary : item.color}
                />
              </View>
              <View style={styles.menuLabelContainer}>
                <Text style={[styles.menuLabel, { color: colors.textPrimary }, isDisabled && { color: colors.textSecondary }]}>
                  {item.label}
                </Text>
                {isDisabled && item.reason ? (
                  <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.reason}
                  </Text>
                ) : null}
              </View>
              <MaterialIcons name={isDisabled ? 'block' : 'chevron-right'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          );
        })}

        {/* Logout is always last and role-independent */}
        <TouchableOpacity style={[styles.menuItem, styles.menuItemLast, { borderBottomColor: colors.border }]} onPress={onLogout}>
          <View style={[styles.iconContainer, { backgroundColor: colors.error + '20' }]}>
            <MaterialIcons name="logout" size={24} color={colors.error} />
          </View>
          <View style={styles.menuLabelContainer}>
            <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>Logout</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
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
 * Contains Order History, Settings, Returns, Printer, and PaymentTerminal screens
 */
export const MoreNavigator: React.FC<MoreNavigatorProps> = ({ userRole, onLogout }) => {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      id="MoreStack"
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="MoreMenu" options={{ headerShown: false }}>
        {props => <MoreMenuScreen {...props} userRole={userRole} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen name="OrderHistory" options={{ title: 'Order History' }}>
        {props => (
          <Suspense fallback={<LazyFallback />}>
            <OrderHistoryScreen {...props} />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Settings" options={{ title: 'Settings' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <PermissionGate action="settings:view">
              <SettingsScreen />
            </PermissionGate>
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Users" options={{ title: 'User Management' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <PermissionGate action="user:edit">
              <UsersScreen />
            </PermissionGate>
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Refund" options={{ title: 'Refund' }}>
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
            <PermissionGate action="sync:retry">
              <SyncQueueScreen />
            </PermissionGate>
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Reports" options={{ title: 'Reports' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <PermissionGate action="report:view">
              <ReportingScreen />
            </PermissionGate>
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Theme" options={{ title: 'Theme' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <ThemeSettingsTab />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Exchange" options={{ title: 'Exchange' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <ExchangeScreen />
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="PermissionSets" options={{ title: 'Permission Sets' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <PermissionGate action="user:edit">
              <PermissionSetsScreen />
            </PermissionGate>
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Customers" options={{ title: 'Customers' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <PermissionGate action="customer:edit">
              <CustomersScreen />
            </PermissionGate>
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="CustomerProfile" options={{ title: 'Customer Profile' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <PermissionGate action="customer:edit">
              <CustomerProfileScreen />
            </PermissionGate>
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Vendors" options={{ title: 'Vendors' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <PermissionGate action="purchase_order:create">
              <VendorsScreen />
            </PermissionGate>
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="PurchaseOrders" options={{ title: 'Purchase Orders' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <PermissionGate action="purchase_order:create">
              <PurchaseOrdersScreen />
            </PermissionGate>
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="InventoryCount" options={{ title: 'Inventory Count' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <PermissionGate action="inventory:count">
              <InventoryCountScreen />
            </PermissionGate>
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="Procurement" options={{ title: 'Procurement' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <PermissionGate action="inventory:adjust">
              <ProcurementScreen />
            </PermissionGate>
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="TransferOrders" options={{ title: 'Transfer Orders' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <PermissionGate action="inventory:adjust">
              <TransferOrdersScreen />
            </PermissionGate>
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="VendorReturns" options={{ title: 'Vendor Returns' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <PermissionGate action="inventory:adjust">
              <VendorReturnsScreen />
            </PermissionGate>
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="ReorderPointConfig" options={{ title: 'Reorder Points' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <PermissionGate action="inventory:adjust">
              <ReorderPointConfigScreen />
            </PermissionGate>
          </Suspense>
        )}
      </Stack.Screen>
      <Stack.Screen name="BarcodeLabelPrint" options={{ title: 'Print Labels' }}>
        {() => (
          <Suspense fallback={<LazyFallback />}>
            <BarcodeLabelScreen />
          </Suspense>
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.md,
    marginTop: spacing.md,
  },
  setupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  setupBannerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    marginHorizontal: spacing.sm,
    fontWeight: '500',
  },
  themeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    ...elevation.none,
  },
  themeSwatches: {
    flexDirection: 'row',
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginRight: spacing.sm,
    width: 36,
    height: 20,
  },
  themeSwatch: {
    flex: 1,
    borderWidth: 0,
  },
  themeBannerText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
  },
  themeBannerName: {
    fontWeight: '600',
  },
  menuList: {
    borderRadius: borderRadius.lg,
    ...elevation.low,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemDisabled: {
    opacity: 0.6,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  menuLabelContainer: {
    flex: 1,
  },
  menuLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: '500',
  },
  menuSubtitle: {
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
  fallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MoreNavigator;
