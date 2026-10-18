import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import type { ReceiptConfig } from '../../hardware/hooks/useReceiptConfig';
import { receiptSettingsStyles as styles } from './receiptSettingsStyles';

type ReceiptFooter = ReceiptConfig['footer'];

interface ReceiptFooterFormProps {
  footer: ReceiptFooter;
  onChange: (updates: Partial<ReceiptFooter>) => void;
}

/** Receipt footer fields — three free-text lines. */
export const ReceiptFooterForm: React.FC<ReceiptFooterFormProps> = ({ footer, onChange }) => {
  const { t } = useTranslate();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('settings.receipt.footerTitle')}</Text>
      <Text style={styles.sectionDescription}>{t('settings.receipt.footerDescription')}</Text>

      <Text style={styles.inputLabel}>{t('settings.receipt.footerLine1')}</Text>
      <TextInput
        style={styles.input}
        value={footer.line1}
        onChangeText={text => onChange({ line1: text })}
        placeholder={t('settings.receipt.footerLine1Placeholder')}
      />

      <Text style={styles.inputLabel}>{t('settings.receipt.footerLine2')}</Text>
      <TextInput
        style={styles.input}
        value={footer.line2}
        onChangeText={text => onChange({ line2: text })}
        placeholder={t('settings.receipt.footerLine2Placeholder')}
      />

      <Text style={styles.inputLabel}>{t('settings.receipt.footerLine3')}</Text>
      <TextInput
        style={styles.input}
        value={footer.line3}
        onChangeText={text => onChange({ line3: text })}
        placeholder={t('settings.receipt.footerLine3Placeholder')}
      />
    </View>
  );
};
