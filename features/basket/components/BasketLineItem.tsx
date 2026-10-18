import React from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, hitTarget, interactionStyle } from '../../../shared/utils/theme';
import { formatMoney, multiplyMoney } from '../../../shared/utils/money';
import type { BasketItem } from '../contexts/BasketStateProvider';
import { SwipeableLine } from './SwipeableLine';
import { basketPanelStyles as styles } from './basketPanelStyles';

interface BasketLineItemProps {
  item: BasketItem;
  currencyCode: string;
  isSelected: boolean;
  isFlashing: boolean;
  isNoteEditing: boolean;
  noteChips: string[];
  inputMode: 'touch' | 'pointer';
  isAtStockLimit: (item: BasketItem) => boolean;
  onToggleSelect: (itemId: string) => void;
  onDecrement: (itemId: string, currentQuantity: number) => void;
  onIncrement: (itemId: string) => void;
  onRemove: (itemId: string) => void;
  onToggleNoteEdit: (itemId: string) => void;
  onNoteChip: (itemId: string, chip: string) => void;
  onNoteSubmit: (itemId: string, note: string) => void;
}

/** One basket line — card, selected-state action strip, inline note editor. */
export const BasketLineItem: React.FC<BasketLineItemProps> = ({
  item,
  currencyCode,
  isSelected,
  isFlashing,
  isNoteEditing,
  noteChips,
  inputMode,
  isAtStockLimit,
  onToggleSelect,
  onDecrement,
  onIncrement,
  onRemove,
  onToggleNoteEdit,
  onNoteChip,
  onNoteSubmit,
}) => (
  <SwipeableLine key={item.id} onRemove={inputMode === 'touch' ? () => onRemove(item.id) : undefined}>
    <Pressable
      style={state => [styles.cartItem, isSelected && styles.cartItemSelected, isFlashing && styles.cartItemFlash, interactionStyle(state)]}
      onPress={() => onToggleSelect(item.id)}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${item.name}, ${item.quantity} × ${formatMoney(item.price, currencyCode)}`}
    >
      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2} maxFontSizeMultiplier={1.5}>
          {item.name}
        </Text>
        <Text style={styles.itemPrice} maxFontSizeMultiplier={1.5}>
          {formatMoney(item.price, currencyCode)}
        </Text>
        {item.optionSummary && (
          <Text style={styles.itemOptions} maxFontSizeMultiplier={1.5}>
            {item.optionSummary}
          </Text>
        )}
        {item.sku && (
          <Text style={styles.itemSku} maxFontSizeMultiplier={1.5}>
            {item.sku}
          </Text>
        )}
        {item.properties?.note && (
          <View style={styles.itemNoteRow}>
            <MaterialIcons name="note" size={12} color={lightColors.textSecondary} />
            <Text style={styles.itemNote} numberOfLines={1} maxFontSizeMultiplier={1.5}>
              {item.properties.note}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.itemRight}>
        <Text style={styles.itemQty} maxFontSizeMultiplier={1.5}>
          ×{item.quantity}
        </Text>
        <Text style={styles.itemTotal} maxFontSizeMultiplier={1.5}>
          {formatMoney(multiplyMoney(item.price, item.quantity), currencyCode)}
        </Text>
      </View>
    </Pressable>

    {isSelected && (
      <View style={styles.actionStrip}>
        <Pressable
          style={state => [styles.actionButton, { minWidth: hitTarget.touchMin, minHeight: hitTarget.touchMin }, interactionStyle(state)]}
          onPress={() => onDecrement(item.id, item.quantity)}
          accessibilityLabel={`Decrease quantity of ${item.name}`}
          accessibilityRole="button"
        >
          <MaterialIcons name="remove" size={20} color={lightColors.primary} />
        </Pressable>
        <Text style={styles.actionQty} accessibilityLabel={`Quantity: ${item.quantity}`} maxFontSizeMultiplier={1.5}>
          {item.quantity}
        </Text>
        <Pressable
          style={state => [
            styles.actionButton,
            { minWidth: hitTarget.touchMin, minHeight: hitTarget.touchMin },
            isAtStockLimit(item) && styles.buttonDisabled,
            !isAtStockLimit(item) && interactionStyle(state),
          ]}
          onPress={() => onIncrement(item.id)}
          disabled={isAtStockLimit(item)}
          accessibilityLabel={`Increase quantity of ${item.name}`}
          accessibilityRole="button"
        >
          <MaterialIcons name="add" size={20} color={lightColors.primary} />
        </Pressable>

        <View style={styles.actionSpacer} />

        <Pressable
          style={state => [
            styles.actionButton,
            { minWidth: hitTarget.touchMin, minHeight: hitTarget.touchMin },
            isNoteEditing && styles.actionButtonActive,
            interactionStyle(state),
          ]}
          onPress={() => onToggleNoteEdit(item.id)}
          accessibilityLabel={`Note for ${item.name}`}
          accessibilityRole="button"
          accessibilityState={{ selected: isNoteEditing }}
        >
          <MaterialIcons name="note" size={20} color={isNoteEditing ? lightColors.textOnPrimary : lightColors.primary} />
        </Pressable>
        <Pressable
          style={state => [styles.actionButton, { minWidth: hitTarget.touchMin, minHeight: hitTarget.touchMin }, interactionStyle(state)]}
          onPress={() => onRemove(item.id)}
          accessibilityLabel={`Remove ${item.name} from cart`}
          accessibilityRole="button"
        >
          <MaterialIcons name="delete-outline" size={20} color={lightColors.error} />
        </Pressable>
      </View>
    )}

    {isNoteEditing && isSelected && (
      <View style={styles.noteEditor}>
        {noteChips.length > 0 && (
          <View style={styles.noteChipsRow}>
            {noteChips.map(chip => (
              <Pressable
                key={chip}
                style={state => [styles.noteChip, interactionStyle(state)]}
                onPress={() => onNoteChip(item.id, chip)}
                accessibilityRole="button"
              >
                <Text style={styles.noteChipText}>{chip}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <TextInput
          style={styles.noteInput}
          placeholder="Line note…"
          placeholderTextColor={lightColors.textHint}
          defaultValue={item.properties?.note ?? ''}
          autoFocus
          blurOnSubmit
          returnKeyType="done"
          onEndEditing={e => onNoteSubmit(item.id, e.nativeEvent.text)}
        />
      </View>
    )}
  </SwipeableLine>
);
