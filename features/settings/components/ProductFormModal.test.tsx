import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { ProductFormModal } from './ProductFormModal';
import { EMPTY_PRODUCT_FORM } from '../utils/productFormData';

const baseProps = {
  visible: true,
  isEditing: false,
  formData: EMPTY_PRODUCT_FORM,
  categories: [{ id: 'c1', name: 'Drinks' }],
  onFormChange: jest.fn(),
  onCancel: jest.fn(),
  onSubmit: jest.fn(),
};

describe('ProductFormModal', () => {
  it('renders the add title, fields and category chips', async () => {
    const tree = await renderUi(<ProductFormModal {...baseProps} />);
    expect(hasText(tree, 'Add New Product')).toBe(true);
    expect(hasText(tree, 'Title *')).toBe(true);
    expect(hasText(tree, 'Drinks')).toBe(true);
    expect(hasText(tree, 'Create')).toBe(true);
  });

  it('renders the edit title and Update button', async () => {
    const tree = await renderUi(<ProductFormModal {...baseProps} isEditing />);
    expect(hasText(tree, 'Edit Product')).toBe(true);
    expect(hasText(tree, 'Update')).toBe(true);
  });

  it('fires onFormChange for title and category', async () => {
    const onFormChange = jest.fn();
    const tree = await renderUi(<ProductFormModal {...baseProps} onFormChange={onFormChange} />);
    const titleInput = tree.root.findAll(n => n.type === 'TextInput')[0];
    titleInput.props.onChangeText('Latte');
    expect(onFormChange).toHaveBeenCalledWith({ ...EMPTY_PRODUCT_FORM, title: 'Latte' });
    await pressByText(tree, 'Drinks');
    expect(onFormChange).toHaveBeenCalledWith({ ...EMPTY_PRODUCT_FORM, categoryId: 'Drinks' });
  });

  it('fires onCancel and onSubmit', async () => {
    const onCancel = jest.fn();
    const onSubmit = jest.fn();
    const tree = await renderUi(<ProductFormModal {...baseProps} onCancel={onCancel} onSubmit={onSubmit} />);
    await pressByText(tree, 'Cancel');
    expect(onCancel).toHaveBeenCalledTimes(1);
    await pressByText(tree, 'Create');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
