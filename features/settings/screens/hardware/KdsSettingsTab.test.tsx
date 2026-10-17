import React from 'react';
import { renderUi, hasText } from '../../../../tests/testUtils';
import { KdsSettingsTab } from './KdsSettingsTab';

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

jest.mock('../../../hardware/services/kds/KdsServiceFactory', () => ({
  kdsServiceFactory: {
    getSettings: () => ({
      enabled: true,
      type: 'http',
      vendor: 'custom',
      endpoint: 'http://192.168.1.50:8080',
      apiKey: '',
      autoReconnect: true,
      pollIntervalMs: 3000,
    }),
    configure: jest.fn().mockResolvedValue(true),
  },
}));

describe('KdsSettingsTab', () => {
  it('renders Kitchen Display System settings and vendor presets when enabled', async () => {
    const tree = await renderUi(<KdsSettingsTab />);
    expect(hasText(tree, 'Kitchen Display System')).toBe(true);
    expect(hasText(tree, 'HTTP / REST')).toBe(true);
    expect(hasText(tree, 'Connection Details')).toBe(true);
  });
});
