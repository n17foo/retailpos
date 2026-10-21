import { keyValueRepository } from '../../../../shared/repositories/KeyValueRepository';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';

const KEYS = {
  products: 'serverCache.products',
  categories: 'serverCache.categories',
  taxProfiles: 'serverCache.taxProfiles',
} as const;

const logger = LoggerFactory.getInstance().createLogger('ServerDataCache');

/**
 * Read-through cache for server-authoritative data.
 *
 * In client mode, catalogue/users/etc. are read live from the Store API so
 * registers never diverge — but that makes the till fragile during a LAN
 * outage. This cache is populated on every successful server read and served
 * only when the server is unreachable, letting the register keep selling from
 * its last-known catalogue. Data is stored JSON-safe (server row shapes, not
 * mapped domain objects — Date objects don't survive JSON).
 */
export class ServerDataCache {
  private static instance: ServerDataCache;

  private constructor() {}

  static getInstance(): ServerDataCache {
    if (!ServerDataCache.instance) {
      ServerDataCache.instance = new ServerDataCache();
    }
    return ServerDataCache.instance;
  }

  /** Merge rows into the products cache (id-keyed — partial lists accumulate). */
  async mergeProducts<T extends { id: string }>(rows: T[]): Promise<void> {
    await this.merge(KEYS.products, rows);
  }

  async getProducts<T>(): Promise<T[] | null> {
    return this.read<T>(KEYS.products);
  }

  async mergeCategories<T extends { id: string }>(rows: T[]): Promise<void> {
    await this.merge(KEYS.categories, rows);
  }

  async getCategories<T>(): Promise<T[] | null> {
    return this.read<T>(KEYS.categories);
  }

  async mergeTaxProfiles<T extends { id: string }>(rows: T[]): Promise<void> {
    await this.merge(KEYS.taxProfiles, rows);
  }

  async getTaxProfiles<T>(): Promise<T[] | null> {
    return this.read<T>(KEYS.taxProfiles);
  }

  /** Replace an entry wholesale (single-row reads, deletions). */
  async removeProduct(id: string): Promise<void> {
    await this.remove(KEYS.products, id);
  }

  async removeCategory(id: string): Promise<void> {
    await this.remove(KEYS.categories, id);
  }

  private async merge<T extends { id: string }>(key: string, rows: T[]): Promise<void> {
    try {
      const existing = (await this.read<{ id: string }>(key)) ?? [];
      const map = new Map(existing.map(r => [r.id, r]));
      for (const row of rows) map.set(row.id, row);
      await keyValueRepository.setItem(key, JSON.stringify([...map.values()]));
    } catch (error) {
      logger.error({ message: 'Cache write failed' }, error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async remove(key: string, id: string): Promise<void> {
    try {
      const existing = (await this.read<{ id: string }>(key)) ?? [];
      await keyValueRepository.setItem(key, JSON.stringify(existing.filter(r => r.id !== id)));
    } catch (error) {
      logger.error({ message: 'Cache remove failed' }, error instanceof Error ? error : new Error(String(error)));
    }
  }

  private async read<T>(key: string): Promise<T[] | null> {
    try {
      const raw = await keyValueRepository.getItem(key);
      return raw ? (JSON.parse(raw) as T[]) : null;
    } catch {
      return null;
    }
  }
}

export const serverDataCache = ServerDataCache.getInstance();
