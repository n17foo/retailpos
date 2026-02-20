import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { lightColors, spacing, borderRadius, typography, elevation, semanticColors } from '../../utils/theme';
import { useResponsive } from '../../hooks/useResponsive';
import { useTranslate } from '../../hooks/useTranslate';

interface PlatformInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  popular?: boolean;
  brandColor: string;
}

const PLATFORMS: Omit<PlatformInfo, 'description'>[] = [
  { id: 'shopify', name: 'Shopify', icon: '🛍', popular: true, brandColor: semanticColors.shopify },
  { id: 'woocommerce', name: 'WooCommerce', icon: '🔌', popular: true, brandColor: semanticColors.woocommerce },
  { id: 'bigcommerce', name: 'BigCommerce', icon: '🏪', brandColor: semanticColors.bigcommerce },
  { id: 'magento', name: 'Magento', icon: '🧲', brandColor: semanticColors.magento },
  { id: 'sylius', name: 'Sylius', icon: '🧩', brandColor: semanticColors.sylius },
  { id: 'wix', name: 'Wix', icon: '✨', brandColor: semanticColors.wix },
  { id: 'prestashop', name: 'PrestaShop', icon: '🛒', brandColor: semanticColors.prestashop },
  { id: 'squarespace', name: 'Squarespace', icon: '◼️', brandColor: semanticColors.squarespace },
  { id: 'offline', name: 'Offline Mode', icon: '📴', brandColor: semanticColors.offline },
];

interface PlatformSelectionStepProps {
  onSelectPlatform: (platformId: string) => void;
}

const PlatformSelectionStep: React.FC<PlatformSelectionStepProps> = ({ onSelectPlatform }) => {
  const { isTabletOrDesktop } = useResponsive();
  const { t } = useTranslate();

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('platformSelection.title')}</Text>
        <Text style={styles.subtitle}>{t('platformSelection.subtitle')}</Text>

        <View style={[styles.platformGrid, isTabletOrDesktop && styles.platformGridWide]}>
          {PLATFORMS.map(platform => (
            <TouchableOpacity
              key={platform.id}
              style={[styles.platformCard, isTabletOrDesktop && styles.platformCardWide]}
              onPress={() => onSelectPlatform(platform.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: platform.brandColor + '18' }]}>
                <Text style={styles.platformIcon}>{platform.icon}</Text>
              </View>
              <Text style={styles.platformName}>{platform.name}</Text>
              <Text style={styles.platformDescription}>{t(`platformSelection.platforms.${platform.id}`)}</Text>
              {platform.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>{t('platformSelection.popular')}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize.xxl,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
    color: lightColors.textPrimary,
  },
  subtitle: {
    fontSize: typography.fontSize.md,
    color: lightColors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
    maxWidth: 400,
    lineHeight: 22,
  },
  platformGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  platformGridWide: {
    maxWidth: 720,
  },
  platformCard: {
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    width: '47%',
    minHeight: 140,
    ...elevation.low,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  platformCardWide: {
    width: '30%',
    minHeight: 160,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  platformIcon: {
    fontSize: 24,
  },
  platformName: {
    fontSize: typography.fontSize.md,
    fontWeight: '600',
    color: lightColors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  platformDescription: {
    fontSize: typography.fontSize.xs,
    color: lightColors.textSecondary,
    textAlign: 'center',
  },
  popularBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: lightColors.success,
    borderRadius: borderRadius.round,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  },
  popularText: {
    fontSize: 10,
    fontWeight: '700',
    color: lightColors.textOnPrimary,
  },
});

export default PlatformSelectionStep;
