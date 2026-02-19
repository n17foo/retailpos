import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Share } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';
import { formatMoney } from '../utils/money';
import { useReporting } from '../hooks/useReporting';
import { useCurrency } from '../hooks/useCurrency';
import { SalesByPeriod, CashierPerformance, PaymentBreakdown } from '../services/reporting/ReportingService';

type DateRange = 'today' | 'yesterday' | 'week' | 'month';

const getDateRange = (range: DateRange): { from: number; to: number } => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEnd = todayStart + 86400000;

  switch (range) {
    case 'today':
      return { from: todayStart, to: todayEnd };
    case 'yesterday':
      return { from: todayStart - 86400000, to: todayStart };
    case 'week':
      return { from: todayStart - 7 * 86400000, to: todayEnd };
    case 'month':
      return { from: todayStart - 30 * 86400000, to: todayEnd };
  }
};

const ReportingScreen: React.FC = () => {
  const currency = useCurrency();
  const {
    summary,
    salesByHour,
    salesByDay,
    cashierPerformance,
    paymentBreakdown,
    isLoading,
    error,
    loadReport,
    loadHourlyReport,
    exportCsv,
  } = useReporting();

  const [selectedRange, setSelectedRange] = useState<DateRange>('today');

  const loadData = useCallback(() => {
    const { from, to } = getDateRange(selectedRange);
    if (selectedRange === 'today' || selectedRange === 'yesterday') {
      loadHourlyReport(from, to);
    } else {
      loadReport(from, to);
    }
  }, [selectedRange, loadReport, loadHourlyReport]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = useCallback(async () => {
    const { from, to } = getDateRange(selectedRange);
    try {
      const csv = await exportCsv(from, to);
      await Share.share({ message: csv, title: `Sales Report - ${selectedRange}` });
    } catch {
      Alert.alert('Export Failed', 'Could not export the report.');
    }
  }, [selectedRange, exportCsv]);

  const salesData = selectedRange === 'today' || selectedRange === 'yesterday' ? salesByHour : salesByDay;
  const maxSales = Math.max(...salesData.map(d => d.totalSales), 1);

  if (isLoading && !summary) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={lightColors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Date range selector */}
      <View style={styles.rangeRow}>
        {(['today', 'yesterday', 'week', 'month'] as DateRange[]).map(range => (
          <TouchableOpacity
            key={range}
            style={[styles.rangeButton, selectedRange === range && styles.rangeButtonActive]}
            onPress={() => setSelectedRange(range)}
          >
            <Text style={[styles.rangeText, selectedRange === range && styles.rangeTextActive]}>
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.exportButton} onPress={handleExport}>
          <MaterialIcons name="file-download" size={18} color={lightColors.primary} />
          <Text style={styles.exportText}>CSV</Text>
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Summary cards */}
      {summary && (
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total Sales</Text>
            <Text style={styles.summaryValue}>{formatMoney(summary.totalSales, currency.code)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Orders</Text>
            <Text style={styles.summaryValue}>{summary.totalOrders}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Avg Order</Text>
            <Text style={styles.summaryValue}>{formatMoney(summary.averageOrderValue, currency.code)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Tax</Text>
            <Text style={styles.summaryValue}>{formatMoney(summary.totalTax, currency.code)}</Text>
          </View>
        </View>
      )}

      {/* Simple bar chart */}
      {salesData.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sales by {selectedRange === 'today' || selectedRange === 'yesterday' ? 'Hour' : 'Day'}</Text>
          <View style={styles.chartContainer}>
            {salesData
              .filter(d => d.totalSales > 0 || d.orderCount > 0)
              .map((d, i) => (
                <View key={i} style={styles.barRow}>
                  <Text style={styles.barLabel}>{d.label}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${Math.max((d.totalSales / maxSales) * 100, 2)}%` }]} />
                  </View>
                  <Text style={styles.barValue}>{formatMoney(d.totalSales, currency.code)}</Text>
                </View>
              ))}
          </View>
        </View>
      )}

      {/* Payment breakdown */}
      {paymentBreakdown.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Methods</Text>
          {paymentBreakdown.map((p, i) => (
            <View key={i} style={styles.breakdownRow}>
              <Text style={styles.breakdownMethod}>{p.method || 'Unknown'}</Text>
              <Text style={styles.breakdownCount}>{p.count} orders</Text>
              <Text style={styles.breakdownTotal}>{formatMoney(p.total, currency.code)}</Text>
              <Text style={styles.breakdownPercent}>{p.percentage}%</Text>
            </View>
          ))}
        </View>
      )}

      {/* Cashier performance */}
      {cashierPerformance.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cashier Performance</Text>
          {cashierPerformance.map((c, i) => (
            <View key={i} style={styles.cashierRow}>
              <View style={styles.cashierInfo}>
                <Text style={styles.cashierName}>{c.cashierName}</Text>
                <Text style={styles.cashierOrders}>{c.orderCount} orders</Text>
              </View>
              <View style={styles.cashierStats}>
                <Text style={styles.cashierTotal}>{formatMoney(c.totalSales, currency.code)}</Text>
                <Text style={styles.cashierAvg}>avg {formatMoney(c.averageOrderValue, currency.code)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  content: {
    padding: spacing.md,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  rangeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: lightColors.surface,
  },
  rangeButtonActive: {
    backgroundColor: lightColors.primary,
  },
  rangeText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.textSecondary,
  },
  rangeTextActive: {
    color: lightColors.textOnPrimary,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: lightColors.primary,
  },
  exportText: {
    fontSize: typography.fontSize.sm,
    color: lightColors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
  errorBox: {
    backgroundColor: lightColors.error + '10',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    color: lightColors.error,
    fontSize: typography.fontSize.sm,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  summaryCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...elevation.low,
  },
  summaryLabel: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
  },
  summaryValue: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginTop: spacing.xs,
  },
  section: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...elevation.low,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginBottom: spacing.md,
  },
  chartContainer: {
    gap: spacing.xs,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  barLabel: {
    width: 50,
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
  },
  barTrack: {
    flex: 1,
    height: 16,
    backgroundColor: lightColors.background,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginHorizontal: spacing.xs,
  },
  barFill: {
    height: '100%',
    backgroundColor: lightColors.primary,
    borderRadius: borderRadius.sm,
  },
  barValue: {
    width: 70,
    fontSize: typography.fontSize.xs,
    color: lightColors.textPrimary,
    fontWeight: '600',
    textAlign: 'right',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  breakdownMethod: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.textPrimary,
    textTransform: 'capitalize',
  },
  breakdownCount: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    marginRight: spacing.md,
  },
  breakdownTotal: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginRight: spacing.sm,
  },
  breakdownPercent: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textSecondary,
    width: 40,
    textAlign: 'right',
  },
  cashierRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  cashierInfo: {
    flex: 1,
  },
  cashierName: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  cashierOrders: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  cashierStats: {
    alignItems: 'flex-end',
  },
  cashierTotal: {
    fontSize: typography.fontSize.sm,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
  cashierAvg: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    marginTop: 2,
  },
});

export default ReportingScreen;
