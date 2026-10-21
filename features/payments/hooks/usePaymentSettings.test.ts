import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { usePaymentSettings } from './usePaymentSettings';
import { PaymentSettingsStorage } from '../../platform-clients/services/config/PaymentSettingsStorage';
import { PaymentProvider } from '../services/PaymentServiceFactory';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { appOwnership: null },
}));

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

jest.mock('../../platform-clients/services/config/PaymentSettingsStorage', () => ({
  PaymentSettingsStorage: {
    load: jest.fn(),
    save: jest.fn(),
    saveStripeNfcApiKey: jest.fn(),
  },
}));

jest.mock('../../../shared/repositories/KeyValueRepository', () => ({
  keyValueRepository: {
    setItem: jest.fn(),
  },
}));

const mockApplySettings = jest.fn();
jest.mock('../services/PaymentService', () => ({
  __esModule: true,
  default: {
    applySettings: (...args: unknown[]) => mockApplySettings(...args),
    connectToTerminal: jest.fn().mockResolvedValue(true),
  },
}));

async function mountHook() {
  let latest: ReturnType<typeof usePaymentSettings> | null = null;
  function Harness() {
    latest = usePaymentSettings();
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('usePaymentSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApplySettings.mockResolvedValue(undefined);
    (PaymentSettingsStorage.load as jest.Mock).mockResolvedValue(null);
  });

  it('loads default payment settings when storage is empty', async () => {
    const { get } = await mountHook();
    expect(get().isLoading).toBe(false);
    expect(get().paymentSettings.provider).toBe(PaymentProvider.STRIPE_NFC);
    expect(get().saveStatus).toBe('saved');
  });

  it('updates nested settings and saves via PaymentSettingsStorage', async () => {
    const { get } = await mountHook();

    act(() => {
      get().handlePaymentSettingsChange({
        provider: PaymentProvider.SQUARE,
        square: { applicationId: 'app-1', locationId: 'loc-1', accessToken: 'tok-1' },
      });
    });

    expect(get().saveStatus).toBe('unsaved');
    expect(get().paymentSettings.provider).toBe(PaymentProvider.SQUARE);

    let ok = false;
    await act(async () => {
      ok = await get().saveSettings(get().paymentSettings);
    });

    expect(ok).toBe(true);
    expect(PaymentSettingsStorage.save).toHaveBeenCalled();
    expect(mockApplySettings).toHaveBeenCalledWith(expect.objectContaining({ provider: PaymentProvider.SQUARE }));
    expect(get().saveStatus).toBe('saved');
  });
});
