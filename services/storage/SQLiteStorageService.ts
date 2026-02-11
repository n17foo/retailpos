import * as SQLite from 'expo-sqlite';
import { LoggerFactory } from '../logger';

export class SQLiteStorageService {
  private static instance: SQLiteStorageService;
  private db: SQLite.SQLiteDatabase;
  private logger = LoggerFactory.getInstance().createLogger('SQLiteStorageService');

  private constructor() {
    this.db = SQLite.openDatabaseSync('retailPOS.db');
    this.initializeDatabase();
  }

  public static getInstance(): SQLiteStorageService {
    if (!SQLiteStorageService.instance) {
      SQLiteStorageService.instance = new SQLiteStorageService();
    }
    return SQLiteStorageService.instance;
  }

  private async initializeDatabase(): Promise<void> {
    const LATEST_VERSION = 7; // Increment this when schema changes

    try {
      let currentVersion = (await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')).user_version;
      this.logger.info(`Database version: ${currentVersion}`);

      if (currentVersion < LATEST_VERSION) {
        this.logger.info(`Database schema is out of date. Migrating from version ${currentVersion} to ${LATEST_VERSION}...`);
        await this.migrateDatabase(currentVersion, LATEST_VERSION);
      } else {
        this.logger.info('Database schema is up to date.');
      }
    } catch (error) {
      this.logger.error({ message: 'Failed during database initialization/migration' }, error as Error);
      throw error;
    }
  }

  private async migrateDatabase(fromVersion: number, toVersion: number): Promise<void> {
    this.logger.info('Beginning database migration transaction...');
    await this.db.withTransactionAsync(async () => {
      // Migration to Version 1: Initial Schema
      if (fromVersion < 1) {
        this.logger.info('Applying migration to v1: Creating initial tables...');
        // Products Table
        await this.db.runAsync(
          `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, description TEXT, price REAL NOT NULL, sku TEXT UNIQUE, stock_quantity INTEGER NOT NULL DEFAULT 0, category TEXT, image_url TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`
        );
        // Orders Table
        await this.db.runAsync(
          `CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY NOT NULL, customer_id TEXT, date INTEGER NOT NULL, total REAL NOT NULL, payment_method TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`
        );
        // Order Items Table
        await this.db.runAsync(
          `CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL, product_id TEXT, quantity INTEGER NOT NULL, price REAL NOT NULL, FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE, FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL);`
        );
        this.logger.info('Initial tables created.');
      }

      // Migration to Version 2: Add Settings Table
      if (fromVersion < 2) {
        this.logger.info('Applying migration to v2: Creating settings table...');
        await this.db.runAsync(
          `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL);`
        );
        this.logger.info('Settings table created.');
      }

      // Migration to Version 3: Add Users Table
      if (fromVersion < 3) {
        this.logger.info('Applying migration to v3: Creating users table...');
        await this.db.runAsync(
          `CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            email TEXT,
            pin TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'cashier')),
            platform_user_id TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );`
        );
        // Add index for PIN lookup (frequently used for login)
        await this.db.runAsync(`CREATE INDEX IF NOT EXISTS idx_users_pin ON users(pin);`);
        // Add unique index for email (if provided)
        await this.db.runAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;`);
        this.logger.info('Users table created.');
      }

      // Migration to Version 4: Add Baskets and Local Orders Tables
      if (fromVersion < 4) {
        this.logger.info('Applying migration to v4: Creating baskets and local_orders tables...');

        // Baskets Table - stores the current shopping basket
        await this.db.runAsync(
          `CREATE TABLE IF NOT EXISTS baskets (
            id TEXT PRIMARY KEY NOT NULL,
            items TEXT NOT NULL DEFAULT '[]',
            subtotal REAL NOT NULL DEFAULT 0,
            tax REAL NOT NULL DEFAULT 0,
            total REAL NOT NULL DEFAULT 0,
            discount_amount REAL,
            discount_code TEXT,
            customer_email TEXT,
            customer_name TEXT,
            note TEXT,
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'abandoned')),
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );`
        );

        // Local Orders Table - stores orders locally before/after syncing to platform
        await this.db.runAsync(
          `CREATE TABLE IF NOT EXISTS local_orders (
            id TEXT PRIMARY KEY NOT NULL,
            platform_order_id TEXT,
            platform TEXT,
            items TEXT NOT NULL,
            subtotal REAL NOT NULL,
            tax REAL NOT NULL,
            total REAL NOT NULL,
            discount_amount REAL,
            discount_code TEXT,
            customer_email TEXT,
            customer_name TEXT,
            note TEXT,
            payment_method TEXT,
            payment_transaction_id TEXT,
            status TEXT NOT NULL CHECK(status IN ('pending', 'processing', 'paid', 'synced', 'failed', 'cancelled')),
            sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced', 'failed')),
            sync_error TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            paid_at INTEGER,
            synced_at INTEGER
          );`
        );

        // Add indexes for common queries
        await this.db.runAsync(`CREATE INDEX IF NOT EXISTS idx_local_orders_status ON local_orders(status);`);
        await this.db.runAsync(`CREATE INDEX IF NOT EXISTS idx_local_orders_sync_status ON local_orders(sync_status);`);
        await this.db.runAsync(`CREATE INDEX IF NOT EXISTS idx_baskets_status ON baskets(status);`);

        this.logger.info('Baskets and local_orders tables created.');
      }

      // Migration to Version 5: Add key_value_store table for general key-value storage
      if (fromVersion < 5) {
        this.logger.info('Applying migration to v5: Creating key_value_store table...');
        await this.db.runAsync(
          `CREATE TABLE IF NOT EXISTS key_value_store (
            key TEXT PRIMARY KEY NOT NULL,
            value TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );`
        );
        this.logger.info('key_value_store table created.');
      }

      // Migration to Version 6: Add cashier tracking to local_orders
      if (fromVersion < 6) {
        this.logger.info('Applying migration to v6: Adding cashier columns to local_orders...');
        await this.db.runAsync(`ALTER TABLE local_orders ADD COLUMN cashier_id TEXT;`);
        await this.db.runAsync(`ALTER TABLE local_orders ADD COLUMN cashier_name TEXT;`);
        await this.db.runAsync(`CREATE INDEX IF NOT EXISTS idx_local_orders_cashier ON local_orders(cashier_id);`);
        this.logger.info('Cashier columns added to local_orders.');
      }

      // Migration to Version 7: Add Categories Table
      if (fromVersion < 7) {
        this.logger.info('Applying migration to v7: Creating categories table...');
        await this.db.runAsync(
          `CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            parent_id TEXT,
            image_url TEXT,
            position INTEGER NOT NULL DEFAULT 0,
            product_count INTEGER NOT NULL DEFAULT 0,
            platform TEXT NOT NULL,
            platform_id TEXT,
            level INTEGER NOT NULL DEFAULT 0,
            path TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'hidden', 'archived')),
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );`
        );
        await this.db.runAsync(`CREATE INDEX IF NOT EXISTS idx_categories_platform ON categories(platform);`);
        await this.db.runAsync(`CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);`);
        await this.db.runAsync(`CREATE INDEX IF NOT EXISTS idx_categories_status ON categories(status);`);
        this.logger.info('Categories table created.');
      }

      // Update the version in a single step at the end
      await this.db.runAsync(`PRAGMA user_version = ${toVersion}`);
      this.logger.info(`Database migration complete. Version is now ${toVersion}.`);
    });
  }

  public getDatabase(): SQLite.SQLiteDatabase {
    return this.db;
  }

  // ============ Key-Value Storage Methods ============

  /**
   * Set a value in key-value storage
   */
  public async setItem(key: string, value: string | object | number | boolean): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const now = Date.now();

    await this.db.runAsync(
      `INSERT INTO key_value_store (key, value, created_at, updated_at) 
       VALUES (?, ?, ?, ?) 
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
      [key, stringValue, now, now, stringValue, now]
    );
  }

  /**
   * Get a value from key-value storage
   */
  public async getItem(key: string): Promise<string | null> {
    const result = await this.db.getFirstAsync<{ value: string }>(
      'SELECT value FROM key_value_store WHERE key = ?',
      [key]
    );
    return result?.value ?? null;
  }

  /**
   * Remove an item from key-value storage
   */
  public async removeItem(key: string): Promise<void> {
    await this.db.runAsync('DELETE FROM key_value_store WHERE key = ?', [key]);
  }

  /**
   * Get a parsed JSON value from storage
   */
  public async getObject<T>(key: string): Promise<T | null> {
    try {
      const value = await this.getItem(key);
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
   */
  public async setObject<T>(key: string, value: T): Promise<void> {
    await this.setItem(key, JSON.stringify(value));
  }

  /**
   * Check if a key exists in storage
   */
  public async containsKey(key: string): Promise<boolean> {
    const result = await this.db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM key_value_store WHERE key = ?',
      [key]
    );
    return (result?.count ?? 0) > 0;
  }

  /**
   * Clear all key-value storage
   */
  public async clearKeyValueStore(): Promise<void> {
    await this.db.runAsync('DELETE FROM key_value_store');
    this.logger.info('Key-value storage cleared');
  }

  /**
   * Get all keys in storage
   */
  public async getAllKeys(): Promise<string[]> {
    const results = await this.db.getAllAsync<{ key: string }>(
      'SELECT key FROM key_value_store'
    );
    return results.map(r => r.key);
  }

  /**
   * Set multiple items at once
   */
  public async multiSet(items: [string, string][]): Promise<void> {
    const now = Date.now();
    await this.db.withTransactionAsync(async () => {
      for (const [key, value] of items) {
        await this.db.runAsync(
          `INSERT INTO key_value_store (key, value, created_at, updated_at) 
           VALUES (?, ?, ?, ?) 
           ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = ?`,
          [key, value, now, now, value, now]
        );
      }
    });
  }

  /**
   * Get multiple items at once
   */
  public async multiGet(keys: string[]): Promise<[string, string | null][]> {
    const results: [string, string | null][] = [];
    for (const key of keys) {
      const value = await this.getItem(key);
      results.push([key, value]);
    }
    return results;
  }
}

export const sqliteStorage = SQLiteStorageService.getInstance();
