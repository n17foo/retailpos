import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import { PRINTER_MODELS, PrinterModelType, receiptSettingsStyles as styles } from './receiptSettingsStyles';

interface PrinterModelSectionProps {
  selectedModel: PrinterModelType;
  onModelChange: (model: PrinterModelType) => void;
}

/** Printer model selection grid (SNBC Orient / Epson / Star / Citizen / Generic). */
export const PrinterModelSection: React.FC<PrinterModelSectionProps> = ({ selectedModel, onModelChange }) => {
  const { t } = useTranslate();
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t('settings.receipt.printerModel')}</Text>
      <Text style={styles.sectionDescription}>{t('settings.receipt.printerModelDescription')}</Text>
      <View style={styles.modelGrid}>
        {PRINTER_MODELS.map(model => (
          <TouchableOpacity
            key={model.value}
            style={[styles.modelOption, selectedModel === model.value && styles.modelOptionSelected]}
            onPress={() => onModelChange(model.value)}
          >
            <Text style={[styles.modelText, selectedModel === model.value && styles.modelTextSelected]}>{model.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
