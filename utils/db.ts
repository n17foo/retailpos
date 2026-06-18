/* eslint-disable no-console */
import * as SQLite from 'expo-sqlite';
import { initializeSchema } from './dbSchema';

let dbInstance: SQLite.SQLiteDatabase | null = null;
const dbPromise = SQLite.openDatabaseAsync('retailPOS.db')
  .then(async database => {
    console.log('[DB] Database retailPOS.db opened successfully');
    dbInstance = database;
    if (process.env.NODE_ENV !== 'test') {
      console.log('[DB] Initializing schema...');
      try {
        await initializeSchema(database);
        console.log('[DB] Schema initialized successfully');
      } catch (e) {
        console.error('[DB] Failed to initialize schema:', e);
        throw e;
      }
    }
    return database;
  })
  .catch(err => {
    console.error('[DB] Error opening database retailPOS.db:', err);
    throw err;
  });

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

      return dbPromise.then(resolvedDb => {
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
