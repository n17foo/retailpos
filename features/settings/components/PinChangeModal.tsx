import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import PinKeypad from '../../authentication/components/PinKeypad';
import PinDisplay from '../../authentication/components/PinDisplay';
import { userSettingsStyles as styles } from './userSettingsStyles';
import { PIN_LENGTH } from '../utils/userFormData';

export type PinEntryStep = 'enter' | 'confirm';

interface PinChangeModalProps {
  visible: boolean;
  userName: string | undefined;
  pinStep: PinEntryStep;
  newPin: string;
  confirmPin: string;
  onKeyPress: (key: string) => void;
  onDelete: () => void;
  onCancel: () => void;
  onBack: () => void;
}

/** Change-PIN modal — two-step enter/confirm PIN entry with keypad. */
export const PinChangeModal: React.FC<PinChangeModalProps> = ({
  visible,
  userName,
  pinStep,
  newPin,
  confirmPin,
  onKeyPress,
  onDelete,
  onCancel,
  onBack,
}) => (
  <Modal visible={visible} animationType="slide" transparent>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>{pinStep === 'enter' ? 'Enter New PIN' : 'Confirm New PIN'}</Text>
        <Text style={styles.modalSubtitle}>{userName}</Text>

        <View style={styles.pinInputContainer}>
          <PinDisplay pinLength={PIN_LENGTH} filledCount={pinStep === 'enter' ? newPin.length : confirmPin.length} />
          <PinKeypad onKeyPress={onKeyPress} onDeletePress={onDelete} disableBiometric />
        </View>

        <View style={styles.modalButtons}>
          <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          {pinStep === 'confirm' && (
            <TouchableOpacity style={[styles.modalButton, styles.backButton]} onPress={onBack}>
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  </Modal>
);
