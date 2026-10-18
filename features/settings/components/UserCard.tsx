import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { User } from '../../authentication/hooks/useUsers';
import { userSettingsStyles as styles } from './userSettingsStyles';
import { USER_ROLES } from '../utils/userFormData';

interface UserCardProps {
  user: User;
  onEdit: (user: User) => void;
  onChangePin: (user: User) => void;
  onToggleActive: (user: User) => void;
}

/** Single user row — name/role/email plus Edit / PIN / Enable-Disable actions. */
export const UserCard: React.FC<UserCardProps> = ({ user, onEdit, onChangePin, onToggleActive }) => (
  <View style={[styles.userCard, !user.is_active && styles.userCardInactive]}>
    <View style={styles.userInfo}>
      <Text style={styles.userName}>{user.name}</Text>
      <Text style={styles.userRole}>{USER_ROLES.find(r => r.value === user.role)?.label || user.role}</Text>
      {user.email && <Text style={styles.userEmail}>{user.email}</Text>}
      {!user.is_active && <Text style={styles.inactiveLabel}>Inactive</Text>}
    </View>
    <View style={styles.userActions}>
      <TouchableOpacity style={styles.actionButton} onPress={() => onEdit(user)}>
        <Text style={styles.actionButtonText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.actionButton} onPress={() => onChangePin(user)}>
        <Text style={styles.actionButtonText}>PIN</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.actionButton, user.is_active ? styles.deactivateButton : styles.activateButton]}
        onPress={() => onToggleActive(user)}
      >
        <Text style={[styles.actionButtonText, user.is_active ? styles.deactivateText : styles.activateText]}>
          {user.is_active ? 'Disable' : 'Enable'}
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);
