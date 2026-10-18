import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { AuthMethodSwitcher } from './AuthMethodSwitcher';
import type { AuthMethodProvider } from '../services/auth/AuthMethodInterface';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

const provider = (type: AuthMethodProvider['type'], label: string): AuthMethodProvider =>
  ({ type, info: { label, icon: '🔑' } }) as AuthMethodProvider;

describe('AuthMethodSwitcher', () => {
  it('renders nothing when only one method is available', async () => {
    const tree = await renderUi(<AuthMethodSwitcher providers={[provider('pin', 'PIN')]} activeMethod="pin" onSwitch={jest.fn()} />);
    expect(hasText(tree, 'login.logInWith')).toBe(false);
  });

  it('lists methods and fires onSwitch', async () => {
    const onSwitch = jest.fn();
    const tree = await renderUi(
      <AuthMethodSwitcher providers={[provider('pin', 'PIN'), provider('biometric', 'Face ID')]} activeMethod="pin" onSwitch={onSwitch} />
    );
    expect(hasText(tree, 'login.logInWith')).toBe(true);
    await pressByText(tree, 'Face ID');
    expect(onSwitch).toHaveBeenCalledWith('biometric');
  });
});
