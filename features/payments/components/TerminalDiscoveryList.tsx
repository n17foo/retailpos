import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { lightColors, spacing, typography, borderRadius } from '../../../shared/utils/theme';

export interface DiscoveredTerminal {
  id: string;
  name: string;
}

interface TerminalDiscoveryListProps {
  providerLabel: string;
  terminals: DiscoveredTerminal[];
  scanning: boolean;
  connecting: boolean;
  connectingTerminalId: string | null;
  hasError: boolean;
  onScan: () => void;
  onConnect: (terminalId: string, terminalName: string) => void;
}

/** Terminal scan/refresh header + discovered terminal list + empty state. */
export const TerminalDiscoveryList: React.FC<TerminalDiscoveryListProps> = ({
  providerLabel,
  terminals,
  scanning,
  connecting,
  connectingTerminalId,
  hasError,
  onScan,
  onConnect,
}) => (
  <View style={styles.terminalSelector}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{scanning ? 'Scanning for terminals…' : `${providerLabel} Terminals`}</Text>
      <TouchableOpacity
        style={styles.scanButton}
        onPress={onScan}
        disabled={scanning || connecting}
        accessibilityLabel="Scan for terminals"
        accessibilityRole="button"
      >
        {scanning ? (
          <ActivityIndicator size="small" color={lightColors.primary} />
        ) : (
          <MaterialIcons name="refresh" size={20} color={lightColors.primary} />
        )}
      </TouchableOpacity>
    </View>

    {!scanning && terminals.length === 0 && !hasError ? (
      <View style={styles.emptyState}>
        <MaterialIcons name="point-of-sale" size={48} color={lightColors.textDisabled} />
        <Text style={styles.emptyStateText}>No terminals found</Text>
        <Text style={styles.emptyStateHint}>Tap refresh to scan again</Text>
      </View>
    ) : null}

    <ScrollView showsVerticalScrollIndicator={false}>
      {terminals.map(terminal => {
        const isConnecting = connecting && connectingTerminalId === terminal.id;
        return (
          <TouchableOpacity
            key={terminal.id}
            style={[styles.terminalButton, isConnecting && styles.terminalButtonActive]}
            onPress={() => onConnect(terminal.id, terminal.name)}
            disabled={connecting}
            accessibilityLabel={`Connect to ${terminal.name}`}
            accessibilityRole="button"
          >
            <MaterialIcons name="point-of-sale" size={22} color={lightColors.textOnPrimary} />
            <View style={styles.terminalInfo}>
              <Text style={styles.terminalButtonText}>{terminal.name}</Text>
              <Text style={styles.terminalId}>{terminal.id}</Text>
            </View>
            {isConnecting ? (
              <ActivityIndicator size="small" color={lightColors.textOnPrimary} />
            ) : (
              <MaterialIcons name="chevron-right" size={22} color={lightColors.textOnPrimary} />
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </View>
);

const styles = StyleSheet.create({
  terminalSelector: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textSecondary,
  },
  scanButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
    gap: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: lightColors.textSecondary,
  },
  emptyStateHint: {
    fontSize: typography.fontSize.sm,
    color: lightColors.textDisabled,
  },
  terminalButton: {
    backgroundColor: lightColors.primary,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  terminalButtonActive: {
    backgroundColor: lightColors.primaryDark,
  },
  terminalInfo: {
    flex: 1,
  },
  terminalButtonText: {
    color: lightColors.textOnPrimary,
    fontSize: typography.fontSize.md,
    fontWeight: '600',
  },
  terminalId: {
    color: lightColors.textOnPrimary + 'AA',
    fontSize: typography.fontSize.xs,
    marginTop: 2,
  },
});
