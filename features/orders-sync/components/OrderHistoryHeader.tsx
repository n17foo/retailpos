import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors } from '../../../shared/utils/theme';
import { orderHistoryStyles as styles } from './orderHistoryStyles';

interface OrderHistoryHeaderProps {
  orderCount: number;
  unsyncedOrdersCount: number;
  shiftOpen: boolean;
  isCashier: boolean;
  isToday: boolean;
  dateLabel: string;
  onPreviousDay: () => void;
  onNextDay: () => void;
  onOpenShift: () => void;
  onCloseShift: () => void;
  onViewReport: () => void;
}

/** Order history header — title, shift badge, date navigation, shift/report actions. */
export const OrderHistoryHeader: React.FC<OrderHistoryHeaderProps> = ({
  orderCount,
  unsyncedOrdersCount,
  shiftOpen,
  isCashier,
  isToday,
  dateLabel,
  onPreviousDay,
  onNextDay,
  onOpenShift,
  onCloseShift,
  onViewReport,
}) => (
  <View style={styles.header}>
    <View style={styles.headerTop}>
      <View>
        <Text style={styles.title}>Order History</Text>
        <Text style={styles.subtitle}>
          {orderCount} order{orderCount !== 1 ? 's' : ''} {unsyncedOrdersCount > 0 ? `\u2022 ${unsyncedOrdersCount} pending sync` : ''}
        </Text>
      </View>
      {shiftOpen && (
        <View style={styles.shiftBadge}>
          <MaterialIcons name="access-time" size={14} color={lightColors.success} />
          <Text style={styles.shiftBadgeText}>Shift Open</Text>
        </View>
      )}
    </View>

    {/* Date navigation (admin/manager only) */}
    {!isCashier && (
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.dateNavButton} onPress={onPreviousDay}>
          <MaterialIcons name="chevron-left" size={24} color={lightColors.primary} />
        </TouchableOpacity>
        <Text style={styles.dateNavText}>{dateLabel}</Text>
        <TouchableOpacity style={[styles.dateNavButton, isToday && styles.dateNavButtonDisabled]} onPress={onNextDay} disabled={isToday}>
          <MaterialIcons name="chevron-right" size={24} color={isToday ? lightColors.textDisabled : lightColors.primary} />
        </TouchableOpacity>
      </View>
    )}

    <View style={styles.actionBar}>
      {!shiftOpen ? (
        <TouchableOpacity style={styles.shiftButton} onPress={onOpenShift}>
          <MaterialIcons name="play-arrow" size={18} color={lightColors.surface} />
          <Text style={styles.shiftButtonText}>Open Shift</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.shiftButton, styles.closeShiftButton]} onPress={onCloseShift}>
          <MaterialIcons name="stop" size={18} color={lightColors.surface} />
          <Text style={styles.shiftButtonText}>Close Shift</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.reportButton} onPress={onViewReport}>
        <MaterialIcons name="assessment" size={18} color={lightColors.primary} />
        <Text style={styles.reportButtonText}>View Report</Text>
      </TouchableOpacity>
    </View>
  </View>
);
