import { type SQLiteDatabase } from 'expo-sqlite';
import { LoggerFactory } from '../services/logger/loggerFactory';

const logger = LoggerFactory.getInstance().createLogger('dbSchema');

/**
 * Current database schema version.
 * Increment this when adding a new migration step.
 */
export const LATEST_DB_VERSION = 7;

/**
 * Run all pending migrations on the given database.
 * Called once during app startup by SQLiteStorageService.
 */
export async function initializeSchema(db: SQLiteDatabase): Promise<void> {
  try {
    const currentVersion = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version')).user_version;
    logger.info(`Database version: ${currentVersion}`);

    if (currentVersion < LATEST_DB_VERSION) {
      logger.info(`Database schema is out of date. Migrating from version ${currentVersion} to ${LATEST_DB_VERSION}...`);
      await migrateDatabase(db, currentVersion, LATEST_DB_VERSION);
    } else {
      logger.info('Database schema is up to date.');
    }
  } catch (error) {
    logger.error({ message: 'Failed during database initialization/migration' }, error as Error);
    throw error;
  }
}

async function migrateDatabase(db: SQLiteDatabase, fromVersion: number, toVersion: number): Promise<void> {
  logger.info('Beginning database migration transaction...');
  await db.withTransactionAsync(async () => {
    // Migration to Version 1: Initial Schema
    if (fromVersion < 1) {
      logger.info('Applying migration to v1: Creating initial tables...');
      // Products Table
      await db.runAsync(
        `CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, description TEXT, price REAL NOT NULL, sku TEXT UNIQUE, stock_quantity INTEGER NOT NULL DEFAULT 0, category TEXT, image_url TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`
      );
      // Orders Table
      await db.runAsync(
        `CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY NOT NULL, customer_id TEXT, date INTEGER NOT NULL, total REAL NOT NULL, payment_method TEXT, status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);`
      );
      // Order Items Table
      await db.runAsync(
        `CREATE TABLE IF NOT EXISTS order_items (id TEXT PRIMARY KEY NOT NULL, order_id TEXT NOT NULL, product_id TEXT, quantity INTEGER NOT NULL, price REAL NOT NULL, FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE, FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE SET NULL);`
      );
      logger.info('Initial tables created.');
    }

    // Migration to Version 2: Add Settings Table
    if (fromVersion < 2) {
      logger.info('Applying migration to v2: Creating settings table...');
      await db.runAsync(
        `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL);`
      );
      logger.info('Settings table created.');
    }

    // Migration to Version 3: Add Users Table
    if (fromVersion < 3) {
      logger.info('Applying migration to v3: Creating users table...');
      await db.runAsync(
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
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_users_pin ON users(pin);`);
      // Add unique index for email (if provided)
      await db.runAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;`);
      logger.info('Users table created.');
    }

    // Migration to Version 4: Add Baskets and Local Orders Tables
    if (fromVersion < 4) {
      logger.info('Applying migration to v4: Creating baskets and local_orders tables...');

      // Baskets Table - stores the current shopping basket
      await db.runAsync(
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
      await db.runAsync(
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
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_local_orders_status ON local_orders(status);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_local_orders_sync_status ON local_orders(sync_status);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_baskets_status ON baskets(status);`);

      logger.info('Baskets and local_orders tables created.');
    }

    // Migration to Version 5: Add key_value_store table for general key-value storage
    if (fromVersion < 5) {
      logger.info('Applying migration to v5: Creating key_value_store table...');
      await db.runAsync(
        `CREATE TABLE IF NOT EXISTS key_value_store (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );`
      );
      logger.info('key_value_store table created.');
    }

    // Migration to Version 6: Add cashier tracking to local_orders
    if (fromVersion < 6) {
      logger.info('Applying migration to v6: Adding cashier columns to local_orders...');
      await db.runAsync(`ALTER TABLE local_orders ADD COLUMN cashier_id TEXT;`);
      await db.runAsync(`ALTER TABLE local_orders ADD COLUMN cashier_name TEXT;`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_local_orders_cashier ON local_orders(cashier_id);`);
      logger.info('Cashier columns added to local_orders.');
    }

    // Migration to Version 7: Add Categories Table
    if (fromVersion < 7) {
      logger.info('Applying migration to v7: Creating categories table...');
      await db.runAsync(
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
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_categories_platform ON categories(platform);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_categories_status ON categories(status);`);
      logger.info('Categories table created.');
    }

    // Update the version in a single step at the end
    await db.runAsync(`PRAGMA user_version = ${toVersion}`);
    logger.info(`Database migration complete. Version is now ${toVersion}.`);
  });
}
