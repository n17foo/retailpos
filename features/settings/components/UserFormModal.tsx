import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal } from 'react-native';
import PinKeypad from '../../authentication/components/PinKeypad';
import PinDisplay from '../../authentication/components/PinDisplay';
import { userSettingsStyles as styles } from './userSettingsStyles';
import { PIN_LENGTH, USER_ROLES, UserFormData } from '../utils/userFormData';

interface UserFormModalProps {
  visible: boolean;
  isEdit: boolean;
  formData: UserFormData;
  newPin: string;
  onFormChange: (data: UserFormData) => void;
  onNewPinChange: (pin: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

/** Add/Edit user modal — name, email, role, platform user ID, and (on add) PIN entry. */
export const UserFormModal: React.FC<UserFormModalProps> = ({
  visible,
  isEdit,
  formData,
  newPin,
  onFormChange,
  onNewPinChange,
  onCancel,
  onSubmit,
}) => (
  <Modal visible={visible} animationType="slide" transparent>
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>{isEdit ? 'Edit User' : 'Add New User'}</Text>

        <Text style={styles.inputLabel}>Name *</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={text => onFormChange({ ...formData, name: text })}
          placeholder="Enter name"
        />

        <Text style={styles.inputLabel}>Email</Text>
        <TextInput
          style={styles.input}
          value={formData.email}
          onChangeText={text => onFormChange({ ...formData, email: text })}
          placeholder="Enter email"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Text style={styles.inputLabel}>Role *</Text>
        <View style={styles.roleSelector}>
          {USER_ROLES.map(role => (
            <TouchableOpacity
              key={role.value}
              style={[styles.roleOption, formData.role === role.value && styles.roleOptionSelected]}
              onPress={() => onFormChange({ ...formData, role: role.value })}
            >
              <Text style={[styles.roleOptionText, formData.role === role.value && styles.roleOptionTextSelected]}>{role.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.inputLabel}>Platform User ID (for e-commerce sync)</Text>
        <TextInput
          style={styles.input}
          value={formData.platform_user_id}
          onChangeText={text => onFormChange({ ...formData, platform_user_id: text })}
          placeholder="Enter platform user ID"
          autoCapitalize="none"
        />

        {!isEdit && (
          <>
            <Text style={styles.inputLabel}>PIN * (6 digits)</Text>
            <View style={styles.pinInputContainer}>
              <PinDisplay pinLength={PIN_LENGTH} filledCount={newPin.length} />
              <PinKeypad
                onKeyPress={key => {
                  if (key === 'biometric') return;
                  if (newPin.length < PIN_LENGTH) onNewPinChange(newPin + key);
                }}
                onDeletePress={() => onNewPinChange(newPin.slice(0, -1))}
                disableBiometric
              />
            </View>
          </>
        )}

        <View style={styles.modalButtons}>
          <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={onSubmit}>
            <Text style={styles.saveButtonText}>{isEdit ? 'Save' : 'Create'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);
