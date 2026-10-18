import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { BiometricAuthForm } from './BiometricAuthForm';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

describe('BiometricAuthForm', () => {
  it('renders the biometric prompt and fires onAuthenticate', async () => {
    const onAuthenticate = jest.fn();
    const tree = await renderUi(<BiometricAuthForm onAuthenticate={onAuthenticate} />);
    expect(hasText(tree, 'login.biometricLogin')).toBe(true);
    expect(hasText(tree, 'login.biometricDescription')).toBe(true);
    await pressByText(tree, 'login.tapToAuthenticate');
    expect(onAuthenticate).toHaveBeenCalledTimes(1);
  });
});
