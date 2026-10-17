import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../../shared/contexts/ThemeProvider';
import { Card } from '../../../shared/components/Card';
import { Button } from '../../../shared/components/Button';
import { useHardwareStatus } from '../hooks/useHardwareStatus';
import { spacing, typography, lightColors } from '../../../shared/utils/theme';
import { BasePrinterService } from '../services/printer/BasePrinterService';
import { ScannerServiceInterface } from '../services/scanner/ScannerServiceInterface';
import { CashDrawerServiceInterface } from '../services/drawer/CashDrawerServiceInterface';
import { KdsServiceInterface } from '../services/kds/KdsServiceInterface';
import { CustomerDisplayServiceInterface } from '../services/display/CustomerDisplayServiceInterface';

interface HardwareStatusScreenProps {
  printerService?: BasePrinterService | null;
  scannerService?: ScannerServiceInterface | null;
  drawerService?: CashDrawerServiceInterface | null;
  kdsService?: KdsServiceInterface | null;
  displayService?: CustomerDisplayServiceInterface | null;
  onNavigateToSettings?: (tab: string) => void;
}

/**
 * Hardware Status Dashboard
 *
 * Shows real-time status of all connected hardware:
 * - Printer (connected, paper status, errors)
 * - Scanner (connected, type)
 * - Cash Drawer (connected, open/closed)
 * - KDS (connected, last ticket)
 * - Customer Display (connected, type)
 */
