/**
 * SYS-01 regression — the database proxy must not hand out a live handle
 * before safety pragmas, the integrity check, and schema migrations have all
 * completed. Calls issued while initialization is in flight must queue behind
 * the init promise.
 */

const calls: string[] = [];
let releaseSchema: () => void = () => undefined;

const fakeDb = {
  execAsync: jest.fn(async (sql: string) => {
    calls.push(`exec:${sql.trim()}`);
    return [];
  }),
  getAllAsync: jest.fn(async () => [{ quick_check: 'ok' }]),
  getFirstAsync: jest.fn(async () => null),
  runAsync: jest.fn(async () => {
    calls.push('runAsync');
    return { changes: 0 };
  }),
  backupDatabaseAsync: jest.fn(),
  closeAsync: jest.fn(async () => undefined),
};

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => fakeDb),
  backupDatabaseAsync: jest.fn(async () => undefined),
}));

jest.mock('./dbSchema', () => ({
  initializeSchema: jest.fn(async () => {
    calls.push('initSchema:start');
    await new Promise<void>(resolve => {
      releaseSchema = resolve;
    });
    calls.push('initSchema:done');
  }),
}));

describe('SYS-01 — db handle not published until ready', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it('a call issued during migration resolves only after schema init completes', async () => {
    // The guard skips init work under NODE_ENV=test — flip it so the real
    // initialization path runs against the mocks.
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    const { db } = await import('./db');

    // Issue a query while the schema migration is still gated.
    const pending = db.runAsync('INSERT INTO t VALUES (1)', []);

    // Wait until the init chain reaches the (still-gated) schema step, then
    // prove the call above hasn't touched the raw handle.
    for (let i = 0; i < 100 && !calls.includes('initSchema:start'); i++) {
      await Promise.resolve();
    }
    expect(calls).toContain('initSchema:start');
    expect(calls).not.toContain('runAsync');

    releaseSchema();
    await pending;

    expect(calls.indexOf('runAsync')).toBeGreaterThan(calls.indexOf('initSchema:done'));
  });
});
