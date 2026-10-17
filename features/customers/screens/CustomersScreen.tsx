/**
 * CustomersScreen
 *
 * Lists all local customer profiles with search and segment filtering.
 * Tapping a customer navigates to CustomerProfileScreen.
 *
 * Accessible from More → Customers (manager/admin only).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { lightColors, spacing, borderRadius, typography, elevation } from '../../../shared/utils/theme';
import { formatMoney } from '../../../shared/utils/money';
import { useCurrency } from '../../platform-clients/hooks/useCurrency';
import { localCustomerService } from '../services/customer/LocalCustomerService';
import { LocalCustomer } from '../repositories/LocalCustomerRepository';
import type { MoreStackScreenProps } from '../../../app/navigation/types';

type Nav = MoreStackScreenProps<'Customers'>['navigation'];

const CustomersScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const currency = useCurrency();

  const [customers, setCustomers] = useState<LocalCustomer[]>([]);
  const [filtered, setFiltered] = useState<LocalCustomer[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await localCustomerService.findAll();
      setCustomers(all);
      setFiltered(all);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = (text: string) => {
    setQuery(text);
    if (!text.trim()) {
      setFiltered(customers);
      return;
    }
    const q = text.toLowerCase();
    setFiltered(
      customers.filter(c => c.email.toLowerCase().includes(q) || (c.name ?? '').toLowerCase().includes(q) || (c.phone ?? '').includes(q))
    );
  };

  const renderItem = ({ item }: { item: LocalCustomer }) => (
    <TouchableOpacity
      style={styles.row}
      onPress={() => navigation.navigate('CustomerProfile', { email: item.email })}
      accessibilityRole="button"
      accessibilityLabel={`${item.name ?? item.email}, ${item.totalOrders} orders`}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{(item.name?.[0] || item.email[0] || '?').toUpperCase()}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name || '(no name)'}
        </Text>
        <Text style={styles.email} numberOfLines={1}>
          {item.email}
        </Text>
        {item.segment ? (
          <View style={styles.segmentTag}>
            <Text style={styles.segmentText}>{item.segment}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.stats}>
        <Text style={styles.statValue}>{item.totalOrders}</Text>
        <Text style={styles.statLabel}>orders</Text>
        <Text style={styles.statValue}>{formatMoney(item.totalSpend, currency.code)}</Text>
        <Text style={styles.statLabel}>spent</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={lightColors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={20} color={lightColors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={handleSearch}
          placeholder="Search by name, email or phone…"
          placeholderTextColor={lightColors.textHint}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={lightColors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyIcon}>👤</Text>
          <Text style={styles.emptyTitle}>{query ? 'No customers match your search' : 'No customers yet'}</Text>
          <Text style={styles.emptyHint}>
            {query ? 'Try a different search term' : 'Customers are created automatically when attached to an order'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    margin: spacing.md,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: lightColors.border,
    ...elevation.low,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...elevation.low,
  },
  separator: {
    height: spacing.xs,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: lightColors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.primary,
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  email: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  segmentTag: {
    alignSelf: 'flex-start',
    backgroundColor: lightColors.primary + '15',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    marginTop: spacing.xs,
  },
  segmentText: {
    fontSize: typography.fontSize.xs,
    color: lightColors.primary,
    fontWeight: '600',
  },
  stats: {
    alignItems: 'flex-end',
    marginRight: spacing.xs,
  },
  statValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptyHint: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    textAlign: 'center',
  },
});

export default CustomersScreen;
