const getSecret = jest.fn();
const storeSecret = jest.fn();
const deleteSecret = jest.fn();
const getObject = jest.fn();
const getItem = jest.fn();
const setItem = jest.fn();
const removeItem = jest.fn();

const isAvailable = jest.fn();
const allowsPlaintextFallback = jest.fn();

jest.mock('../secrets/SecretsService', () => ({
  secretsServiceFactory: { getService: () => ({ getSecret, storeSecret, deleteSecret, isAvailable, allowsPlaintextFallback }) },
}));

jest.mock('../../repositories/KeyValueRepository', () => ({
  keyValueRepository: { getObject, getItem, setItem, removeItem },
}));

import { PaymentSettingsStorage } from './PaymentSettingsStorage';

describe('PaymentSettingsStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSecret.mockResolvedValue(null);
    getObject.mockResolvedValue(null);
    getItem.mockResolvedValue(null);
    isAvailable.mockResolvedValue(true);
    allowsPlaintextFallback.mockReturnValue(true);
  });

  it('keeps payment credentials out of the key-value store when secure storage works', async () => {
    storeSecret.mockResolvedValue(true);

    await PaymentSettingsStorage.save({ stripe: { secretKey: 'sk_secret' } });
    await PaymentSettingsStorage.saveStripeNfcApiKey('sk_terminal');

    expect(storeSecret).toHaveBeenCalledWith('config:paymentSettings', '{"stripe":{"secretKey":"sk_secret"}}');
    expect(storeSecret).toHaveBeenCalledWith('config:stripe_nfc_apiKey', 'sk_terminal');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('uses the current fallback instead of a stale secure value', async () => {
    getItem.mockImplementation(async (key: string) => {
      if (key === 'paymentSettings.storageMode') return 'kv';
      if (key === 'paymentSettings') return '{"stripe":{"secretKey":"current"}}';
      return null;
    });
    getSecret.mockResolvedValue('{"stripe":{"secretKey":"stale"}}');
    storeSecret.mockResolvedValue(false);

    await expect(PaymentSettingsStorage.load()).resolves.toEqual({ stripe: { secretKey: 'current' } });
    expect(getSecret).not.toHaveBeenCalled();
  });

  it('migrates a legacy Stripe NFC API key on first read', async () => {
    getItem.mockResolvedValue('legacy-key');
    storeSecret.mockResolvedValue(true);

    await expect(PaymentSettingsStorage.getStripeNfcApiKey()).resolves.toBe('legacy-key');

    expect(removeItem).toHaveBeenCalledWith('stripe_nfc_apiKey');
  });
});
