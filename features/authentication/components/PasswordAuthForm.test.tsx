import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { PasswordAuthForm } from './PasswordAuthForm';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

describe('PasswordAuthForm', () => {
  it('renders the password input and submit button', async () => {
    const onSubmit = jest.fn();
    const tree = await renderUi(<PasswordAuthForm password="" onPasswordChange={jest.fn()} onSubmit={onSubmit} />);
    expect(hasText(tree, 'login.enterPassword')).toBe(true);
    await pressByText(tree, 'common.logIn');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('forwards typed text via onPasswordChange', async () => {
    const onPasswordChange = jest.fn();
    const tree = await renderUi(<PasswordAuthForm password="" onPasswordChange={onPasswordChange} onSubmit={jest.fn()} />);
    const input = tree.root.findAll(n => n.type === 'TextInput')[0];
    input.props.onChangeText('s3cret');
    expect(onPasswordChange).toHaveBeenCalledWith('s3cret');
  });
});
