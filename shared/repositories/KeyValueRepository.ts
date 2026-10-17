import { db } from '../utils/db';

export class KeyValueRepository {
  async setItem(key: string, value: string | object | number | boolean): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const now = Date.now();
    await db.runAsync(
      `INSERT INTO key_value_store (key, value, created_at, updated_at) 
       VALUES (?, ?, ?, ?) 
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
      [key, stringValue, now, now, stringValue, now]
    );
  }

  async getItem(key: string): Promise<string | null> {
    const result = await db.getFirstAsync<{ value: string }>('SELECT value FROM key_value_store WHERE key = ?', [key]);
    return result?.value ?? null;
  }

  async getObject<T>(key: string): Promise<T | null> {
    const value = await this.getItem(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  }

  async setObject<T>(key: string, value: T): Promise<void> {
    await this.setItem(key, JSON.stringify(value));
  }

  async removeItem(key: string): Promise<void> {
    await db.runAsync('DELETE FROM key_value_store WHERE key = ?', [key]);
  }

  async containsKey(key: string): Promise<boolean> {
    const result = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM key_value_store WHERE key = ?', [key]);
    return (result?.count ?? 0) > 0;
  }

  async clearAll(): Promise<void> {
    await db.runAsync('DELETE FROM key_value_store');
  }

  async getAllKeys(): Promise<string[]> {
    const results = await db.getAllAsync<{ key: string }>('SELECT key FROM key_value_store');
    return results.map(r => r.key);
  }

  async multiSet(items: [string, string][]): Promise<void> {
    const now = Date.now();
    await db.withTransactionAsync(async () => {
      for (const [key, value] of items) {
        await db.runAsync(
          `INSERT INTO key_value_store (key, value, created_at, updated_at) 
           VALUES (?, ?, ?, ?) 
           ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
          [key, value, now, now, value, now]
        );
      }
    });
  }

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    const results: [string, string | null][] = [];
    for (const key of keys) {
      const value = await this.getItem(key);
      results.push([key, value]);
    }
    return results;
  }
}

export const keyValueRepository = new KeyValueRepository();
