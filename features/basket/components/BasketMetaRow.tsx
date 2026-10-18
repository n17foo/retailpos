import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, interactionStyle } from '../../../shared/utils/theme';
import { basketPanelStyles as styles } from './basketPanelStyles';

interface BasketMetaRowProps {
  customerEmail?: string;
  customerName?: string;
  hasOrderNote: boolean;
  orderNoteVisible: boolean;
  onAddCustomer: () => void;
  onRemoveCustomer: () => void;
  onToggleOrderNote: () => void;
}

/** Customer badge/add button + order-note toggle row. */
export const BasketMetaRow: React.FC<BasketMetaRowProps> = ({
  customerEmail,
  customerName,
  hasOrderNote,
  orderNoteVisible,
  onAddCustomer,
  onRemoveCustomer,
  onToggleOrderNote,
}) => (
  <View style={styles.metaRow}>
    {customerEmail ? (
      <View style={styles.customerBadge}>
        <MaterialIcons name="person" size={16} color={lightColors.primary} />
        <Text style={styles.customerBadgeName} numberOfLines={1}>
          {customerName || customerEmail}
        </Text>
        <Pressable
          onPress={onRemoveCustomer}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Remove customer"
          accessibilityRole="button"
        >
          <MaterialIcons name="close" size={16} color={lightColors.textSecondary} />
        </Pressable>
      </View>
    ) : (
      <Pressable
        style={state => [styles.metaButton, interactionStyle(state)]}
        onPress={onAddCustomer}
        accessibilityLabel="Add customer to order"
        accessibilityRole="button"
      >
        <MaterialIcons name="person-add" size={16} color={lightColors.primary} />
        <Text style={styles.metaButtonText}>Customer</Text>
      </Pressable>
    )}
    <Pressable
      style={state => [styles.metaButton, (orderNoteVisible || hasOrderNote) && styles.metaButtonActive, interactionStyle(state)]}
      onPress={onToggleOrderNote}
      accessibilityLabel="Order note"
      accessibilityRole="button"
    >
      <MaterialIcons name="sticky-note-2" size={16} color={hasOrderNote ? lightColors.primary : lightColors.textSecondary} />
      <Text style={styles.metaButtonText}>Note</Text>
    </Pressable>
  </View>
);
