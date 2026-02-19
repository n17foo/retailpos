import { type SQLiteDatabase } from 'expo-sqlite';
import { LoggerFactory } from '../services/logger/loggerFactory';

const logger = LoggerFactory.getInstance().createLogger('dbSchema');

/**
 * Current database schema version.
 * Bump this number and add a migration block whenever the schema changes.
 */
export const LATEST_DB_VERSION = 3;

/**
 * Initialise (or migrate) the database schema.
 * Called once during app startup by SQLiteStorageService.
 */
export async function initializeSchema(db: SQLiteDatabase): Promise<void> {
  try {
    const { user_version: currentVersion } = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))!;
    logger.info(`Database version: ${currentVersion}`);

    if (currentVersion < LATEST_DB_VERSION) {
      logger.info(`Migrating database from v${currentVersion} → v${LATEST_DB_VERSION}…`);
      await migrateDatabase(db, currentVersion, LATEST_DB_VERSION);
    } else {
      logger.info('Database schema is up to date.');
    }
  } catch (error) {
    logger.error({ message: 'Failed during database initialisation / migration' }, error as Error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------

async function migrateDatabase(db: SQLiteDatabase, fromVersion: number, toVersion: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    // ── v1 – Full initial schema ──────────────────────────────────────────
    if (fromVersion < 1) {
      logger.info('Applying v1: creating all tables…');

      // Products
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS products (
          id              TEXT PRIMARY KEY NOT NULL,
          name            TEXT NOT NULL,
          description     TEXT,
          price           REAL NOT NULL,
          sku             TEXT UNIQUE,
          stock_quantity  INTEGER NOT NULL DEFAULT 0,
          category        TEXT,
          image_url       TEXT,
          created_at      INTEGER NOT NULL,
          updated_at      INTEGER NOT NULL
        );
      `);

      // Settings (simple key-value)
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS settings (
          key        TEXT PRIMARY KEY NOT NULL,
          value      TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // Users
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS users (
          id               TEXT PRIMARY KEY NOT NULL,
          name             TEXT NOT NULL,
          email            TEXT,
          pin              TEXT NOT NULL,
          role             TEXT NOT NULL CHECK(role IN ('admin', 'manager', 'cashier')),
          platform_user_id TEXT,
          is_active        INTEGER NOT NULL DEFAULT 1,
          created_at       INTEGER NOT NULL,
          updated_at       INTEGER NOT NULL
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_users_pin   ON users(pin);`);
      await db.runAsync(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;`);

      // Baskets (current shopping cart – items stored as JSON for speed)
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS baskets (
          id              TEXT PRIMARY KEY NOT NULL,
          items           TEXT NOT NULL DEFAULT '[]',
          subtotal        REAL NOT NULL DEFAULT 0,
          tax             REAL NOT NULL DEFAULT 0,
          total           REAL NOT NULL DEFAULT 0,
          discount_amount REAL,
          discount_code   TEXT,
          customer_email  TEXT,
          customer_name   TEXT,
          note            TEXT,
          status          TEXT NOT NULL DEFAULT 'active'
                            CHECK(status IN ('active', 'completed', 'abandoned')),
          created_at      INTEGER NOT NULL,
          updated_at      INTEGER NOT NULL
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_baskets_status ON baskets(status);`);

      // ── Unified Orders table ────────────────────────────────────────────
      // Works for both local/offline orders and platform-synced orders.
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS orders (
          id                      TEXT PRIMARY KEY NOT NULL,
          platform_order_id       TEXT,
          platform                TEXT,
          subtotal                REAL NOT NULL,
          tax                     REAL NOT NULL,
          total                   REAL NOT NULL,
          discount_amount         REAL,
          discount_code           TEXT,
          customer_email          TEXT,
          customer_name           TEXT,
          note                    TEXT,
          payment_method          TEXT,
          payment_transaction_id  TEXT,
          cashier_id              TEXT,
          cashier_name            TEXT,
          status                  TEXT NOT NULL DEFAULT 'pending'
                                    CHECK(status IN ('pending','processing','paid','synced','failed','cancelled')),
          sync_status             TEXT NOT NULL DEFAULT 'pending'
                                    CHECK(sync_status IN ('pending','synced','failed')),
          sync_error              TEXT,
          created_at              INTEGER NOT NULL,
          updated_at              INTEGER NOT NULL,
          paid_at                 INTEGER,
          synced_at               INTEGER
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(status);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_orders_sync_status ON orders(sync_status);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_orders_cashier     ON orders(cashier_id);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_orders_created_at  ON orders(created_at);`);

      // ── Order Items (normalised – one row per line item) ────────────────
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS order_items (
          id                    TEXT PRIMARY KEY NOT NULL,
          order_id              TEXT NOT NULL,
          product_id            TEXT NOT NULL,
          variant_id            TEXT,
          sku                   TEXT,
          name                  TEXT NOT NULL,
          price                 REAL NOT NULL,
          quantity              INTEGER NOT NULL,
          image                 TEXT,
          taxable               INTEGER NOT NULL DEFAULT 0,
          tax_rate              REAL,
          is_ecommerce_product  INTEGER NOT NULL DEFAULT 0,
          original_id           TEXT,
          properties            TEXT,
          FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);`);

      // Key-value store (general-purpose)
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS key_value_store (
          key        TEXT PRIMARY KEY NOT NULL,
          value      TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      // Categories
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS categories (
          id            TEXT PRIMARY KEY NOT NULL,
          name          TEXT NOT NULL,
          description   TEXT,
          parent_id     TEXT,
          image_url     TEXT,
          position      INTEGER NOT NULL DEFAULT 0,
          product_count INTEGER NOT NULL DEFAULT 0,
          platform      TEXT NOT NULL,
          platform_id   TEXT,
          level         INTEGER NOT NULL DEFAULT 0,
          path          TEXT NOT NULL DEFAULT '[]',
          status        TEXT NOT NULL DEFAULT 'active'
                          CHECK(status IN ('active', 'hidden', 'archived')),
          created_at    INTEGER NOT NULL,
          updated_at    INTEGER NOT NULL
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_categories_platform  ON categories(platform);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON categories(parent_id);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_categories_status    ON categories(status);`);

      logger.info('All tables created.');
    }

    // ── v2 – Consolidate settings into key_value_store ─────────────────
    if (fromVersion < 2) {
      logger.info('Applying v2: merging settings → key_value_store…');

      // Copy any rows from the old settings table into key_value_store
      const tableExists = await db.getFirstAsync<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'");

      if (tableExists) {
        const now = Date.now();
        const rows = await db.getAllAsync<{ key: string; value: string; updated_at: number }>(
          'SELECT key, value, updated_at FROM settings'
        );

        for (const row of rows) {
          await db.runAsync(
            `INSERT INTO key_value_store (key, value, created_at, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
            [row.key, row.value, row.updated_at ?? now, row.updated_at ?? now]
          );
        }

        await db.runAsync('DROP TABLE settings');
        logger.info(`Migrated ${rows.length} settings rows and dropped settings table.`);
      } else {
        logger.info('No settings table found — nothing to migrate.');
      }
    }

    // ── v3 – Tax profiles, returns, customers cache, order customer_id ──
    if (fromVersion < 3) {
      logger.info('Applying v3: creating tax_profiles, returns, customers_cache tables…');

      // Tax Profiles
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS tax_profiles (
          id          TEXT PRIMARY KEY NOT NULL,
          name        TEXT NOT NULL,
          rate        REAL NOT NULL,
          is_default  INTEGER NOT NULL DEFAULT 0,
          is_active   INTEGER NOT NULL DEFAULT 1,
          region      TEXT,
          description TEXT,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_tax_profiles_active ON tax_profiles(is_active);`);

      // Returns
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS returns (
          id                TEXT PRIMARY KEY NOT NULL,
          order_id          TEXT NOT NULL,
          order_item_id     TEXT,
          product_id        TEXT NOT NULL,
          variant_id        TEXT,
          product_name      TEXT NOT NULL,
          quantity          INTEGER NOT NULL,
          refund_amount     REAL NOT NULL,
          reason            TEXT,
          restock           INTEGER NOT NULL DEFAULT 1,
          status            TEXT NOT NULL DEFAULT 'pending'
                              CHECK(status IN ('pending','approved','rejected','completed')),
          processed_by      TEXT,
          processed_at      INTEGER,
          created_at        INTEGER NOT NULL,
          updated_at        INTEGER NOT NULL,
          FOREIGN KEY (order_id) REFERENCES orders(id)
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_returns_order   ON returns(order_id);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_returns_status  ON returns(status);`);

      // Product Variants (offline cache of platform variant data)
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS product_variants (
          id                  TEXT PRIMARY KEY NOT NULL,
          product_id          TEXT NOT NULL,
          title               TEXT NOT NULL,
          sku                 TEXT,
          barcode             TEXT,
          price               REAL NOT NULL,
          compare_at_price    REAL,
          cost_price          REAL,
          inventory_quantity  INTEGER NOT NULL DEFAULT 0,
          track_inventory     INTEGER NOT NULL DEFAULT 1,
          allow_backorder     INTEGER NOT NULL DEFAULT 0,
          weight              REAL,
          weight_unit         TEXT NOT NULL DEFAULT 'g',
          requires_shipping   INTEGER NOT NULL DEFAULT 1,
          taxable             INTEGER NOT NULL DEFAULT 1,
          tax_code            TEXT,
          option_values       TEXT NOT NULL DEFAULT '[]',
          image_id            TEXT,
          is_available        INTEGER NOT NULL DEFAULT 1,
          position            INTEGER NOT NULL DEFAULT 0,
          created_at          INTEGER NOT NULL,
          updated_at          INTEGER NOT NULL,
          FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_product_variants_sku     ON product_variants(sku);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_product_variants_barcode ON product_variants(barcode);`);

      // Customers cache (for offline access to platform customers)
      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS customers_cache (
          id              TEXT PRIMARY KEY NOT NULL,
          platform        TEXT NOT NULL,
          platform_id     TEXT NOT NULL,
          email           TEXT,
          first_name      TEXT,
          last_name       TEXT,
          phone           TEXT,
          total_orders    INTEGER NOT NULL DEFAULT 0,
          total_spent     REAL NOT NULL DEFAULT 0,
          cached_at       INTEGER NOT NULL
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_customers_cache_platform ON customers_cache(platform);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_customers_cache_email    ON customers_cache(email);`);

      // Add customer_id column to orders table
      const colExists = await db.getFirstAsync<{ cid: number }>(`SELECT cid FROM pragma_table_info('orders') WHERE name = 'customer_id'`);
      if (!colExists) {
        await db.runAsync(`ALTER TABLE orders ADD COLUMN customer_id TEXT`);
      }

      // Add customer_id column to baskets table
      const basketColExists = await db.getFirstAsync<{ cid: number }>(
        `SELECT cid FROM pragma_table_info('baskets') WHERE name = 'customer_id'`
      );
      if (!basketColExists) {
        await db.runAsync(`ALTER TABLE baskets ADD COLUMN customer_id TEXT`);
      }

      logger.info('v3 tables and columns created.');
    }

    // Stamp the version
    await db.runAsync(`PRAGMA user_version = ${toVersion}`);
    logger.info(`Database migration complete. Version is now ${toVersion}.`);
  });
}
