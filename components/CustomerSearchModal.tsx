import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, TextInput } from 'react-native';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import { PlatformCustomer } from '../services/customer/CustomerServiceInterface';
import { useCustomerSearch } from '../hooks/useCustomerSearch';
import { ECommercePlatform } from '../utils/platforms';

interface CustomerSearchModalProps {
  visible: boolean;
  platform: ECommercePlatform | undefined;
  onSelect: (customer: PlatformCustomer) => void;
  onClose: () => void;
}

const CustomerSearchModal: React.FC<CustomerSearchModalProps> = ({ visible, platform, onSelect, onClose }) => {
  const { customers, isSearching, error, hasMore, search, loadMore, clear, isAvailable } = useCustomerSearch(platform);
  const [query, setQuery] = useState('');

  const handleChangeText = (text: string) => {
    setQuery(text);
    search(text);
  };

  const handleSelect = (customer: PlatformCustomer) => {
    onSelect(customer);
    setQuery('');
    clear();
  };

  const handleClose = () => {
    setQuery('');
    clear();
    onClose();
  };

  const displayName = (c: PlatformCustomer) => {
    const parts = [c.firstName, c.lastName].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : c.email;
  };

  const renderCustomerItem = ({ item }: { item: PlatformCustomer }) => (
    <TouchableOpacity
      style={styles.customerItem}
      onPress={() => handleSelect(item)}
      accessibilityLabel={`Select ${displayName(item)}, ${item.email}`}
      accessibilityRole="button"
      accessibilityHint="Double tap to attach this customer to the order"
    >
      <View style={styles.customerAvatar}>
        <Text style={styles.avatarText}>{(item.firstName?.[0] || item.email[0] || '?').toUpperCase()}</Text>
      </View>
      <View style={styles.customerInfo}>
        <Text style={styles.customerName}>{displayName(item)}</Text>
        <Text style={styles.customerEmail}>{item.email}</Text>
        {item.phone && <Text style={styles.customerPhone}>{item.phone}</Text>}
      </View>
      {item.orderCount !== undefined && (
        <View style={styles.customerStats}>
          <Text style={styles.statValue}>{item.orderCount}</Text>
          <Text style={styles.statLabel}>orders</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Find Customer</Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityLabel="Close customer search"
              accessibilityRole="button"
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {!isAvailable ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>👤</Text>
              <Text style={styles.emptyTitle}>Customer search unavailable</Text>
              <Text style={styles.emptyDescription}>Customer lookup requires an online e-commerce platform connection.</Text>
            </View>
          ) : (
            <>
              {/* Search input */}
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={handleChangeText}
                  placeholder="Search by name, email, or phone…"
                  placeholderTextColor={lightColors.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  accessibilityLabel="Search customers"
                  accessibilityHint="Type a name, email, or phone number to search"
                />
                {isSearching && <ActivityIndicator size="small" color={lightColors.primary} style={styles.searchSpinner} />}
              </View>

              {/* Error */}
              {error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Results */}
              <FlatList
                data={customers}
                keyExtractor={item => item.id}
                renderItem={renderCustomerItem}
                style={styles.list}
                contentContainerStyle={customers.length === 0 ? styles.listEmpty : undefined}
                ListEmptyComponent={
                  !isSearching && query.length > 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyIcon}>🔍</Text>
                      <Text style={styles.emptyTitle}>No customers found</Text>
                      <Text style={styles.emptyDescription}>Try a different search term.</Text>
                    </View>
                  ) : !isSearching && query.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyIcon}>👤</Text>
                      <Text style={styles.emptyTitle}>Search for a customer</Text>
                      <Text style={styles.emptyDescription}>
                        Type a name, email, or phone number to find a customer from your platform.
                      </Text>
                    </View>
                  ) : null
                }
                onEndReached={hasMore ? loadMore : undefined}
                onEndReachedThreshold={0.3}
              />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    ...elevation.medium,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: lightColors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  searchInput: {
    flex: 1,
    height: 44,
    backgroundColor: lightColors.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
  },
  searchSpinner: {
    marginLeft: spacing.sm,
  },
  errorContainer: {
    padding: spacing.md,
    backgroundColor: lightColors.error + '10',
  },
  errorText: {
    color: lightColors.error,
    fontSize: typography.fontSize.sm,
  },
  list: {
    flex: 1,
  },
  listEmpty: {
    flex: 1,
    justifyContent: 'center',
  },
  customerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  customerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: lightColors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: lightColors.primary,
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  customerEmail: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  customerPhone: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginTop: 1,
  },
  customerStats: {
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  statValue: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  statLabel: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: spacing.xs,
  },
  emptyDescription: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    textAlign: 'center',
  },
});

export default CustomerSearchModal;
