import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Modal, Switch } from 'react-native';
import { useUsers, User, UserRole } from '../../hooks/useUsers';
import PinKeypad from '../../components/PinKeypad';
import PinDisplay from '../../components/PinDisplay';

const PIN_LENGTH = 6;

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrator' },
  { value: 'manager', label: 'Manager' },
  { value: 'cashier', label: 'Cashier' },
];

interface UserFormData {
  name: string;
  email: string;
  role: UserRole;
  platform_user_id: string;
}

const UsersSettingsTab: React.FC = () => {
  const { users, isLoading, error, loadUsers, createUser, updateUser, updatePin, deactivateUser, activateUser, deleteUser, isPinUnique } =
    useUsers();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    role: 'cashier',
    platform_user_id: '',
  });
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState<'enter' | 'confirm'>('enter');

  useEffect(() => {
    loadUsers();
  }, []);

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      role: 'cashier',
      platform_user_id: '',
    });
    setNewPin('');
    setConfirmPin('');
    setPinStep('enter');
  };

  const handleAddUser = () => {
    resetForm();
    setShowAddModal(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setFormData({
      name: user.name,
      email: user.email || '',
      role: user.role,
      platform_user_id: user.platform_user_id || '',
    });
    setShowEditModal(true);
  };

  const handleChangePin = (user: User) => {
    setSelectedUser(user);
    setNewPin('');
    setConfirmPin('');
    setPinStep('enter');
    setShowPinModal(true);
  };

  const handlePinKeyPress = (key: string) => {
    if (key === 'biometric') return;

    if (pinStep === 'enter') {
      if (newPin.length < PIN_LENGTH) {
        const updated = newPin + key;
        setNewPin(updated);
        if (updated.length === PIN_LENGTH) {
          setTimeout(() => setPinStep('confirm'), 300);
        }
      }
    } else {
      if (confirmPin.length < PIN_LENGTH) {
        const updated = confirmPin + key;
        setConfirmPin(updated);
        if (updated.length === PIN_LENGTH) {
          setTimeout(() => handleSavePin(updated), 300);
        }
      }
    }
  };

  const handlePinDelete = () => {
    if (pinStep === 'enter') {
      setNewPin(newPin.slice(0, -1));
    } else {
      setConfirmPin(confirmPin.slice(0, -1));
    }
  };

  const handleSavePin = async (confirmedPin: string) => {
    if (!selectedUser) return;

    if (newPin !== confirmedPin) {
      Alert.alert('Error', 'PINs do not match. Please try again.');
      setNewPin('');
      setConfirmPin('');
      setPinStep('enter');
      return;
    }

    const isUnique = await isPinUnique(newPin, selectedUser.id);
    if (!isUnique) {
      Alert.alert('Error', 'This PIN is already in use by another user.');
      setNewPin('');
      setConfirmPin('');
      setPinStep('enter');
      return;
    }

    const success = await updatePin(selectedUser.id, newPin);
    if (success) {
      Alert.alert('Success', 'PIN updated successfully.');
      setShowPinModal(false);
    }
  };

  const handleCreateUser = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Please enter a name.');
      return;
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    if (newPin.length !== PIN_LENGTH) {
      Alert.alert('Validation Error', 'Please set a 6-digit PIN.');
      return;
    }

    try {
      await createUser({
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        pin: newPin,
        role: formData.role,
        platform_user_id: formData.platform_user_id.trim() || null,
      });
      Alert.alert('Success', 'User created successfully.');
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create user');
    }
  };

  const handleUpdateUser = async () => {
    if (!selectedUser) return;

    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Please enter a name.');
      return;
    }

    try {
      await updateUser(selectedUser.id, {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        role: formData.role,
        platform_user_id: formData.platform_user_id.trim() || null,
      });
      Alert.alert('Success', 'User updated successfully.');
      setShowEditModal(false);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  const handleToggleActive = async (user: User) => {
    const action = user.is_active ? deactivateUser : activateUser;
    const actionName = user.is_active ? 'deactivate' : 'activate';

    Alert.alert(`${user.is_active ? 'Deactivate' : 'Activate'} User`, `Are you sure you want to ${actionName} ${user.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: user.is_active ? 'Deactivate' : 'Activate',
        style: user.is_active ? 'destructive' : 'default',
        onPress: async () => {
          try {
            await action(user.id);
          } catch (err) {
            Alert.alert('Error', `Failed to ${actionName} user`);
          }
        },
      },
    ]);
  };

  const handleDeleteUser = (user: User) => {
    if (user.role === 'admin') {
      Alert.alert('Warning', 'Deleting an admin user may lock you out of the system.');
    }

    Alert.alert('Delete User', `Are you sure you want to permanently delete ${user.name}? This action cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteUser(user.id);
            Alert.alert('Success', 'User deleted successfully.');
          } catch (err) {
            Alert.alert('Error', 'Failed to delete user');
          }
        },
      },
    ]);
  };

  const renderUserCard = (user: User) => (
    <View key={user.id} style={[styles.userCard, !user.is_active && styles.userCardInactive]}>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{user.name}</Text>
        <Text style={styles.userRole}>{ROLES.find(r => r.value === user.role)?.label || user.role}</Text>
        {user.email && <Text style={styles.userEmail}>{user.email}</Text>}
        {!user.is_active && <Text style={styles.inactiveLabel}>Inactive</Text>}
      </View>
      <View style={styles.userActions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleEditUser(user)}>
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => handleChangePin(user)}>
          <Text style={styles.actionButtonText}>PIN</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, user.is_active ? styles.deactivateButton : styles.activateButton]}
          onPress={() => handleToggleActive(user)}
        >
          <Text style={[styles.actionButtonText, user.is_active ? styles.deactivateText : styles.activateText]}>
            {user.is_active ? 'Disable' : 'Enable'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAddEditModal = (isEdit: boolean) => (
    <Modal visible={isEdit ? showEditModal : showAddModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{isEdit ? 'Edit User' : 'Add New User'}</Text>

          <Text style={styles.inputLabel}>Name *</Text>
          <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={text => setFormData({ ...formData, name: text })}
            placeholder="Enter name"
          />

          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={formData.email}
            onChangeText={text => setFormData({ ...formData, email: text })}
            placeholder="Enter email"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.inputLabel}>Role *</Text>
          <View style={styles.roleSelector}>
            {ROLES.map(role => (
              <TouchableOpacity
                key={role.value}
                style={[styles.roleOption, formData.role === role.value && styles.roleOptionSelected]}
                onPress={() => setFormData({ ...formData, role: role.value })}
              >
                <Text style={[styles.roleOptionText, formData.role === role.value && styles.roleOptionTextSelected]}>{role.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Platform User ID (for e-commerce sync)</Text>
          <TextInput
            style={styles.input}
            value={formData.platform_user_id}
            onChangeText={text => setFormData({ ...formData, platform_user_id: text })}
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
                    if (newPin.length < PIN_LENGTH) setNewPin(newPin + key);
                  }}
                  onDeletePress={() => setNewPin(newPin.slice(0, -1))}
                  disableBiometric
                />
              </View>
            </>
          )}

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                isEdit ? setShowEditModal(false) : setShowAddModal(false);
                resetForm();
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={isEdit ? handleUpdateUser : handleCreateUser}>
              <Text style={styles.saveButtonText}>{isEdit ? 'Save' : 'Create'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderPinModal = () => (
    <Modal visible={showPinModal} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>{pinStep === 'enter' ? 'Enter New PIN' : 'Confirm New PIN'}</Text>
          <Text style={styles.modalSubtitle}>{selectedUser?.name}</Text>

          <View style={styles.pinInputContainer}>
            <PinDisplay pinLength={PIN_LENGTH} filledCount={pinStep === 'enter' ? newPin.length : confirmPin.length} />
            <PinKeypad onKeyPress={handlePinKeyPress} onDeletePress={handlePinDelete} disableBiometric />
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => {
                setShowPinModal(false);
                resetForm();
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            {pinStep === 'confirm' && (
              <TouchableOpacity
                style={[styles.modalButton, styles.backButton]}
                onPress={() => {
                  setConfirmPin('');
                  setPinStep('enter');
                }}
              >
                <Text style={styles.backButtonText}>Back</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>User Management</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddUser}>
          <Text style={styles.addButtonText}>+ Add User</Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}
      {isLoading && <Text style={styles.loadingText}>Loading...</Text>}

      <View style={styles.userList}>
        {users.length === 0 ? <Text style={styles.emptyText}>No users found. Add your first user above.</Text> : users.map(renderUserCard)}
      </View>

      {renderAddEditModal(false)}
      {renderAddEditModal(true)}
      {renderPinModal()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  userList: {
    padding: 15,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userCardInactive: {
    opacity: 0.6,
    backgroundColor: '#f9f9f9',
  },
  userInfo: {
    marginBottom: 10,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
  },
  userRole: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  userEmail: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  inactiveLabel: {
    color: '#dc3545',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  userActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  actionButtonText: {
    fontSize: 14,
    color: '#333',
  },
  deactivateButton: {
    backgroundColor: '#fff3cd',
  },
  deactivateText: {
    color: '#856404',
  },
  activateButton: {
    backgroundColor: '#d4edda',
  },
  activateText: {
    color: '#155724',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 15,
    fontSize: 16,
  },
  roleSelector: {
    flexDirection: 'row',
    marginBottom: 15,
    gap: 8,
  },
  roleOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  roleOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  roleOptionText: {
    fontSize: 12,
    color: '#333',
  },
  roleOptionTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  pinInputContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  modalButton: {
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: '#f0f0f0',
  },
  backButtonText: {
    color: '#333',
  },
  errorText: {
    color: '#dc3545',
    padding: 15,
    textAlign: 'center',
  },
  loadingText: {
    color: '#666',
    padding: 15,
    textAlign: 'center',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    padding: 30,
  },
});

export default UsersSettingsTab;
