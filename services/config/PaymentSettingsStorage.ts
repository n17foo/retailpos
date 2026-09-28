import { ProtectedValueStore } from './ProtectedValueStore';

const settingsStore = new ProtectedValueStore({
  kvKey: 'paymentSettings',
  secretKey: 'config:paymentSettings',
  storageModeKey: 'paymentSettings.storageMode',
  logContext: 'PaymentSettingsStorage',
});

const stripeNfcApiKeyStore = new ProtectedValueStore({
  kvKey: 'stripe_nfc_apiKey',
  secretKey: 'config:stripe_nfc_apiKey',
  storageModeKey: 'stripe_nfc_apiKey.storageMode',
  logContext: 'StripeNfcApiKeyStorage',
});

export class PaymentSettingsStorage {
  static async load<T>(): Promise<T | null> {
    const value = await settingsStore.load();
    return value ? (JSON.parse(value) as T) : null;
  }

  static async save<T>(settings: T): Promise<void> {
    await settingsStore.save(JSON.stringify(settings));
  }

  static async getStripeNfcApiKey(): Promise<string | null> {
    return stripeNfcApiKeyStore.load();
  }

  static async saveStripeNfcApiKey(apiKey: string): Promise<void> {
    await stripeNfcApiKeyStore.save(apiKey);
  }
}
