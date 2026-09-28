import { type SQLiteDatabase } from 'expo-sqlite';
import { LoggerFactory } from '../services/logger/LoggerFactory';

const logger = LoggerFactory.getInstance().createLogger('dbSchema');

/**
 * Current database schema version.
 * Bump this number and add a migration block whenever the schema changes.
 */
export const LATEST_DB_VERSION = 10;

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
          exchange_order_id TEXT,
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

    // ── v4 – payments_json on orders, exchange_order_id on returns ──────
    if (fromVersion < 4) {
      logger.info('Applying v4: adding payments_json to orders, exchange_order_id to returns…');
      await db.runAsync(`ALTER TABLE orders ADD COLUMN payments_json TEXT`);

      const exchangeColExists = await db.getFirstAsync<{ cid: number }>(
        `SELECT cid FROM pragma_table_info('returns') WHERE name = 'exchange_order_id'`
      );
      if (!exchangeColExists) {
        await db.runAsync(`ALTER TABLE returns ADD COLUMN exchange_order_id TEXT`);
      }
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_returns_exchange ON returns(exchange_order_id)`);
      logger.info('v4 migration complete.');
    }

    // ── v5 – Permission sets, overrides, user assignments, approval log ──
    if (fromVersion < 5) {
      logger.info('Applying v5: creating permission tables…');

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS permission_sets (
          id          TEXT PRIMARY KEY NOT NULL,
          name        TEXT NOT NULL,
          description TEXT,
          created_by  TEXT,
          created_at  INTEGER NOT NULL,
          updated_at  INTEGER NOT NULL
        );
      `);

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS permission_overrides (
          id                TEXT PRIMARY KEY NOT NULL,
          permission_set_id TEXT NOT NULL,
          action_key        TEXT NOT NULL,
          granted           INTEGER NOT NULL DEFAULT 1,
          created_at        INTEGER NOT NULL,
          FOREIGN KEY (permission_set_id) REFERENCES permission_sets(id) ON DELETE CASCADE,
          UNIQUE(permission_set_id, action_key)
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_perm_overrides_set ON permission_overrides(permission_set_id);`);

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS user_permission_sets (
          user_id           TEXT NOT NULL,
          permission_set_id TEXT NOT NULL,
          assigned_at       INTEGER NOT NULL,
          PRIMARY KEY (user_id, permission_set_id),
          FOREIGN KEY (permission_set_id) REFERENCES permission_sets(id) ON DELETE CASCADE
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_user_perm_sets_user ON user_permission_sets(user_id);`);

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS approval_log (
          id                   TEXT PRIMARY KEY NOT NULL,
          action_key           TEXT NOT NULL,
          requesting_user_id   TEXT NOT NULL,
          approving_user_id    TEXT NOT NULL,
          approved             INTEGER NOT NULL DEFAULT 1,
          created_at           INTEGER NOT NULL
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_approval_log_user ON approval_log(requesting_user_id);`);

      logger.info('v5 permission tables created.');
    }

    // ── v6 – Local customers, loyalty ledger, store credit ledger ────────
    if (fromVersion < 6) {
      logger.info('Applying v6: creating local_customers, loyalty_accounts, loyalty_transactions, store_credit_ledger…');

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS local_customers (
          id           TEXT PRIMARY KEY NOT NULL,
          email        TEXT NOT NULL UNIQUE,
          name         TEXT,
          phone        TEXT,
          notes        TEXT,
          segment      TEXT,
          total_orders INTEGER NOT NULL DEFAULT 0,
          total_spend  REAL    NOT NULL DEFAULT 0,
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_local_customers_email   ON local_customers(email);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_local_customers_segment ON local_customers(segment);`);

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS loyalty_accounts (
          id               TEXT PRIMARY KEY NOT NULL,
          customer_email   TEXT NOT NULL UNIQUE,
          balance          INTEGER NOT NULL DEFAULT 0,
          lifetime_earned  INTEGER NOT NULL DEFAULT 0,
          tier             TEXT,
          created_at       INTEGER NOT NULL,
          updated_at       INTEGER NOT NULL
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_email ON loyalty_accounts(customer_email);`);

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS loyalty_transactions (
          id             TEXT PRIMARY KEY NOT NULL,
          customer_email TEXT NOT NULL,
          type           TEXT NOT NULL CHECK(type IN ('earn','redeem','adjustment','reversal','expire')),
          points         INTEGER NOT NULL,
          order_id       TEXT,
          reason         TEXT,
          created_by     TEXT,
          created_at     INTEGER NOT NULL
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_loyalty_tx_email ON loyalty_transactions(customer_email);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_loyalty_tx_order ON loyalty_transactions(order_id);`);

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS store_credit_ledger (
          id             TEXT PRIMARY KEY NOT NULL,
          customer_email TEXT NOT NULL,
          type           TEXT NOT NULL CHECK(type IN ('issue','redeem','expire','reversal')),
          amount_cents   INTEGER NOT NULL,
          order_id       TEXT,
          reason         TEXT,
          created_by     TEXT,
          created_at     INTEGER NOT NULL
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_sc_ledger_email ON store_credit_ledger(customer_email);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_sc_ledger_order ON store_credit_ledger(order_id);`);

      logger.info('v6 CRM/loyalty/store-credit tables created.');
    }

    // ── v7 – Procurement: vendors, POs, inventory counts, transfers ──────
    if (fromVersion < 7) {
      logger.info('Applying v7: creating procurement tables…');

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS vendors (
          id           TEXT PRIMARY KEY NOT NULL,
          name         TEXT NOT NULL,
          contact_name TEXT,
          email        TEXT,
          phone        TEXT,
          address      TEXT,
          notes        TEXT,
          created_at   INTEGER NOT NULL,
          updated_at   INTEGER NOT NULL,
          deleted_at   INTEGER
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);`);

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id            TEXT PRIMARY KEY NOT NULL,
          vendor_id     TEXT,
          status        TEXT NOT NULL DEFAULT 'draft'
                          CHECK(status IN ('draft','ordered','partially_received','received','cancelled')),
          expected_date INTEGER,
          notes         TEXT,
          ordered_at    INTEGER,
          created_by    TEXT,
          created_at    INTEGER NOT NULL,
          updated_at    INTEGER NOT NULL
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_po_vendor ON purchase_orders(vendor_id);`);

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS purchase_order_items (
          id                  TEXT PRIMARY KEY NOT NULL,
          purchase_order_id   TEXT NOT NULL,
          product_id          TEXT NOT NULL,
          variant_id          TEXT,
          product_name        TEXT NOT NULL,
          ordered_qty         INTEGER NOT NULL,
          received_qty        INTEGER NOT NULL DEFAULT 0,
          unit_cost           REAL NOT NULL DEFAULT 0,
          FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_poi_po ON purchase_order_items(purchase_order_id);`);

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS inventory_counts (
          id           TEXT PRIMARY KEY NOT NULL,
          status       TEXT NOT NULL DEFAULT 'in_progress'
                         CHECK(status IN ('in_progress','completed','discarded')),
          started_by   TEXT,
          started_at   INTEGER NOT NULL,
          completed_at INTEGER,
          notes        TEXT
        );
      `);

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS inventory_count_items (
          id           TEXT PRIMARY KEY NOT NULL,
          count_id     TEXT NOT NULL,
          product_id   TEXT NOT NULL,
          variant_id   TEXT,
          product_name TEXT NOT NULL,
          sku          TEXT,
          expected_qty INTEGER NOT NULL DEFAULT 0,
          counted_qty  INTEGER,
          FOREIGN KEY (count_id) REFERENCES inventory_counts(id) ON DELETE CASCADE
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_count_items_count ON inventory_count_items(count_id);`);

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS transfer_orders (
          id            TEXT PRIMARY KEY NOT NULL,
          from_location TEXT NOT NULL,
          to_location   TEXT NOT NULL,
          status        TEXT NOT NULL DEFAULT 'draft'
                          CHECK(status IN ('draft','in_transit','received','cancelled')),
          notes         TEXT,
          created_by    TEXT,
          created_at    INTEGER NOT NULL,
          updated_at    INTEGER NOT NULL
        );
      `);

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS transfer_order_items (
          id                TEXT PRIMARY KEY NOT NULL,
          transfer_order_id TEXT NOT NULL,
          product_id        TEXT NOT NULL,
          variant_id        TEXT,
          product_name      TEXT NOT NULL,
          transfer_qty      INTEGER NOT NULL,
          FOREIGN KEY (transfer_order_id) REFERENCES transfer_orders(id) ON DELETE CASCADE
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_toi_transfer ON transfer_order_items(transfer_order_id);`);

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS product_inventory_config (
          product_id        TEXT NOT NULL,
          variant_id        TEXT NOT NULL DEFAULT '',
          reorder_point     INTEGER NOT NULL DEFAULT 0,
          reorder_qty       INTEGER NOT NULL DEFAULT 0,
          default_vendor_id TEXT,
          updated_at        INTEGER NOT NULL,
          PRIMARY KEY (product_id, variant_id)
        );
      `);

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS vendor_returns (
          id                TEXT PRIMARY KEY NOT NULL,
          purchase_order_id TEXT NOT NULL,
          vendor_id         TEXT NOT NULL,
          status            TEXT NOT NULL DEFAULT 'pending'
                              CHECK(status IN ('pending','confirmed','cancelled')),
          notes             TEXT,
          created_by        TEXT,
          created_at        INTEGER NOT NULL,
          updated_at        INTEGER NOT NULL
        );
      `);

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS vendor_return_items (
          id               TEXT PRIMARY KEY NOT NULL,
          vendor_return_id TEXT NOT NULL,
          product_id       TEXT NOT NULL,
          variant_id       TEXT,
          product_name     TEXT NOT NULL,
          return_qty       INTEGER NOT NULL,
          reason           TEXT,
          FOREIGN KEY (vendor_return_id) REFERENCES vendor_returns(id) ON DELETE CASCADE
        );
      `);

      logger.info('v7 procurement tables created.');
    }

    // ── v8 – Add register_id to orders and baskets ──────────────────────
    if (fromVersion < 8) {
      logger.info('Applying v8: adding register_id to orders and baskets…');

      // Add register_id column to orders table
      const orderRegisterColExists = await db.getFirstAsync<{ cid: number }>(
        `SELECT cid FROM pragma_table_info('orders') WHERE name = 'register_id'`
      );
      if (!orderRegisterColExists) {
        await db.runAsync(`ALTER TABLE orders ADD COLUMN register_id TEXT`);
        await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_orders_register ON orders(register_id)`);
      }

      // Add register_id column to baskets table
      const basketRegisterColExists = await db.getFirstAsync<{ cid: number }>(
        `SELECT cid FROM pragma_table_info('baskets') WHERE name = 'register_id'`
      );
      if (!basketRegisterColExists) {
        await db.runAsync(`ALTER TABLE baskets ADD COLUMN register_id TEXT`);
      }

      logger.info('v8 register_id columns added.');
    }

    // ── v9 – Add basket item snapshot fields to order_items ─────────────
    if (fromVersion < 9) {
      logger.info('Applying v9: adding snapshot fields to order_items…');

      // Add option_summary column
      const optionSummaryExists = await db.getFirstAsync<{ cid: number }>(
        `SELECT cid FROM pragma_table_info('order_items') WHERE name = 'option_summary'`
      );
      if (!optionSummaryExists) {
        await db.runAsync(`ALTER TABLE order_items ADD COLUMN option_summary TEXT`);
      }

      // Add tax_code column
      const taxCodeExists = await db.getFirstAsync<{ cid: number }>(
        `SELECT cid FROM pragma_table_info('order_items') WHERE name = 'tax_code'`
      );
      if (!taxCodeExists) {
        await db.runAsync(`ALTER TABLE order_items ADD COLUMN tax_code TEXT`);
      }

      // Add tax_profile_id column
      const taxProfileIdExists = await db.getFirstAsync<{ cid: number }>(
        `SELECT cid FROM pragma_table_info('order_items') WHERE name = 'tax_profile_id'`
      );
      if (!taxProfileIdExists) {
        await db.runAsync(`ALTER TABLE order_items ADD COLUMN tax_profile_id TEXT`);
      }

      // Add inventory_policy column
      const inventoryPolicyExists = await db.getFirstAsync<{ cid: number }>(
        `SELECT cid FROM pragma_table_info('order_items') WHERE name = 'inventory_policy'`
      );
      if (!inventoryPolicyExists) {
        await db.runAsync(`ALTER TABLE order_items ADD COLUMN inventory_policy TEXT`);
      }

      // Add catalog_version column
      const catalogVersionExists = await db.getFirstAsync<{ cid: number }>(
        `SELECT cid FROM pragma_table_info('order_items') WHERE name = 'catalog_version'`
      );
      if (!catalogVersionExists) {
        await db.runAsync(`ALTER TABLE order_items ADD COLUMN catalog_version TEXT`);
      }

      logger.info('v9 snapshot fields added to order_items.');
    }

    // ── v10 – Durable webhook delivery/idempotency records ────────────
    if (fromVersion < 10) {
      logger.info('Applying v10: creating webhook delivery tracking…');

      await db.runAsync(`
        CREATE TABLE IF NOT EXISTS webhook_deliveries (
          provider          TEXT NOT NULL,
          delivery_id       TEXT NOT NULL,
          status            TEXT NOT NULL
                            CHECK(status IN ('processing','completed','failed')),
          first_received_at INTEGER NOT NULL,
          last_received_at  INTEGER NOT NULL,
          completed_at      INTEGER,
          attempt_count     INTEGER NOT NULL DEFAULT 1,
          expires_at        INTEGER NOT NULL,
          PRIMARY KEY (provider, delivery_id)
        );
      `);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_expiry ON webhook_deliveries(expires_at);`);
      await db.runAsync(`CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);`);

      logger.info('v10 webhook delivery tracking created.');
    }

    // Stamp the version
    await db.runAsync(`PRAGMA user_version = ${toVersion}`);
    logger.info(`Database migration complete. Version is now ${toVersion}.`);
  });
}
