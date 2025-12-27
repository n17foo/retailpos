import { sqliteStorage } from '../services/storage/SQLiteStorageService';
import { type SQLiteDatabase } from 'expo-sqlite';

interface Setting {
  key: string;
  value: string; // Stored as a JSON string
  updated_at: number;
}

export class SettingsRepository {
  private db: SQLiteDatabase;

  constructor() {
    this.db = sqliteStorage.getDatabase();
  }

  async getSetting<T>(key: string): Promise<T | null> {
    const result = await this.db.getFirstAsync<Setting>('SELECT * FROM settings WHERE key = ?', [key]);
    if (!result) {
      return null;
    }
    try {
      return JSON.parse(result.value) as T;
    } catch (error) {
      console.error(`Failed to parse setting for key: ${key}`, error);
      return null;
    }
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    const now = Date.now();
    const jsonValue = JSON.stringify(value);
    await this.db.runAsync(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at',
      [key, jsonValue, now]
    );
  }

  async deleteSetting(key: string): Promise<void> {
    await this.db.runAsync('DELETE FROM settings WHERE key = ?', [key]);
  }

  async getAllSettings(): Promise<{ [key: string]: any }> {
    const results = await this.db.getAllAsync<Setting>('SELECT * FROM settings');
    const settings: { [key: string]: any } = {};
    for (const row of results) {
      try {
        settings[row.key] = JSON.parse(row.value);
      } catch (error) {
        console.error(`Failed to parse setting for key: ${row.key}`, error);
      }
    }
    return settings;
  }
}
