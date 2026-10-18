import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ECommercePlatform } from '../../../shared/utils/platforms';
import { settingsFieldStyles as styles } from './settingsFieldStyles';

const PLATFORM_NAMES: Record<string, string> = {
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
  bigcommerce: 'BigCommerce',
  magento: 'Magento',
  sylius: 'Sylius',
  wix: 'Wix',
  prestashop: 'PrestaShop',
  commercefull: 'Commercefull',
  offline: 'Offline',
};

interface PlatformRadioGroupProps {
  selected: string;
  onSelect: (platform: ECommercePlatform) => void;
}

/** Radio list of supported e-commerce platforms. */
export const PlatformRadioGroup: React.FC<PlatformRadioGroupProps> = ({ selected, onSelect }) => (
  <View style={styles.radioContainer}>
    {Object.keys(PLATFORM_NAMES).map(platform => (
      <View key={platform} style={styles.radioWrapper}>
        <TouchableOpacity style={styles.radioOuter} onPress={() => onSelect(platform as ECommercePlatform)}>
          {selected === platform && <View style={styles.radioInner} />}
        </TouchableOpacity>
        <Text style={styles.radioLabel} onPress={() => onSelect(platform as ECommercePlatform)}>
          {PLATFORM_NAMES[platform]}
        </Text>
      </View>
    ))}
  </View>
);
