import { ALLOW_PLAINTEXT_SECRET_FALLBACK } from '@env';
import { SecretsServiceInterface } from './SecretsServiceInterface';
import { LoggerFactory } from '../logger/LoggerFactory';

/**
 * Browser runtime has no silent, device-bound persistent secret store.
 * It deliberately reports unavailable; callers may use the legacy KV fallback
 * only when ALLOW_PLAINTEXT_SECRET_FALLBACK=true is explicitly configured.
 */
export class BrowserSecretsService implements SecretsServiceInterface {
  private static instance: BrowserSecretsService;
  private warned = false;
  private logger = LoggerFactory.getInstance().createLogger('BrowserSecretsService');

  private constructor() {}

  public static getInstance(): BrowserSecretsService {
    if (!BrowserSecretsService.instance) {
      BrowserSecretsService.instance = new BrowserSecretsService();
    }
    return BrowserSecretsService.instance;
  }

  public async isAvailable(): Promise<boolean> {
    return false;
  }

  public allowsPlaintextFallback(): boolean {
    const allowed = ALLOW_PLAINTEXT_SECRET_FALLBACK === 'true';
    if (allowed && !this.warned) {
      this.logger.warn('Plaintext browser secret fallback is explicitly enabled; stored credentials are exposed to local profile access.');
      this.warned = true;
    }
    return allowed;
  }

  public async storeSecret(): Promise<boolean> {
    return false;
  }

  public async storeSecrets(): Promise<void> {
    // Nothing is persisted by this backend.
  }

  public async getSecret(): Promise<string | null> {
    return null;
  }

  public async deleteSecret(): Promise<boolean> {
    return true;
  }

  public async hasSecret(): Promise<boolean> {
    return false;
  }
}
