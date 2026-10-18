import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { PinAuthForm } from './PinAuthForm';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('./PinKeypad', () => ({ __esModule: true, default: () => null }));
jest.mock('./PinDisplay', () => ({ __esModule: true, default: () => null }));

describe('PinAuthForm', () => {
  it('renders the PIN title', async () => {
    const tree = await renderUi(
      <PinAuthForm pinLength={6} filledCount={2} biometricAvailable={false} onKeyPress={jest.fn()} onDelete={jest.fn()} />
    );
    expect(hasText(tree, 'login.enterPin')).toBe(true);
  });
});
