import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslate } from '../../../shared/hooks/useTranslate';
import type { ReceiptConfig } from '../../hardware/hooks/useReceiptConfig';
import { PAPER_WIDTHS, receiptSettingsStyles as styles } from './receiptSettingsStyles';

type ReceiptOptions = ReceiptConfig['options'];

interface ReceiptPrintOptionsSectionProps {
  options: ReceiptOptions;
  onChange: (updates: Partial<ReceiptOptions>) => void;
}

/** Paper width radio + print-option toggles + copies stepper. */
export const ReceiptPrintOptionsSection: React.FC<ReceiptPrintOptionsSectionProps> = ({ options, onChange }) => {
  const { t } = useTranslate();
  return (
    <>
      {/* Paper Width */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.receipt.paperWidth')}</Text>
        <View style={styles.radioGroup}>
          {PAPER_WIDTHS.map(width => (
            <TouchableOpacity key={width.value} style={styles.radioOption} onPress={() => onChange({ paperWidth: width.value })}>
              <View style={[styles.radioButton, options.paperWidth === width.value && styles.radioButtonSelected]}>
                {options.paperWidth === width.value && <View style={styles.radioButtonInner} />}
              </View>
              <Text style={styles.radioText}>{width.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Print Options */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.receipt.printOptions')}</Text>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>{t('settings.receipt.printBarcode')}</Text>
          <TouchableOpacity
            style={[styles.toggle, options.printBarcode && styles.toggleActive]}
            onPress={() => onChange({ printBarcode: !options.printBarcode })}
          >
            <Text style={styles.toggleText}>{options.printBarcode ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>{t('settings.receipt.printQRCode')}</Text>
          <TouchableOpacity
            style={[styles.toggle, options.printQRCode && styles.toggleActive]}
            onPress={() => onChange({ printQRCode: !options.printQRCode })}
          >
            <Text style={styles.toggleText}>{options.printQRCode ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>{t('settings.receipt.autoCutPaper')}</Text>
          <TouchableOpacity
            style={[styles.toggle, options.cutPaper && styles.toggleActive]}
            onPress={() => onChange({ cutPaper: !options.cutPaper })}
          >
            <Text style={styles.toggleText}>{options.cutPaper ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.optionRow}>
          <Text style={styles.optionLabel}>{t('settings.receipt.openCashDrawer')}</Text>
          <TouchableOpacity
            style={[styles.toggle, options.openCashDrawer && styles.toggleActive]}
            onPress={() => onChange({ openCashDrawer: !options.openCashDrawer })}
          >
            <Text style={styles.toggleText}>{options.openCashDrawer ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.inputLabel}>{t('settings.receipt.numberOfCopies')}</Text>
        <View style={styles.copiesContainer}>
          <TouchableOpacity style={styles.copiesButton} onPress={() => onChange({ copies: Math.max(1, options.copies - 1) })}>
            <Text style={styles.copiesButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.copiesValue}>{options.copies}</Text>
          <TouchableOpacity style={styles.copiesButton} onPress={() => onChange({ copies: Math.min(5, options.copies + 1) })}>
            <Text style={styles.copiesButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};
