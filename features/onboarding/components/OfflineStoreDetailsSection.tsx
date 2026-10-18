import React from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList } from 'react-native';
import { CURRENCIES } from '../../../shared/utils/currency';
import { offlineSetupStyles as styles } from './offlineSetupStyles';

interface OfflineStoreDetailsSectionProps {
  storeName: string;
  storeAddress: string;
  currency: string;
  onStoreNameChange: (value: string) => void;
  onStoreAddressChange: (value: string) => void;
  onCurrencyChange: (code: string) => void;
}

/** Store Details section — name, tax-destination address, currency picker. */
export const OfflineStoreDetailsSection: React.FC<OfflineStoreDetailsSectionProps> = ({
  storeName,
  storeAddress,
  currency,
  onStoreNameChange,
  onStoreAddressChange,
  onCurrencyChange,
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Store Details</Text>
    <Text style={styles.inputLabel}>Store Name *</Text>
    <TextInput
      style={styles.input}
      value={storeName}
      onChangeText={onStoreNameChange}
      placeholder="My Local Store"
      autoCapitalize="words"
    />

    <Text style={styles.inputLabel}>Store Address (tax destination)</Text>
    <TextInput
      style={styles.input}
      value={storeAddress}
      onChangeText={onStoreAddressChange}
      placeholder="123 High Street, London"
      autoCapitalize="words"
    />

    <Text style={styles.inputLabel}>Currency</Text>
    <FlatList
      data={CURRENCIES}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={item => item.code}
      contentContainerStyle={styles.currencyRow}
      renderItem={({ item: cur }) => (
        <TouchableOpacity
          style={[styles.currencyChip, currency === cur.code && styles.currencyChipActive]}
          onPress={() => onCurrencyChange(cur.code)}
        >
          <Text style={[styles.currencyText, currency === cur.code && styles.currencyTextActive]}>
            {cur.symbol} {cur.code}
          </Text>
        </TouchableOpacity>
      )}
    />
  </View>
);
