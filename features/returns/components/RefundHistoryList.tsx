import React from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { lightColors, spacing, typography, borderRadius, elevation } from '../../../shared/utils/theme';
import { formatMoney } from '../../../shared/utils/money';
import { RefundRecord } from '../services/refunds/RefundService';

function getStatusColor(status: string): string {
  switch (status) {
    case 'completed':
      return lightColors.success;
    case 'failed':
      return lightColors.error;
    default:
      return lightColors.warning;
  }
}

interface RefundHistoryListProps {
  history: RefundRecord[];
  isLoading: boolean;
  currencyCode: string;
}

/** Refund history section — status-badge list of past refund records. */
export const RefundHistoryList: React.FC<RefundHistoryListProps> = ({ history, isLoading, currencyCode }) => {
  const renderItem = ({ item }: { item: RefundRecord }) => {
    const statusColor = getStatusColor(item.status);
    return (
      <View style={styles.historyItem}>
        <View style={styles.historyHeader}>
          <Text style={styles.historyId}>#{item.id.slice(-8)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.historyAmount}>{formatMoney(item.amount, currencyCode)}</Text>
        <Text style={styles.historyMeta}>
          {item.timestamp.toLocaleString()} · {item.source}
        </Text>
        {item.reason && <Text style={styles.historyReason}>{item.reason}</Text>}
      </View>
    );
  };

  return (
    <View style={styles.historyContainer}>
      <Text style={styles.sectionTitle}>Refund History</Text>
      {isLoading ? (
        <ActivityIndicator style={styles.historyLoader} />
      ) : history.length > 0 ? (
        <FlatList data={history} renderItem={renderItem} keyExtractor={item => item.id} />
      ) : (
        <Text style={styles.emptyHistoryText}>No refund history available</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  historyContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '500',
    marginBottom: spacing.xs,
    color: lightColors.textPrimary,
  },
  historyLoader: {
    marginTop: spacing.lg,
  },
  emptyHistoryText: {
    textAlign: 'center',
    marginTop: spacing.lg,
    color: lightColors.textSecondary,
  },
  historyItem: {
    backgroundColor: lightColors.surface,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    ...elevation.low,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  historyId: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  historyAmount: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.error,
    marginBottom: spacing.xs,
  },
  historyMeta: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  historyReason: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
});
