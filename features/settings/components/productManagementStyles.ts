import { StyleSheet } from 'react-native';
import { elevation, lightColors } from '../../../shared/utils/theme';

/** Shared styles for the product-management settings tab, card and form modal. */
export const productManagementStyles = StyleSheet.create({
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
  searchContainer: {
    padding: 15,
    backgroundColor: lightColors.surface,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  productList: {
    padding: 15,
  },
  productCard: {
    backgroundColor: lightColors.surface,
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    ...elevation.low,
  },
  productImageContainer: {
    width: 80,
    height: 80,
    marginRight: 12,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  productImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: lightColors.inputBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 10,
    color: lightColors.textHint,
  },
  productInfo: {
    flex: 1,
  },
  productTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: lightColors.primary,
    marginBottom: 4,
  },
  productSku: {
    fontSize: 12,
    color: lightColors.textSecondary,
  },
  productStock: {
    fontSize: 12,
    color: lightColors.textSecondary,
  },
  productCategory: {
    fontSize: 11,
    color: lightColors.textHint,
    marginTop: 4,
    backgroundColor: lightColors.inputBackground,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  productActions: {
    justifyContent: 'center',
    gap: 8,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: lightColors.inputBackground,
  },
  editButtonText: {
    fontSize: 14,
    color: lightColors.textPrimary,
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: lightColors.error + '15',
  },
  deleteButtonText: {
    fontSize: 14,
    color: lightColors.error,
  },
  statsContainer: {
    padding: 15,
    alignItems: 'center',
  },
  statsText: {
    fontSize: 14,
    color: lightColors.textSecondary,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
    gap: 8,
  },
  categoryOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: lightColors.border,
  },
  categoryOptionSelected: {
    backgroundColor: lightColors.primary,
    borderColor: lightColors.primary,
  },
  categoryOptionText: {
    fontSize: 12,
    color: lightColors.textPrimary,
  },
  categoryOptionTextSelected: {
    color: lightColors.textOnPrimary,
    fontWeight: '600',
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
