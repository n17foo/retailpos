import * as SQLite from 'expo-sqlite';
import { initializeSchema } from './dbSchema';
import { LoggerFactory } from '../services/logger/LoggerFactory';

const logger = LoggerFactory.getInstance().createLogger('DB');

let dbInstance: SQLite.SQLiteDatabase | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Opens (and on first call, migrates) the database. A failure clears the cached
 * promise so the next call retries instead of poisoning persistence forever.
 */
function getDbPromise(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('retailPOS.db')
      .then(async database => {
        logger.info('Database retailPOS.db opened successfully');
        dbInstance = database;
        if (process.env.NODE_ENV !== 'test') {
          logger.info('Initializing schema…');
          try {
            await initializeSchema(database);
            logger.info('Schema initialized successfully');
          } catch (e) {
            logger.error({ message: 'Failed to initialize schema' }, e instanceof Error ? e : new Error(String(e)));
            throw e;
          }
        }
        return database;
      })
      .catch(err => {
        logger.error({ message: 'Error opening database retailPOS.db' }, err instanceof Error ? err : new Error(String(err)));
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
