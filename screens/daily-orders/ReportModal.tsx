import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius } from '../../utils/theme';
import { DailyReportData } from '../../hooks/useDailyReport';

interface ReportModalProps {
  visible: boolean;
  report: DailyReportData | null;
  onPrint: () => void;
  onClose: () => void;
}

const ReportModal: React.FC<ReportModalProps> = ({ visible, report, onPrint, onClose }) => {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.reportModalContent}>
          <Text style={styles.modalTitle}>Daily Sales Report</Text>

          {report && (
            <View style={styles.reportSummary}>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Total Orders:</Text>
                <Text style={styles.reportValue}>{report.summary.totalOrders}</Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Items Sold:</Text>
                <Text style={styles.reportValue}>{report.summary.itemsSold}</Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Gross Sales:</Text>
                <Text style={styles.reportValue}>${report.summary.totalSales.toFixed(2)}</Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Tax Collected:</Text>
                <Text style={styles.reportValue}>${report.summary.totalTax.toFixed(2)}</Text>
              </View>
              <View style={styles.reportRow}>
                <Text style={styles.reportLabel}>Net Sales:</Text>
                <Text style={[styles.reportValue, styles.reportTotal]}>${report.summary.netSales.toFixed(2)}</Text>
              </View>
            </View>
          )}

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
    width: '90%',
    maxWidth: 450,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  reportSummary: {
    backgroundColor: lightColors.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginVertical: spacing.md,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  reportLabel: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
  },
  reportValue: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  reportTotal: {
    fontSize: typography.fontSize.lg,
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
