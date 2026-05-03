/**
 * ProcurementScreen
 *
 * Hub screen linking to Vendors, Purchase Orders, and Inventory Counts.
 * Manager/admin only.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../utils/theme';
import type { MoreStackScreenProps } from '../../navigation/types';

type Nav = MoreStackScreenProps<'Procurement'>['navigation'];

interface HubItem {
  label: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
  route: 'Vendors' | 'PurchaseOrders' | 'InventoryCount' | 'TransferOrders' | 'VendorReturns';
}

const HUB_ITEMS: HubItem[] = [
  {
    label: 'Vendors',
    description: 'Manage supplier records',
    icon: 'business',
    color: '#5C6BC0',
    route: 'Vendors',
  },
  {
    label: 'Purchase Orders',
    description: 'Create, submit and receive stock',
    icon: 'receipt',
    color: '#26A69A',
    route: 'PurchaseOrders',
  },
  {
    label: 'Inventory Count',
    description: 'Run a stock-take and apply corrections',
    icon: 'fact-check',
    color: '#EF6C00',
    route: 'InventoryCount',
  },
  {
    label: 'Transfer Orders',
    description: 'Move stock between locations',
    icon: 'swap-horiz',
    color: '#7E57C2',
    route: 'TransferOrders',
  },
  {
    label: 'Vendor Returns',
    description: 'Return items to suppliers',
    icon: 'assignment-return',
    color: '#EC407A',
    route: 'VendorReturns',
  },
];

const ProcurementScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Procurement</Text>
      <Text style={styles.subtitle}>Advanced inventory management</Text>

      {HUB_ITEMS.map(item => (
        <TouchableOpacity
          key={item.route}
          style={styles.card}
          onPress={() => navigation.navigate(item.route)}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <View style={[styles.iconBox, { backgroundColor: item.color + '20' }]}>
            <MaterialIcons name={item.icon} size={28} color={item.color} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardLabel}>{item.label}</Text>
            <Text style={styles.cardDesc}>{item.description}</Text>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={lightColors.textSecondary} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginBottom: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...elevation.low,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  cardText: {
    flex: 1,
  },
  cardLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  cardDesc: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
});

export default ProcurementScreen;
