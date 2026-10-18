import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { lightColors, interactionStyle } from '../../../shared/utils/theme';
import { formatMoney } from '../../../shared/utils/money';
import { StatusBadge } from '../../../shared/components/StatusBadge';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { basketPanelStyles as styles } from './basketPanelStyles';

interface BasketSummaryProps {
  unsyncedOrdersCount: number;
  isSyncing: boolean;
  onSync: () => void;
  subtotal: number;
  tax: number;
  total: number;
  /** Online platforms calculate tax for the whole basket when checkout starts */
  taxAtCheckout: boolean;
  error?: string | null;
  currencyCode: string;
}

/** Pinned summary — sync banner, subtotal/tax/total rows, tender error. */
export const BasketSummary: React.FC<BasketSummaryProps> = ({
  unsyncedOrdersCount,
  isSyncing,
  onSync,
  subtotal,
  tax,
  total,
  taxAtCheckout,
  error,
  currencyCode,
}) => {
  const { t } = useTranslate();
  return (
    <View style={styles.summary}>
      {unsyncedOrdersCount > 0 && (
        <Pressable style={state => [styles.syncBanner, !isSyncing && interactionStyle(state)]} onPress={onSync} disabled={isSyncing}>
          <StatusBadge status="pending" label={isSyncing ? 'Syncing...' : `${unsyncedOrdersCount} pending sync`} />
          {isSyncing && <ActivityIndicator size="small" color={lightColors.textOnPrimary} />}
        </Pressable>
      )}

      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel} maxFontSizeMultiplier={1.5}>
          Subtotal
        </Text>
        <Text style={styles.summaryValue} maxFontSizeMultiplier={1.5}>
          {formatMoney(subtotal, currencyCode)}
        </Text>
      </View>
      <View style={styles.summaryRow}>
        <Text style={styles.summaryLabel} maxFontSizeMultiplier={1.5}>
          Tax
        </Text>
        <Text style={styles.summaryValue} maxFontSizeMultiplier={1.5}>
          {taxAtCheckout ? t('basket.taxAtCheckout') : formatMoney(tax, currencyCode)}
        </Text>
      </View>
      <View style={[styles.summaryRow, styles.totalRow]}>
        <Text style={styles.totalLabel} maxFontSizeMultiplier={1.5}>
          {taxAtCheckout ? t('basket.totalBeforeTax') : 'Total'}
        </Text>
        <Text style={styles.totalValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.5}>
          {formatMoney(total, currencyCode)}
        </Text>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};
