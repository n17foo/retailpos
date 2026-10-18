import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useUsers, User } from '../../authentication/hooks/useUsers';
import { userSettingsStyles as styles } from '../components/userSettingsStyles';
import { UserCard } from '../components/UserCard';
import { UserFormModal } from '../components/UserFormModal';
import { PinChangeModal, PinEntryStep } from '../components/PinChangeModal';
import { PIN_LENGTH, EMPTY_USER_FORM, UserFormData } from '../utils/userFormData';

const UsersSettingsTab: React.FC = () => {
  const { users, isLoading, error, loadUsers, createUser, updateUser, updatePin, deactivateUser, activateUser, isPinUnique } = useUsers();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<UserFormData>({ ...EMPTY_USER_FORM });
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinStep, setPinStep] = useState<PinEntryStep>('enter');

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const resetForm = () => {
    setFormData({ ...EMPTY_USER_FORM });
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
          } catch {
            Alert.alert('Error', `Failed to ${actionName} user`);
          }
        },
      },
    ]);
  };

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
        {users.length === 0 ? (
          <Text style={styles.emptyText}>No users found. Add your first user above.</Text>
        ) : (
          users.map(user => (
            <UserCard key={user.id} user={user} onEdit={handleEditUser} onChangePin={handleChangePin} onToggleActive={handleToggleActive} />
          ))
        )}
      </View>

      <UserFormModal
        visible={showAddModal}
        isEdit={false}
        formData={formData}
        newPin={newPin}
        onFormChange={setFormData}
        onNewPinChange={setNewPin}
        onCancel={() => {
          setShowAddModal(false);
          resetForm();
        }}
        onSubmit={handleCreateUser}
      />
      <UserFormModal
        visible={showEditModal}
        isEdit
        formData={formData}
        newPin={newPin}
        onFormChange={setFormData}
        onNewPinChange={setNewPin}
        onCancel={() => {
          setShowEditModal(false);
          resetForm();
        }}
        onSubmit={handleUpdateUser}
      />
      <PinChangeModal
        visible={showPinModal}
        userName={selectedUser?.name}
        pinStep={pinStep}
        newPin={newPin}
        confirmPin={confirmPin}
        onKeyPress={handlePinKeyPress}
        onDelete={handlePinDelete}
        onCancel={() => {
          setShowPinModal(false);
          resetForm();
        }}
        onBack={() => {
          setConfirmPin('');
          setPinStep('enter');
        }}
      />
    </ScrollView>
  );
};

export default UsersSettingsTab;
