import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import SettingsScreen from '../screens/SettingsScreen';
import RefundScreen from '../screens/RefundScreen';
import PrinterScreen from '../screens/PrinterScreen';
import PaymentTerminalScreen from '../screens/PaymentTerminalScreen';
import UsersScreen from '../screens/UsersScreen';
import type { MoreStackParamList, MoreStackScreenProps } from './types';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';

const Stack = createNativeStackNavigator<MoreStackParamList>();

interface MoreMenuScreenProps {
  onLogout: () => void;
}

/**
 * More Menu Screen - Shows list of additional options
 */
const MoreMenuScreen: React.FC<MoreMenuScreenProps> = ({ onLogout }) => {
  const navigation = useNavigation<MoreStackScreenProps<'MoreMenu'>['navigation']>();

  const menuItems = [
    {
      icon: 'settings' as const,
      label: 'Settings',
      onPress: () => navigation.navigate('Settings'),
      color: lightColors.primary,
    },
    {
      icon: 'people' as const,
      label: 'User Management',
      onPress: () => navigation.navigate('Users'),
      color: lightColors.secondary,
    },
    {
      icon: 'receipt-long' as const,
      label: 'Refunds',
      onPress: () => navigation.navigate('Refund'),
      color: lightColors.warning,
    },
    {
      icon: 'print' as const,
      label: 'Printer',
      onPress: () => navigation.navigate('Printer'),
      color: lightColors.info,
    },
    {
      icon: 'payment' as const,
      label: 'Payment Terminal',
      onPress: () => navigation.navigate('PaymentTerminal', {}),
      color: lightColors.success,
    },
    {
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
  onLogout: () => void;
}

/**
 * More Stack Navigator
 * Contains Settings, Refund, Printer, and PaymentTerminal screens
 */
export const MoreNavigator: React.FC<MoreNavigatorProps> = ({ onLogout }) => {
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
        {props => <MoreMenuScreen {...props} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="Users" component={UsersScreen} options={{ title: 'User Management' }} />
      <Stack.Screen name="Refund" component={RefundScreen} options={{ title: 'Process Refund' }} />
      <Stack.Screen name="Printer" component={PrinterScreen} options={{ title: 'Printer' }} />
      <Stack.Screen name="PaymentTerminal" component={PaymentTerminalScreen} options={{ title: 'Payment Terminal' }} />
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
