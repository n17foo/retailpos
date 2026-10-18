import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import type { ReceiptConfig } from '../../hardware/hooks/useReceiptConfig';
import { receiptSettingsStyles as styles } from './receiptSettingsStyles';

type ReceiptHeader = ReceiptConfig['header'];

interface ReceiptHeaderFormProps {
  header: ReceiptHeader;
  onChange: (updates: Partial<ReceiptHeader>) => void;
}

/** Receipt header fields — business name, address, phone, email, website, tax ID. */
export const ReceiptHeaderForm: React.FC<ReceiptHeaderFormProps> = ({ header, onChange }) => {
  const { t } = useTranslate();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('settings.receipt.headerTitle')}</Text>
      <Text style={styles.sectionDescription}>{t('settings.receipt.headerDescription')}</Text>

      <Text style={styles.inputLabel}>{t('settings.receipt.businessName')}</Text>
      <TextInput
        style={styles.input}
        value={header.businessName}
        onChangeText={text => onChange({ businessName: text })}
        placeholder={t('settings.receipt.businessNamePlaceholder')}
      />

      <Text style={styles.inputLabel}>{t('settings.receipt.addressLine1')}</Text>
      <TextInput
        style={styles.input}
        value={header.addressLine1}
        onChangeText={text => onChange({ addressLine1: text })}
        placeholder={t('settings.receipt.addressLine1Placeholder')}
      />

      <Text style={styles.inputLabel}>{t('settings.receipt.addressLine2')}</Text>
      <TextInput
        style={styles.input}
        value={header.addressLine2}
        onChangeText={text => onChange({ addressLine2: text })}
        placeholder={t('settings.receipt.addressLine2Placeholder')}
      />

      <Text style={styles.inputLabel}>{t('settings.receipt.phone')}</Text>
      <TextInput
        style={styles.input}
        value={header.phone}
        onChangeText={text => onChange({ phone: text })}
        placeholder={t('settings.receipt.phonePlaceholder')}
        keyboardType="phone-pad"
      />

      <Text style={styles.inputLabel}>{t('settings.receipt.email')}</Text>
      <TextInput
        style={styles.input}
        value={header.email}
        onChangeText={text => onChange({ email: text })}
        placeholder={t('settings.receipt.emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <Text style={styles.inputLabel}>{t('settings.receipt.website')}</Text>
      <TextInput
        style={styles.input}
        value={header.website}
        onChangeText={text => onChange({ website: text })}
        placeholder={t('settings.receipt.websitePlaceholder')}
        autoCapitalize="none"
      />

      <Text style={styles.inputLabel}>{t('settings.receipt.taxId')}</Text>
      <TextInput
        style={styles.input}
        value={header.taxId}
        onChangeText={text => onChange({ taxId: text })}
        placeholder={t('settings.receipt.taxIdPlaceholder')}
      />
    </View>
  );
};
