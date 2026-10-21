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
      port: 8080,
      sharedSecret: 'sec-123',
      registerName: 'Register 1',
      serverAddress: '',
      registerId: 'reg-1',
    }),
    save: jest.fn(),
  },
}));

describe('InstoreApiSettingsTab', () => {
  it('offers only standalone and client modes — the server is a separate project (ADR-018)', async () => {
    const tree = await renderUi(<InstoreApiSettingsTab />);
    expect(hasText(tree, 'settings.instoreApi.standalone')).toBe(true);
    expect(hasText(tree, 'settings.instoreApi.client')).toBe(true);
    expect(hasText(tree, 'settings.instoreApi.server')).toBe(false);
  });
});
