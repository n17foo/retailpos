import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import InstoreApiSettingsTab from './InstoreApiSettingsTab';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../../multi-register/services/InstoreApiConfig', () => ({
  instoreApiConfig: {
    current: { registerId: 'reg-1' },
    load: jest.fn().mockResolvedValue({
      mode: 'standalone',
      port: 8787,
      sharedSecret: 'sec-123',
      registerName: 'Register 1',
      serverAddress: '',
      registerId: 'reg-1',
    }),
    save: jest.fn(),
  },
}));

describe('InstoreApiSettingsTab', () => {
  it('loads and displays multi-register mode options', async () => {
    const tree = await renderUi(<InstoreApiSettingsTab />);
    expect(hasText(tree, 'settings.instoreApi.standalone')).toBe(true);
    expect(hasText(tree, 'settings.instoreApi.server')).toBe(true);
    expect(hasText(tree, 'settings.instoreApi.client')).toBe(true);
  });
});
