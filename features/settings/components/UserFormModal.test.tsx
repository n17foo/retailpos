import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { UserFormModal } from './UserFormModal';
import { EMPTY_USER_FORM } from '../utils/userFormData';

const baseProps = {
  visible: true,
  isEdit: false,
  formData: EMPTY_USER_FORM,
  newPin: '',
  onFormChange: jest.fn(),
  onNewPinChange: jest.fn(),
  onCancel: jest.fn(),
  onSubmit: jest.fn(),
};

describe('UserFormModal', () => {
  it('renders the add-user title, role options and PIN entry', async () => {
    const tree = await renderUi(<UserFormModal {...baseProps} />);
    expect(hasText(tree, 'Add New User')).toBe(true);
    expect(hasText(tree, 'Administrator')).toBe(true);
    expect(hasText(tree, 'PIN * (6 digits)')).toBe(true);
    expect(hasText(tree, 'Create')).toBe(true);
  });

  it('renders the edit title and hides PIN entry', async () => {
    const tree = await renderUi(<UserFormModal {...baseProps} isEdit formData={{ ...EMPTY_USER_FORM, name: 'Alice' }} />);
    expect(hasText(tree, 'Edit User')).toBe(true);
    expect(hasText(tree, 'PIN * (6 digits)')).toBe(false);
    expect(hasText(tree, 'Save')).toBe(true);
  });

  it('fires onFormChange for name and role', async () => {
    const onFormChange = jest.fn();
    const tree = await renderUi(<UserFormModal {...baseProps} onFormChange={onFormChange} />);
    const nameInput = tree.root.findAll(n => n.type === 'TextInput')[0];
    nameInput.props.onChangeText('Bob');
    expect(onFormChange).toHaveBeenCalledWith({ ...EMPTY_USER_FORM, name: 'Bob' });
    await pressByText(tree, 'Manager');
    expect(onFormChange).toHaveBeenCalledWith({ ...EMPTY_USER_FORM, role: 'manager' });
  });

  it('fires onCancel and onSubmit', async () => {
    const onCancel = jest.fn();
    const onSubmit = jest.fn();
    const tree = await renderUi(<UserFormModal {...baseProps} onCancel={onCancel} onSubmit={onSubmit} />);
    await pressByText(tree, 'Cancel');
    expect(onCancel).toHaveBeenCalledTimes(1);
    await pressByText(tree, 'Create');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
