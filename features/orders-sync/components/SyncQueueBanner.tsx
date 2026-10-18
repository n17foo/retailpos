import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors } from '../../../shared/utils/theme';
import { orderHistoryStyles as styles } from './orderHistoryStyles';

interface SyncQueueBannerProps {
  pending: number;
  failed: number;
}

/** Sync-queue status strip — hidden when the queue is empty. */
export const SyncQueueBanner: React.FC<SyncQueueBannerProps> = ({ pending, failed }) => {
  const count = pending + failed;
  if (count === 0) return null;
  return (
    <View style={styles.queueStatus}>
      <MaterialIcons name="sync" size={16} color={lightColors.primary} />
      <Text style={styles.queueText}>
        {count} request{count !== 1 ? 's' : ''} in queue
      </Text>
    </View>
  );
};
