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

import { EcommerceSettingsStorage } from './EcommerceSettingsStorage';

describe('EcommerceSettingsStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSecret.mockResolvedValue(null);
    getObject.mockResolvedValue(null);
    getItem.mockResolvedValue(null);
    isAvailable.mockResolvedValue(true);
    allowsPlaintextFallback.mockReturnValue(true);
  });

  it('stores settings in secure storage and removes plaintext copies', async () => {
    storeSecret.mockResolvedValue(true);

    await EcommerceSettingsStorage.save({ apiKey: 'secret' });

    expect(storeSecret).toHaveBeenCalledWith('config:ecommerceSettings', '{"apiKey":"secret"}');
    expect(removeItem).toHaveBeenCalledWith('ecommerceSettings');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('migrates legacy plaintext settings on first read', async () => {
    getItem.mockImplementation(async (key: string) => (key === 'ecommerceSettings' ? '{"apiKey":"legacy-secret"}' : null));
    storeSecret.mockResolvedValue(true);

    await expect(EcommerceSettingsStorage.load()).resolves.toEqual({ apiKey: 'legacy-secret' });
    expect(removeItem).toHaveBeenCalledWith('ecommerceSettings');
  });

  it('retains the durable key-value fallback when secure storage is unavailable', async () => {
    storeSecret.mockResolvedValue(false);
    deleteSecret.mockResolvedValue(true);

    await EcommerceSettingsStorage.save({ apiKey: 'fallback' });

    expect(setItem).toHaveBeenCalledWith('ecommerceSettings', '{"apiKey":"fallback"}');
  });

  it('fails closed when secure storage is unavailable and fallback is disabled', async () => {
    isAvailable.mockResolvedValue(false);
    allowsPlaintextFallback.mockReturnValue(false);

    await expect(EcommerceSettingsStorage.save({ apiKey: 'secret' })).rejects.toThrow('Secure storage is unavailable');
    expect(setItem).not.toHaveBeenCalled();
  });

  it('removes a plaintext legacy value when fallback is forbidden', async () => {
    isAvailable.mockResolvedValue(false);
    allowsPlaintextFallback.mockReturnValue(false);
    getItem.mockResolvedValue('{"apiKey":"legacy-secret"}');

    await expect(EcommerceSettingsStorage.load()).resolves.toBeNull();
    expect(removeItem).toHaveBeenCalledWith('ecommerceSettings');
    expect(removeItem).toHaveBeenCalledWith('ecommerceSettings.storageMode');
  });
});
