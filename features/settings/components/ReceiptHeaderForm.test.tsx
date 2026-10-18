import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { ReceiptHeaderForm } from './ReceiptHeaderForm';
import type { ReceiptConfig } from '../../hardware/hooks/useReceiptConfig';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

const header: ReceiptConfig['header'] = {
  businessName: 'My Store',
  addressLine1: '1 High St',
  addressLine2: '',
  phone: '01234',
  email: 'pos@store.com',
  website: '',
  taxId: '',
  logoEnabled: false,
};

describe('ReceiptHeaderForm', () => {
  it('renders all header fields with current values', async () => {
    const tree = await renderUi(<ReceiptHeaderForm header={header} onChange={jest.fn()} />);
    expect(hasText(tree, 'settings.receipt.headerTitle')).toBe(true);
    const inputs = tree.root.findAll(n => n.type === 'TextInput');
    expect(inputs.some(i => i.props.value === 'My Store')).toBe(true);
    expect(inputs.length).toBe(7);
  });

  it('calls onChange with the updated field', async () => {
    const onChange = jest.fn();
    const tree = await renderUi(<ReceiptHeaderForm header={header} onChange={onChange} />);
    const nameInput = tree.root.findAll(n => n.type === 'TextInput' && n.props.value === 'My Store')[0];
    nameInput.props.onChangeText('New Name');
    expect(onChange).toHaveBeenCalledWith({ businessName: 'New Name' });
  });
});
