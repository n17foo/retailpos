import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors } from '../../../shared/utils/theme';
import { LocalOrder } from '../../basket/services/BasketServiceInterface';
import OrderCard from './OrderCard';
import { orderHistoryStyles as styles } from './orderHistoryStyles';

interface OrderHistoryListItemProps {
  order: LocalOrder;
  isSyncing: boolean;
  isAdmin: boolean;
  onResync: (orderId: string) => void;
  onDelete: (orderId: string) => void;
  onPrintReceipt: (order: LocalOrder) => void;
  onExchange: (orderId: string) => void;
}

/** Order history row — OrderCard plus the admin-only delete strip. */
export const OrderHistoryListItem: React.FC<OrderHistoryListItemProps> = ({
  order,
  isSyncing,
  isAdmin,
  onResync,
  onDelete,
  onPrintReceipt,
  onExchange,
}) => (
  <View>
    <OrderCard order={order} isSyncing={isSyncing} onResync={onResync} onPrintReceipt={onPrintReceipt} onExchange={onExchange} />
    {isAdmin && (
      <TouchableOpacity style={styles.deleteOrderButton} onPress={() => onDelete(order.id)}>
        <MaterialIcons name="delete-outline" size={16} color={lightColors.error} />
        <Text style={styles.deleteOrderText}>Delete</Text>
      </TouchableOpacity>
    )}
  </View>
);
