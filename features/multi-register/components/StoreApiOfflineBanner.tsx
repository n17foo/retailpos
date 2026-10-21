import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useStoreApiHealth } from '../hooks/useStoreApiHealth';
import { instoreApiConfig } from '../services/InstoreApiConfig';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { lightColors, spacing, typography } from '../../../shared/utils/theme';

/**
 * Persistent warning strip shown on client registers while the in-store
 * server is unreachable. Sales keep working (cash only, last-known catalogue)
 * and queued orders upload automatically when the LAN recovers.
 */
export const StoreApiOfflineBanner: React.FC = () => {
  const { isDegraded } = useStoreApiHealth();
  const { t } = useTranslate();

  if (!instoreApiConfig.isClient || !isDegraded) return null;

  return (
    <View style={styles.banner} pointerEvents="none">
      <MaterialIcons name="cloud-off" size={16} color={lightColors.warningText} />
      <Text style={styles.text}>
        {t('multiRegister.offlineBanner', {
          defaultValue: 'No connection to the store server — selling in offline mode. Sales upload automatically when the network returns.',
        })}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: lightColors.warningBackground,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  text: {
    fontSize: typography.fontSize.xs,
    fontWeight: typography.fontWeight.medium as '500',
    color: lightColors.warningText,
  },
});
