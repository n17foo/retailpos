import * as SQLite from 'expo-sqlite';
import { initializeSchema } from './dbSchema';
import { LoggerFactory } from '../services/logger/LoggerFactory';

const logger = LoggerFactory.getInstance().createLogger('DB');

const DATABASE_NAME = 'retailPOS.db';
const BACKUP_DATABASE_NAME = 'retailPOS-backup.db';
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const LAST_BACKUP_KEY = 'db.lastBackupAt';

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Durability pragmas — WAL keeps reads unblocked during writes and
 * synchronous=FULL makes every committed transaction survive a power cut.
 */
async function applySafetyPragmas(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA journal_mode = WAL;');
  await database.execAsync('PRAGMA synchronous = FULL;');
}

/** Startup integrity check — surfaces corruption instead of silently writing into it. */
async function runIntegrityCheck(database: SQLite.SQLiteDatabase): Promise<void> {
  const rows = await database.getAllAsync<{ quick_check: string }>('PRAGMA quick_check');
  const problems = rows.map(r => r.quick_check).filter(r => r !== 'ok');
  if (problems.length > 0) {
    logger.error(
      { message: `Database integrity check failed — ${problems.join('; ')}. Restore from ${BACKUP_DATABASE_NAME} if reads misbehave.` },
      new Error('SQLite quick_check reported corruption')
    );
  }
}

/** Rotating single-file backup, at most once per BACKUP_INTERVAL_MS. Never fatal. */
async function maybeBackupDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  try {
    const row = await database.getFirstAsync<{ value: string }>('SELECT value FROM key_value_store WHERE key = ?', [LAST_BACKUP_KEY]);
    const lastBackupAt = row ? Number(row.value) : 0;
    if (Number.isFinite(lastBackupAt) && lastBackupAt > 0 && Date.now() - lastBackupAt < BACKUP_INTERVAL_MS) {
      return;
    }
    const dest = await SQLite.openDatabaseAsync(BACKUP_DATABASE_NAME);
    try {
      await SQLite.backupDatabaseAsync({ sourceDatabase: database, destDatabase: dest });
    } finally {
      await dest.closeAsync();
    }
    const now = Date.now();
    await database.runAsync(
      `INSERT INTO key_value_store (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      [LAST_BACKUP_KEY, String(now), now, now]
    );
    logger.info(`Database backed up to ${BACKUP_DATABASE_NAME}`);
  } catch (e) {
    logger.error({ message: 'Automatic database backup failed — continuing without it' }, e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Opens (and on first call, migrates) the database. A failure clears the cached
 * promise so the next call retries instead of poisoning persistence forever.
 */
function getDbPromise(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME)
      .then(async database => {
        logger.info(`Database ${DATABASE_NAME} opened successfully`);
        dbInstance = database;
        if (process.env.NODE_ENV !== 'test') {
          await applySafetyPragmas(database);
          await runIntegrityCheck(database);
          logger.info('Initializing schema…');
          try {
            await initializeSchema(database);
            logger.info('Schema initialized successfully');
          } catch (e) {
            logger.error({ message: 'Failed to initialize schema' }, e instanceof Error ? e : new Error(String(e)));
            throw e;
          }
          await maybeBackupDatabase(database);
        }
        return database;
      })
      .catch(err => {
        logger.error({ message: `Error opening database ${DATABASE_NAME}` }, err instanceof Error ? err : new Error(String(err)));
        // Allow the next access to retry the open instead of failing forever.
        dbInstance = null;
        dbPromise = null;
        throw err;
      });
  }
  return dbPromise;
}

// A Proxy that delegates database calls to the asynchronous dbInstance once ready
const db = new Proxy({} as SQLite.SQLiteDatabase, {
  get(_target, prop) {
    if (prop === 'then') {
      return undefined; // Do not treat db itself as a promise
    }

    return function (...args: unknown[]) {
      if (dbInstance) {
        const method = dbInstance[prop as keyof SQLite.SQLiteDatabase];
        if (typeof method === 'function') {
          return (method as (...args: unknown[]) => unknown).apply(dbInstance, args);
        }
        return method;
      }

      return getDbPromise().then(resolvedDb => {
        const method = resolvedDb[prop as keyof SQLite.SQLiteDatabase];
        if (typeof method === 'function') {
          return (method as (...args: unknown[]) => unknown).apply(resolvedDb, args);
        }
        return method;
      });
    };
  },
});

export { db };
