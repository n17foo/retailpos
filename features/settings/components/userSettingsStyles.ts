import { StyleSheet } from 'react-native';
import { elevation, lightColors } from '../../../shared/utils/theme';

/** Shared styles for the user-management settings tab and its modals/cards. */
export const userSettingsStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: lightColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: lightColors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: lightColors.primary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: lightColors.textOnPrimary,
    fontWeight: '600',
  },
  userList: {
    padding: 15,
  },
  userCard: {
    backgroundColor: lightColors.surface,
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    ...elevation.low,
  },
  userCardInactive: {
    opacity: 0.6,
    backgroundColor: lightColors.inputBackground,
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
    color: lightColors.textSecondary,
    marginTop: 2,
  },
  userEmail: {
    fontSize: 12,
    color: lightColors.textHint,
    marginTop: 2,
  },
  inactiveLabel: {
    color: lightColors.error,
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
    backgroundColor: lightColors.inputBackground,
  },
  actionButtonText: {
    fontSize: 14,
    color: lightColors.textPrimary,
  },
  deactivateButton: {
    backgroundColor: lightColors.warningBackground,
  },
  deactivateText: {
    color: lightColors.warningText,
  },
  activateButton: {
    backgroundColor: lightColors.successBackground,
  },
  activateText: {
    color: lightColors.successText,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: lightColors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: lightColors.surface,
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
    color: lightColors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 5,
    color: lightColors.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: lightColors.border,
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
    borderColor: lightColors.border,
    alignItems: 'center',
  },
  roleOptionSelected: {
    backgroundColor: lightColors.primary,
    borderColor: lightColors.primary,
  },
  roleOptionText: {
    fontSize: 12,
    color: lightColors.textPrimary,
  },
  roleOptionTextSelected: {
    color: lightColors.textOnPrimary,
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
    backgroundColor: lightColors.inputBackground,
  },
  cancelButtonText: {
    color: lightColors.textPrimary,
  },
  saveButton: {
    backgroundColor: lightColors.primary,
  },
  saveButtonText: {
    color: lightColors.textOnPrimary,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: lightColors.inputBackground,
  },
  backButtonText: {
    color: lightColors.textPrimary,
  },
  errorText: {
    color: lightColors.error,
    padding: 15,
    textAlign: 'center',
  },
  loadingText: {
    color: lightColors.textSecondary,
    padding: 15,
    textAlign: 'center',
  },
  emptyText: {
    color: lightColors.textSecondary,
    textAlign: 'center',
    padding: 30,
  },
});
