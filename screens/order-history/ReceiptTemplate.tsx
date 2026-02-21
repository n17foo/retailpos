import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LocalOrder } from '../../services/basket/BasketServiceInterface';
import { lightColors, spacing, typography, borderRadius } from '../../utils/theme';

interface ReceiptTemplateProps {
  order: LocalOrder;
  currencySymbol?: string;
  businessName?: string;
  businessAddress?: string;
  businessPhone?: string;
  footerLine1?: string;
  footerLine2?: string;
}

const ReceiptTemplate: React.FC<ReceiptTemplateProps> = ({
  order,
  currencySymbol = '$',
  businessName = 'RetailPOS',
  businessAddress,
  businessPhone,
  footerLine1 = 'Thank you for your purchase!',
  footerLine2,
}) => {
  const cs = currencySymbol;
  const subtotal = order.subtotal;
  const tax = order.tax || 0;
  const discount = order.discountAmount || 0;

  return (
    <View style={styles.receipt}>
      {/* ===== HEADER ===== */}
      <View style={styles.header}>
        <Text style={styles.businessName}>{businessName}</Text>
        {businessAddress && <Text style={styles.headerDetail}>{businessAddress}</Text>}
        {businessPhone && <Text style={styles.headerDetail}>Tel: {businessPhone}</Text>}
      </View>

      <View style={styles.divider} />

      {/* ===== ORDER INFO ===== */}
      <View style={styles.orderInfo}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Order #</Text>
          <Text style={styles.infoValue}>{order.id.slice(-8)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Date</Text>
          <Text style={styles.infoValue}>{order.createdAt.toLocaleDateString()}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Time</Text>
          <Text style={styles.infoValue}>{order.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
        </View>
        {order.cashierName && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cashier</Text>
            <Text style={styles.infoValue}>{order.cashierName}</Text>
          </View>
        )}
        {order.customerName && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Customer</Text>
            <Text style={styles.infoValue}>{order.customerName}</Text>
          </View>
        )}
      </View>

      <View style={styles.divider} />

      {/* ===== ITEMS ===== */}
      <View style={styles.itemsSection}>
        {order.items.map((item, index) => {
          const itemTotal = item.price * item.quantity;
          return (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                {item.quantity > 1 && (
                  <Text style={styles.itemQty}>
                    {item.quantity} x {cs}
                    {item.price.toFixed(2)}
                  </Text>
                )}
              </View>
              <Text style={styles.itemTotal}>
                {cs}
                {itemTotal.toFixed(2)}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.divider} />

      {/* ===== TOTALS (bold & larger) ===== */}
      <View style={styles.totalsSection}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal</Text>
          <Text style={styles.totalValue}>
            {cs}
            {subtotal.toFixed(2)}
          </Text>
        </View>

        {tax > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Tax</Text>
            <Text style={styles.totalValue}>
              {cs}
              {tax.toFixed(2)}
            </Text>
          </View>
        )}

        {discount > 0 && (
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, styles.discountText]}>Discount</Text>
            <Text style={[styles.totalValue, styles.discountText]}>
              -{cs}
              {discount.toFixed(2)}
            </Text>
          </View>
        )}

        <View style={styles.doubleDivider} />

        <View style={styles.totalRow}>
          <Text style={styles.grandTotalLabel}>TOTAL</Text>
          <Text style={styles.grandTotalValue}>
            {cs}
            {order.total.toFixed(2)}
          </Text>
        </View>

        <View style={styles.doubleDivider} />

        {order.paymentMethod && (
          <View style={[styles.totalRow, { marginTop: spacing.sm }]}>
            <Text style={styles.paymentLabel}>Payment</Text>
            <Text style={styles.paymentValue}>{order.paymentMethod}</Text>
          </View>
        )}
      </View>

      {/* ===== FOOTER ===== */}
      <View style={styles.footer}>
        <View style={styles.divider} />
        {footerLine1 && <Text style={styles.footerText}>{footerLine1}</Text>}
        {footerLine2 && <Text style={styles.footerText}>{footerLine2}</Text>}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  receipt: {
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  // Header
  header: {
    alignItems: 'center',
    paddingBottom: spacing.sm,
  },
  businessName: {
    fontSize: typography.fontSize.xl,
    fontWeight: '800',
    color: lightColors.textPrimary,
    textAlign: 'center',
  },
  headerDetail: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  // Dividers
  divider: {
    height: 1,
    backgroundColor: lightColors.border,
    marginVertical: spacing.sm,
  },
  doubleDivider: {
    height: 3,
    backgroundColor: lightColors.textPrimary,
    marginVertical: spacing.xs,
  },
  // Order info
  orderInfo: {
    gap: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  infoValue: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textPrimary,
    fontWeight: '500',
  },
  // Items
  itemsSection: {
    gap: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  itemName: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    fontWeight: '500',
  },
  itemQty: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  itemTotal: {
    fontSize: typography.fontSize.md,
    color: lightColors.textPrimary,
    fontWeight: '500',
  },
  // Totals - bold & larger
  totalsSection: {
    paddingVertical: spacing.xs,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  totalLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  totalValue: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  discountText: {
    color: lightColors.error,
  },
  grandTotalLabel: {
    fontSize: typography.fontSize.xl,
    fontWeight: '800',
    color: lightColors.textPrimary,
  },
  grandTotalValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: '800',
    color: lightColors.textPrimary,
  },
  paymentLabel: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textSecondary,
  },
  paymentValue: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  // Footer
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  footerText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});

export default ReceiptTemplate;