export function HardwareStatusScreen({
  printerService,
  scannerService,
  drawerService,
  kdsService,
  displayService,
  onNavigateToSettings,
}: HardwareStatusScreenProps) {
  const { colors } = useTheme();
  const { status, isPolling, lastError, refresh } = useHardwareStatus(
    {
      printer: printerService,
      scanner: scannerService,
      drawer: drawerService,
      kds: kdsService,
      display: displayService,
    },
    10000 // Poll every 10 seconds
  );

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const getStatusColor = (connected: boolean, hasWarning?: boolean) => {
    if (!connected) return colors.error;
    if (hasWarning) return colors.warning;
    return colors.success;
  };

  const getStatusIcon = (connected: boolean, hasWarning?: boolean): keyof typeof MaterialIcons.glyphMap => {
    if (!connected) return 'cancel';
    if (hasWarning) return 'warning';
    return 'check-circle';
  };

  const formatLastChecked = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Hardware Status</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isPolling ? 'Monitoring all devices...' : 'Monitoring paused'}
          </Text>
        </View>
        <Button title="Refresh" onPress={handleRefresh} variant="secondary" style={styles.refreshButton} />
      </View>

      {lastError && (
        <View style={[styles.errorCard, { backgroundColor: colors.errorBackground }]}>
          <MaterialIcons name="error" size={20} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{lastError}</Text>
        </View>
      )}

      {/* Printer Status */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialIcons name="print" size={24} color={colors.textPrimary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Receipt Printer</Text>
          </View>
          <MaterialIcons
            name={getStatusIcon(status.printer.connected, status.printer.status === 'paper_low')}
            size={24}
            color={getStatusColor(status.printer.connected, status.printer.status === 'paper_low')}
          />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Status:</Text>
            <Text style={[styles.statusValue, { color: colors.textPrimary }]}>
              {status.printer.connected ? status.printer.status || 'Ready' : 'Disconnected'}
            </Text>
          </View>
          {status.printer.message && (
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Message:</Text>
              <Text style={[styles.statusValue, { color: colors.textPrimary }]}>{status.printer.message}</Text>
            </View>
          )}
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Last Checked:</Text>
            <Text style={[styles.statusValue, { color: colors.textSecondary }]}>{formatLastChecked(status.printer.lastChecked)}</Text>
          </View>
        </View>
        {onNavigateToSettings && (
          <TouchableOpacity style={styles.configureButton} onPress={() => onNavigateToSettings('printer')}>
            <Text style={[styles.configureButtonText, { color: colors.primary }]}>Configure Printer</Text>
            <MaterialIcons name="chevron-right" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </Card>

      {/* Scanner Status */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialIcons name="qr-code-scanner" size={24} color={colors.textPrimary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Barcode Scanner</Text>
          </View>
          <MaterialIcons name={getStatusIcon(status.scanner.connected)} size={24} color={getStatusColor(status.scanner.connected)} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Status:</Text>
            <Text style={[styles.statusValue, { color: colors.textPrimary }]}>
              {status.scanner.connected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
          {status.scanner.type && (
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Type:</Text>
              <Text style={[styles.statusValue, { color: colors.textPrimary }]}>{status.scanner.type.replace('_', ' ').toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Last Checked:</Text>
            <Text style={[styles.statusValue, { color: colors.textSecondary }]}>{formatLastChecked(status.scanner.lastChecked)}</Text>
          </View>
        </View>
        {onNavigateToSettings && (
          <TouchableOpacity style={styles.configureButton} onPress={() => onNavigateToSettings('scanner')}>
            <Text style={[styles.configureButtonText, { color: colors.primary }]}>Configure Scanner</Text>
            <MaterialIcons name="chevron-right" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </Card>

      {/* Cash Drawer Status */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialIcons name="point-of-sale" size={24} color={colors.textPrimary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Cash Drawer</Text>
          </View>
          <MaterialIcons
            name={getStatusIcon(status.drawer.connected, status.drawer.isOpen)}
            size={24}
            color={getStatusColor(status.drawer.connected, status.drawer.isOpen)}
          />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Status:</Text>
            <Text style={[styles.statusValue, { color: colors.textPrimary }]}>
              {status.drawer.connected ? 'Connected' : 'Not Configured'}
            </Text>
          </View>
          {status.drawer.isOpen !== undefined && (
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Drawer:</Text>
              <Text style={[styles.statusValue, styles.statusValueBold, { color: status.drawer.isOpen ? colors.warning : colors.success }]}>
                {status.drawer.isOpen ? 'OPEN' : 'Closed'}
              </Text>
            </View>
          )}
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Last Checked:</Text>
            <Text style={[styles.statusValue, { color: colors.textSecondary }]}>{formatLastChecked(status.drawer.lastChecked)}</Text>
          </View>
        </View>
        {onNavigateToSettings && (
          <TouchableOpacity style={styles.configureButton} onPress={() => onNavigateToSettings('drawer')}>
            <Text style={[styles.configureButtonText, { color: colors.primary }]}>Configure Drawer</Text>
            <MaterialIcons name="chevron-right" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </Card>

      {/* KDS Status */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialIcons name="restaurant" size={24} color={colors.textPrimary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Kitchen Display</Text>
          </View>
          <MaterialIcons name={getStatusIcon(status.kds.connected)} size={24} color={getStatusColor(status.kds.connected)} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Status:</Text>
            <Text style={[styles.statusValue, { color: colors.textPrimary }]}>{status.kds.connected ? 'Connected' : 'Disconnected'}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Last Checked:</Text>
            <Text style={[styles.statusValue, { color: colors.textSecondary }]}>{formatLastChecked(status.kds.lastChecked)}</Text>
          </View>
        </View>
        {onNavigateToSettings && (
          <TouchableOpacity style={styles.configureButton} onPress={() => onNavigateToSettings('kds')}>
            <Text style={[styles.configureButtonText, { color: colors.primary }]}>Configure KDS</Text>
            <MaterialIcons name="chevron-right" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </Card>

      {/* Customer Display Status */}
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            <MaterialIcons name="tv" size={24} color={colors.textPrimary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Customer Display</Text>
          </View>
          <MaterialIcons name={getStatusIcon(status.display.connected)} size={24} color={getStatusColor(status.display.connected)} />
        </View>
        <View style={styles.cardContent}>
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Status:</Text>
            <Text style={[styles.statusValue, { color: colors.textPrimary }]}>
              {status.display.connected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
          {status.display.type && (
            <View style={styles.statusRow}>
              <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Type:</Text>
              <Text style={[styles.statusValue, { color: colors.textPrimary }]}>{status.display.type.replace('_', ' ').toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.statusRow}>
            <Text style={[styles.statusLabel, { color: colors.textSecondary }]}>Last Checked:</Text>
            <Text style={[styles.statusValue, { color: colors.textSecondary }]}>{formatLastChecked(status.display.lastChecked)}</Text>
          </View>
        </View>
        {onNavigateToSettings && (
          <TouchableOpacity style={styles.configureButton} onPress={() => onNavigateToSettings('display')}>
            <Text style={[styles.configureButtonText, { color: colors.primary }]}>Configure Display</Text>
            <MaterialIcons name="chevron-right" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </Card>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>Status updates every 10 seconds • Pull to refresh</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    marginTop: 4,
  },
  refreshButton: {
    paddingHorizontal: spacing.md,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: 8,
  },
  errorText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
  },
  card: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
  },
  cardContent: {
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: typography.fontSize.sm,
  },
  statusValue: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
  },
  statusValueBold: {
    fontWeight: '600',
  },
  configureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: lightColors.border,
  },
  configureButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  footer: {
    padding: spacing.md,
    alignItems: 'center',
  },
  footerText: {
    fontSize: typography.fontSize.xs,
  },
});
