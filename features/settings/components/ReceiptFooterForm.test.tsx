import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { ReceiptFooterForm } from './ReceiptFooterForm';
import type { ReceiptConfig } from '../../hardware/hooks/useReceiptConfig';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

const footer: ReceiptConfig['footer'] = {
  line1: 'Thanks!',
  line2: '',
  line3: '',
  showSocialMedia: false,
  facebook: '',
  instagram: '',
  twitter: '',
};

describe('ReceiptFooterForm', () => {
  it('renders three footer lines and calls onChange', async () => {
    const onChange = jest.fn();
    const tree = await renderUi(<ReceiptFooterForm footer={footer} onChange={onChange} />);
    expect(hasText(tree, 'settings.receipt.footerTitle')).toBe(true);
    const inputs = tree.root.findAll(n => n.type === 'TextInput');
    expect(inputs.length).toBe(3);
    inputs[0].props.onChangeText('See you soon');
    expect(onChange).toHaveBeenCalledWith({ line1: 'See you soon' });
  });
});
