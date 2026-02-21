import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius } from '../../utils/theme';
import { formatMoney } from '../../utils/money';
import { DailyReportData } from '../../hooks/useDailyReport';
import { useCurrency } from '../../hooks/useCurrency';

interface ReportModalProps {
  visible: boolean;
  report: DailyReportData | null;
  onPrint: () => void;
  onClose: () => void;
}

const ReportRow: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <View style={styles.reportRow}>
    <Text style={styles.reportLabel}>{label}</Text>
    <Text style={[styles.reportValue, highlight && styles.reportHighlight]}>{value}</Text>
  </View>
);

export const ReportModal: React.FC<ReportModalProps> = ({ visible, report, onClose, onPrint }) => {
  const currency = useCurrency();

  const paymentEntries = report ? Object.entries(report.summary.paymentBreakdown) : [];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.reportModalContent}>
          <Text style={styles.modalTitle}>Shift Report</Text>
          {report && (
            <Text style={styles.modalDate}>
              {report.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
          )}

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {report && (
              <>
                {/* Sales Summary */}
                <Text style={styles.sectionTitle}>Sales Summary</Text>
                <View style={styles.reportSummary}>
                  <ReportRow label="Total Orders" value={String(report.summary.totalOrders)} />
                  <ReportRow label="Items Sold" value={String(report.summary.itemsSold)} />
                  <ReportRow label="Avg Order Value" value={formatMoney(report.summary.averageOrderValue, currency.code)} />
                  <View style={styles.divider} />
                  <ReportRow label="Gross Sales" value={formatMoney(report.summary.totalSales, currency.code)} />
                  <ReportRow label="Tax Collected" value={formatMoney(report.summary.totalTax, currency.code)} />
                  {report.summary.totalDiscount > 0 && (
                    <ReportRow label="Discounts" value={`-${formatMoney(report.summary.totalDiscount, currency.code)}`} />
                  )}
                  <View style={styles.divider} />
                  <ReportRow label="Net Sales" value={formatMoney(report.summary.netSales, currency.code)} highlight />
                </View>

                {/* Payment Breakdown */}
                {paymentEntries.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Payment Breakdown</Text>
                    <View style={styles.reportSummary}>
                      {paymentEntries.map(([method, data]) => (
                        <ReportRow
                          key={method}
                          label={`${method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} (${data.count})`}
                          value={formatMoney(data.total, currency.code)}
                        />
                      ))}
                    </View>
                  </>
                )}

                {/* Refunds */}
                {report.summary.refunds > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Refunds</Text>
                    <View style={styles.reportSummary}>
                      <ReportRow label="Refund Count" value={String(report.summary.refunds)} />
                      <ReportRow label="Refund Amount" value={formatMoney(report.summary.refundAmount, currency.code)} />
                    </View>
                  </>
                )}

                {/* Shift Info */}
                {report.shift && (
                  <>
                    <Text style={styles.sectionTitle}>Shift</Text>
                    <View style={styles.reportSummary}>
                      <ReportRow label="Cashier" value={report.shift.cashierName} />
                      <ReportRow
                        label="Opened"
                        value={new Date(report.shift.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      />
                      {report.shift.endTime && (
                        <ReportRow
                          label="Closed"
                          value={new Date(report.shift.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        />
                      )}
                      <ReportRow label="Opening Cash" value={formatMoney(report.shift.openingCash, currency.code)} />
                      {report.shift.closingCash !== null && (
                        <ReportRow label="Closing Cash" value={formatMoney(report.shift.closingCash, currency.code)} />
                      )}
                    </View>
                  </>
                )}
              </>
            )}
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancelButton} onPress={onClose}>
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.printReportButton} onPress={onPrint}>
              <MaterialIcons name="print" size={18} color={lightColors.surface} />
              <Text style={styles.printReportText}>Print Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportModalContent: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '92%',
    maxWidth: 480,
    maxHeight: '88%',
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  modalDate: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  scroll: {
    maxHeight: 480,
    marginVertical: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: lightColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  reportSummary: {
    backgroundColor: lightColors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: lightColors.border,
    marginVertical: spacing.xs,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  reportLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    flex: 1,
  },
  reportValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  reportHighlight: {
    fontSize: typography.fontSize.md,
    color: lightColors.success,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: lightColors.divider,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  printReportButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: lightColors.success,
  },
  printReportText: {
    marginLeft: spacing.xs,
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.surface,
  },
});

export default ReportModal;
