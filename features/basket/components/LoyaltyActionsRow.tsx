import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, interactionStyle } from '../../../shared/utils/theme';
import { formatMoney } from '../../../shared/utils/money';
import { basketPanelStyles as styles } from './basketPanelStyles';
import type { LoyaltyBalance } from '../../customers/services/loyalty/LoyaltyService';
import type { ActiveRedemption } from '../hooks/useLoyaltyBasket';

interface LoyaltyActionsRowProps {
  loyaltyBalance?: LoyaltyBalance | null;
  storeCreditDollars: number;
  activeRedemption?: ActiveRedemption | null;
  isRedemptionLoading: boolean;
  currencyCode: string;
  onRedeemLoyalty: (points: number) => void;
  onRedeemStoreCredit: (dollars: number) => void;
  onReverseRedemption: () => void;
}

/** Loyalty points / store credit redemption buttons shown when a customer is attached. */
export const LoyaltyActionsRow: React.FC<LoyaltyActionsRowProps> = ({
  loyaltyBalance,
  storeCreditDollars,
  activeRedemption,
  isRedemptionLoading,
  currencyCode,
  onRedeemLoyalty,
  onRedeemStoreCredit,
  onReverseRedemption,
}) => (
  <View style={styles.loyaltyActions}>
    {loyaltyBalance && loyaltyBalance.points > 0 && !activeRedemption && (
      <Pressable
        style={state => [styles.loyaltyBtn, isRedemptionLoading && styles.buttonDisabled, interactionStyle(state)]}
        onPress={() => onRedeemLoyalty(loyaltyBalance.points)}
        disabled={isRedemptionLoading}
        accessibilityRole="button"
        accessibilityLabel={`Redeem ${loyaltyBalance.points} loyalty points`}
      >
        <MaterialIcons name="stars" size={14} color={lightColors.primary} />
        <Text style={styles.loyaltyBtnText}>
          Redeem {loyaltyBalance.points} pts ({formatMoney(loyaltyBalance.valueInCents / 100, currencyCode)})
        </Text>
      </Pressable>
    )}
    {storeCreditDollars > 0 && !activeRedemption && (
      <Pressable
        style={state => [styles.loyaltyBtn, isRedemptionLoading && styles.buttonDisabled, interactionStyle(state)]}
        onPress={() => onRedeemStoreCredit(storeCreditDollars)}
        disabled={isRedemptionLoading}
        accessibilityRole="button"
        accessibilityLabel={`Use ${formatMoney(storeCreditDollars, currencyCode)} store credit`}
      >
        <MaterialIcons name="card-giftcard" size={14} color={lightColors.success} />
        <Text style={[styles.loyaltyBtnText, { color: lightColors.success }]}>
          Use {formatMoney(storeCreditDollars, currencyCode)} store credit
        </Text>
      </Pressable>
    )}
    {activeRedemption && (
      <Pressable
        style={state => [styles.loyaltyReversalBtn, interactionStyle(state)]}
        onPress={onReverseRedemption}
        accessibilityRole="button"
        accessibilityLabel="Remove redemption"
      >
        <MaterialIcons name="undo" size={14} color={lightColors.warning} />
        <Text style={[styles.loyaltyBtnText, { color: lightColors.warning }]}>
          {activeRedemption.type === 'loyalty' ? 'Points' : 'Credit'} applied (−
          {formatMoney(activeRedemption.discountDollars, currencyCode)}) · Undo
        </Text>
      </Pressable>
    )}
  </View>
);
