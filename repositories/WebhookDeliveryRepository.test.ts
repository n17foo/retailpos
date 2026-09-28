import { WebhookDeliveryRepository } from './WebhookDeliveryRepository';
import type { SQLiteDatabase } from 'expo-sqlite';

function makeDatabase(initial?: { status: string; expires_at: number }) {
  const runAsync = jest.fn(async (sql: string) => {
    if (sql.includes('INSERT OR IGNORE')) {
      return { changes: initial ? 0 : 1, lastInsertRowId: 0 };
    }
    if (sql.includes('UPDATE webhook_deliveries') && initial) {
      const reclaimable = initial.status === 'failed' || initial.expires_at <= Date.now();
      return { changes: reclaimable ? 1 : 0, lastInsertRowId: 0 };
    }
    return { changes: 1, lastInsertRowId: 0 };
  });
  const getFirstAsync = jest.fn(async () => initial ?? null);
  const database = {
    runAsync,
    getFirstAsync,
    withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => {
      await callback();
    }),
  } as unknown as SQLiteDatabase;
  return { database, runAsync, getFirstAsync };
}

describe('WebhookDeliveryRepository', () => {
  it('atomically claims a new delivery', async () => {
    const { database, runAsync } = makeDatabase();
    const repository = new WebhookDeliveryRepository(database);

    await expect(repository.claim('commercefull', 'delivery-key')).resolves.toBe('claimed');
    expect(runAsync.mock.calls[0][0]).toContain('INSERT OR IGNORE INTO webhook_deliveries');
  });

  it('does not reclaim a completed delivery', async () => {
    const { database } = makeDatabase({ status: 'completed', expires_at: Date.now() + 60_000 });
    const repository = new WebhookDeliveryRepository(database);

    await expect(repository.claim('commercefull', 'delivery-key')).resolves.toBe('duplicate');
  });

  it('allows a failed delivery to be retried', async () => {
    const { database, runAsync } = makeDatabase({ status: 'failed', expires_at: Date.now() + 60_000 });
    const repository = new WebhookDeliveryRepository(database);

    await expect(repository.claim('commercefull', 'delivery-key')).resolves.toBe('claimed');
    expect(runAsync.mock.calls[1][0]).toContain("status = 'processing'");
  });

  it('reports an active in-flight delivery as processing', async () => {
    const { database, runAsync } = makeDatabase({ status: 'processing', expires_at: Date.now() + 60_000 });
    runAsync.mockResolvedValueOnce({ changes: 0, lastInsertRowId: 0 });
    const repository = new WebhookDeliveryRepository(database);

    await expect(repository.claim('commercefull', 'delivery-key')).resolves.toBe('processing');
  });
});
