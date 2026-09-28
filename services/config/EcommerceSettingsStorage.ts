import { ProtectedValueStore } from './ProtectedValueStore';

const store = new ProtectedValueStore({
  kvKey: 'ecommerceSettings',
  secretKey: 'config:ecommerceSettings',
  storageModeKey: 'ecommerceSettings.storageMode',
  logContext: 'EcommerceSettingsStorage',
});

export class EcommerceSettingsStorage {
  static async load<T>(): Promise<T | null> {
    const value = await store.load();
    return value ? (JSON.parse(value) as T) : null;
  }

  static async save<T>(settings: T): Promise<void> {
    await store.save(JSON.stringify(settings));
  }
}
