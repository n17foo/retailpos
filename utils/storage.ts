import AsyncStorage from '@react-native-async-storage/async-storage';
import { LoggerFactory } from '../services/logger';

// Conditionally import MMKV to avoid errors in Expo Go
let MMKV: any;
try {
  // Only attempt to import outside of Expo Go
  if (!global.__expo) {
    MMKV = require('react-native-mmkv').MMKV;
  }
} catch (e) {
  // MMKV import failed, will use AsyncStorage instead
  console.warn('MMKV import failed, falling back to AsyncStorage');
}

/**
 * StorageService - A centralized storage service with MMKV/AsyncStorage implementation
 * Uses MMKV for production builds and AsyncStorage for Expo Go
 * Provides a consistent interface regardless of underlying implementation
 */
export class Storage {
  private static instance: Storage;
  private storage: any;
  private usingMMKV: boolean = false;
  private logger: ReturnType<typeof LoggerFactory.prototype.createLogger>;

  private constructor() {
    this.logger = LoggerFactory.getInstance().createLogger('StorageService');

    // Check if we're in Expo Go
    const isExpoGo = global.__expo !== undefined;

    // Initialize the appropriate storage mechanism
    if (!isExpoGo && MMKV && process.env.APP_ENV !== 'development') {
      try {
        // Create the main storage instance with encryption
        this.storage = new MMKV({
          id: 'retailPOS-storage',
          encryptionKey: 'retailPOS-secure-storage',
        });
        this.usingMMKV = true;
        this.logger.info('Storage service initialized with MMKV');
      } catch (error) {
        this.logger.error(
          { message: 'Failed to initialize MMKV, falling back to AsyncStorage' },
          error instanceof Error ? error : new Error(String(error))
        );
        this.usingMMKV = false;
        this.storage = AsyncStorage;
      }
    } else {
      // Use AsyncStorage for Expo Go
      this.usingMMKV = false;
      this.storage = AsyncStorage;
      this.logger.info('Storage service initialized with AsyncStorage (Expo Go environment)');
    }
  }

  /**
   * Get the singleton instance of the StorageService
   */
  public static getInstance(): Storage {
    if (!Storage.instance) {
      Storage.instance = new Storage();
    }
    return Storage.instance;
  }

  /**
   * Set a value in storage
   * @param key The key to store the value under
   * @param value The value to store (will be JSON stringified if not a string)
   */
  async setItem(key: string, value: string | object | number | boolean): Promise<void> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

      if (this.usingMMKV) {
        this.storage.set(key, stringValue);
        return Promise.resolve();
      } else {
        return await this.storage.setItem(key, stringValue);
      }
    } catch (error) {
      this.logger.error({ message: `Error storing value for key: ${key}` }, error instanceof Error ? error : new Error(String(error)));
      return Promise.reject(error);
    }
  }

  /**
   * Get a value from storage
   * @param key The key to retrieve the value for
   * @returns The value as a string, or null if not found
   */
  async getItem(key: string): Promise<string | null> {
    try {
      if (this.usingMMKV) {
        const value = this.storage.getString(key);
        return Promise.resolve(value || null);
      } else {
        return await this.storage.getItem(key);
      }
    } catch (error) {
      this.logger.error({ message: `Error retrieving value for key: ${key}` }, error instanceof Error ? error : new Error(String(error)));
      return Promise.reject(error);
    }
  }

  /**
   * Remove an item from storage
   * @param key The key to remove
   */
  async removeItem(key: string): Promise<void> {
    try {
      if (this.usingMMKV) {
        this.storage.delete(key);
        return Promise.resolve();
      } else {
        return await this.storage.removeItem(key);
      }
    } catch (error) {
      this.logger.error({ message: `Error removing item for key: ${key}` }, error instanceof Error ? error : new Error(String(error)));
      return Promise.reject(error);
    }
  }

  /**
   * Get a parsed JSON value from storage
   * @param key The key to retrieve the value for
   * @returns The parsed object, or null if not found or invalid JSON
   */
  async getObject<T>(key: string): Promise<T | null> {
    try {
      let value;
      if (this.usingMMKV) {
        value = this.storage.getString(key);
      } else {
        value = await this.storage.getItem(key);
      }
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(
        { message: `Error parsing stored value for key: ${key}` },
        error instanceof Error ? error : new Error(String(error))
      );
      return null;
    }
  }

  /**
   * Store an object in storage after JSON stringifying it
   * @param key The key to store the object under
   * @param value The object to store
   */
  async setObject<T>(key: string, value: T): Promise<void> {
    try {
      const jsonString = JSON.stringify(value);
      if (this.usingMMKV) {
        this.storage.set(key, jsonString);
        return Promise.resolve();
      } else {
        return await this.storage.setItem(key, jsonString);
      }
    } catch (error) {
      this.logger.error({ message: `Error storing object for key: ${key}` }, error instanceof Error ? error : new Error(String(error)));
      return Promise.reject(error);
    }
  }

  /**
   * Check if a key exists in storage
   * @param key The key to check
   * @returns True if the key exists
   */
  async containsKey(key: string): Promise<boolean> {
    try {
      if (this.usingMMKV) {
        return Promise.resolve(this.storage.contains(key));
      } else {
        const value = await this.storage.getItem(key);
        return Promise.resolve(value !== null);
      }
    } catch (error) {
      this.logger.error({ message: `Error checking if key exists: ${key}` }, error instanceof Error ? error : new Error(String(error)));
      return Promise.resolve(false);
    }
  }

  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    try {
      if (this.usingMMKV) {
        this.storage.clearAll();
      } else {
        await this.storage.clear();
      }
      this.logger.info('Storage cleared');
      return Promise.resolve();
    } catch (error) {
      this.logger.error({ message: 'Error clearing storage' }, error instanceof Error ? error : new Error(String(error)));
      return Promise.reject(error);
    }
  }

  /**
   * Get all keys in storage
   * @returns Array of keys
   */
  async getAllKeys(): Promise<string[]> {
    try {
      if (this.usingMMKV) {
        return Promise.resolve(this.storage.getAllKeys());
      } else {
        return Promise.resolve(await this.storage.getAllKeys());
      }
    } catch (error) {
      this.logger.error({ message: 'Error getting all keys' }, error instanceof Error ? error : new Error(String(error)));
      return Promise.reject(error);
    }
  }

  /**
   * Set multiple items at once
   * @param items Array of [key, value] pairs
   */
  async multiSet(items: [string, string][]): Promise<void> {
    try {
      if (this.usingMMKV) {
        for (const [key, value] of items) {
          this.storage.set(key, value);
        }
        return Promise.resolve();
      } else {
        return await this.storage.multiSet(items);
      }
    } catch (error) {
      this.logger.error({ message: 'Error setting multiple items' }, error instanceof Error ? error : new Error(String(error)));
      return Promise.reject(error);
    }
  }

  /**
   * Get multiple items at once
   * @param keys Array of keys to retrieve
   * @returns Array of [key, value] pairs
   */
  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    try {
      if (this.usingMMKV) {
        return Promise.resolve(keys.map(key => [key, this.storage.getString(key)]));
      } else {
        return await this.storage.multiGet(keys);
      }
    } catch (error) {
      this.logger.error({ message: 'Error getting multiple items' }, error instanceof Error ? error : new Error(String(error)));
      return Promise.reject(error);
    }
  }
}

// Export a singleton instance for easy import
export const storage = Storage.getInstance();
