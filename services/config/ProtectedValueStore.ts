import { keyValueRepository } from '../../repositories/KeyValueRepository';
import { LoggerFactory } from '../logger/LoggerFactory';
import { secretsServiceFactory } from '../secrets/SecretsService';

interface ProtectedValueStoreOptions {
  kvKey: string;
  secretKey: string;
  storageModeKey: string;
  logContext: string;
}

/**
 * Stores a serialized sensitive value in the active platform secret backend.
 *
 * The SQLite key-value path is retained only as an explicitly permitted legacy
 * or development fallback. Platforms without that permission fail closed and
 * never write credentials in plaintext.
 */
export class ProtectedValueStore {
  private logger = LoggerFactory.getInstance().createLogger('ProtectedValueStore');

  constructor(private readonly options: ProtectedValueStoreOptions) {}

  async load(): Promise<string | null> {
    const secrets = secretsServiceFactory.getService();
    const secureAvailable = await secrets.isAvailable();
    const fallbackAllowed = secrets.allowsPlaintextFallback();
    const storageMode = await keyValueRepository.getItem(this.options.storageModeKey);

    if (secureAvailable && storageMode !== 'kv') {
      const secured = await secrets.getSecret(this.options.secretKey);
      if (secured) return secured;
    }

    const legacy = await keyValueRepository.getItem(this.options.kvKey);
    if (!legacy) return null;

    if (secureAvailable) {
      const migrated = await secrets.storeSecret(this.options.secretKey, legacy);
      if (migrated) {
        await keyValueRepository.removeItem(this.options.storageModeKey);
        await keyValueRepository.removeItem(this.options.kvKey);
        return legacy;
      }
    }

    if (!fallbackAllowed) {
      this.logger.error('Sensitive settings are present only in plaintext fallback storage, which is not permitted on this platform');
      await keyValueRepository.removeItem(this.options.storageModeKey);
      await keyValueRepository.removeItem(this.options.kvKey);
      return null;
    }

    await keyValueRepository.setItem(this.options.storageModeKey, 'kv');
    this.logger.warn('Using explicitly permitted plaintext key-value fallback for sensitive settings');
    return legacy;
  }

  async save(value: string): Promise<void> {
    const secrets = secretsServiceFactory.getService();
    const stored = (await secrets.isAvailable()) && (await secrets.storeSecret(this.options.secretKey, value));

    if (stored) {
      await keyValueRepository.removeItem(this.options.storageModeKey);
      await keyValueRepository.removeItem(this.options.kvKey);
      return;
    }

    if (!secrets.allowsPlaintextFallback()) {
      await keyValueRepository.removeItem(this.options.storageModeKey);
      await keyValueRepository.removeItem(this.options.kvKey);
      throw new Error('Secure storage is unavailable and plaintext fallback is disabled on this platform');
    }

    await secrets.deleteSecret(this.options.secretKey);
    this.logger.warn('Secure storage unavailable; writing sensitive value to explicitly permitted key-value fallback');
    await keyValueRepository.setItem(this.options.kvKey, value);
    await keyValueRepository.setItem(this.options.storageModeKey, 'kv');
  }
}
