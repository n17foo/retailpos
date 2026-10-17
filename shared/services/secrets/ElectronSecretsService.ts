import { SecretsServiceInterface } from './SecretsServiceInterface';
import { getElectronAPI } from '../../utils/electron';
import { LoggerFactory } from '../logger/LoggerFactory';

/**
 * Desktop secure storage backed by Electron safeStorage in the main process.
 * The renderer can only invoke the narrow IPC API; plaintext secrets and the
 * OS encryption key never enter the SQLite store.
 */
export class ElectronSecretsService implements SecretsServiceInterface {
  private static instance: ElectronSecretsService;
  private logger = LoggerFactory.getInstance().createLogger('ElectronSecretsService');

  private constructor() {}

  public static getInstance(): ElectronSecretsService {
    if (!ElectronSecretsService.instance) {
      ElectronSecretsService.instance = new ElectronSecretsService();
    }
    return ElectronSecretsService.instance;
  }

  public async isAvailable(): Promise<boolean> {
    try {
      return (await getElectronAPI()?.secureStorage.isAvailable()) === true;
    } catch {
      return false;
    }
  }

  public allowsPlaintextFallback(): boolean {
    return false;
  }

  public async storeSecret(key: string, value: string): Promise<boolean> {
    try {
      return (await getElectronAPI()?.secureStorage.set(key, value)) === true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to store secret in desktop secure storage' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  public async storeSecrets(secrets: Record<string, string>): Promise<void> {
    for (const [key, value] of Object.entries(secrets)) {
      await this.storeSecret(key, value);
    }
  }

  public async getSecret(key: string): Promise<string | null> {
    try {
      return (await getElectronAPI()?.secureStorage.get(key)) ?? null;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to read secret from desktop secure storage' },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  public async deleteSecret(key: string): Promise<boolean> {
    try {
      return (await getElectronAPI()?.secureStorage.delete(key)) === true;
    } catch (error) {
      this.logger.error(
        { message: 'Failed to delete desktop secure storage value' },
        error instanceof Error ? error : new Error(String(error))
      );
      return false;
    }
  }

  public async hasSecret(key: string): Promise<boolean> {
    return (await this.getSecret(key)) !== null;
  }
}
