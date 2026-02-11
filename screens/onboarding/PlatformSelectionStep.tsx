import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { lightColors, spacing, borderRadius, typography, elevation, semanticColors } from '../../utils/theme';
import { useResponsive } from '../../hooks/useResponsive';

interface PlatformInfo {
  id: string;
  name: string;
  icon: string;
  description: string;
  popular?: boolean;
  brandColor: string;
}

const PLATFORMS: PlatformInfo[] = [
  { id: 'shopify', name: 'Shopify', icon: '🛍', description: 'Best for most stores', popular: true, brandColor: semanticColors.shopify },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    icon: '🔌',
    description: 'WordPress e-commerce',
    popular: true,
    brandColor: semanticColors.woocommerce,
  },
  { id: 'bigcommerce', name: 'BigCommerce', icon: '🏪', description: 'Enterprise e-commerce', brandColor: semanticColors.bigcommerce },
  { id: 'magento', name: 'Magento', icon: '🧲', description: 'Adobe Commerce', brandColor: semanticColors.magento },
  { id: 'sylius', name: 'Sylius', icon: '🧩', description: 'Open-source & flexible', brandColor: semanticColors.sylius },
  { id: 'wix', name: 'Wix', icon: '✨', description: 'Simple website builder', brandColor: semanticColors.wix },
  { id: 'prestashop', name: 'PrestaShop', icon: '🛒', description: 'Open-source e-commerce', brandColor: semanticColors.prestashop },
  { id: 'squarespace', name: 'Squarespace', icon: '◼️', description: 'Design-first platform', brandColor: semanticColors.squarespace },
  { id: 'offline', name: 'Offline Mode', icon: '📴', description: 'No online store needed', brandColor: semanticColors.offline },
];

interface PlatformSelectionStepProps {
  onSelectPlatform: (platformId: string) => void;
}

const PlatformSelectionStep: React.FC<PlatformSelectionStepProps> = ({ onSelectPlatform }) => {
  const { isTabletOrDesktop } = useResponsive();

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <Text style={styles.title}>Select Your E-Commerce Platform</Text>
        <Text style={styles.subtitle}>
          Choose the platform your online store is built on, or select Offline Mode to get started without one.
        </Text>

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
              <Text style={styles.platformDescription}>{platform.description}</Text>
              {platform.popular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularText}>Popular</Text>
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
