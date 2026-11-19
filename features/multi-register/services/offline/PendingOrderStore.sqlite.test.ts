/**
 * Failure-injection tests for the LAN-outage queue — the expo-sqlite mock is
 * replaced by a real in-memory SQLite so pending_ops rows, order rows and
 * transactions behave exactly as on a register.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('expo-sqlite', () => {
  const { openDb } = require('../../../../tests/helpers/nodeSqliteAdapter');
  const real = openDb();
  return {
    openDatabaseAsync: jest.fn(async () => real),
    openDatabaseSync: jest.fn(() => real),
  };
});

jest.mock('../StoreApiHealthService', () => ({
  storeApiHealthService: {
    isDegraded: false,
    onRecovery: jest.fn(() => () => undefined),
    onStateChange: jest.fn(() => () => undefined),
  },
}));

jest.mock('../../../platform-clients/services/clients/instoreapi/InstoreApiClient', () => ({
  instoreApiClient: {
    createOrder: jest.fn(),
    updateOrderStatus: jest.fn(),
    updateOrderPayment: jest.fn(),
    updateOrderSync: jest.fn(),
  },
}));

import { db } from '../../../../shared/utils/db';
import { initializeSchema } from '../../../../shared/utils/dbSchema';
import { pendingOrderStore, PENDING_UPLOAD } from './PendingOrderStore';
import { instoreApiClient } from '../../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import { posConfig } from '../../../platform-clients/services/config/POSConfigService';
import { ApiError } from '../../../../shared/utils/apiErrors';
import type { CreateOrderInput } from '../../../orders-sync/repositories/OrderRepository';
import type { CreateOrderItemInput } from '../../../orders-sync/repositories/OrderItemRepository';

const client = instoreApiClient as jest.Mocked<typeof instoreApiClient>;
const realDb = db as unknown as SQLiteDatabase;

const LAN_DOWN = new TypeError('Network request failed');
const SERVER_REJECT = new ApiError(422, 'order rejected');

function makeInput(id: string): CreateOrderInput {
  return {
    id,
    platform: null,
    subtotal: 10,
    tax: 0,
    total: 10,
    discountAmount: null,
    discountCode: null,
    customerEmail: null,
    customerName: null,
    note: null,
    cashierId: 'u1',
    cashierName: 'Cashier',
    status: 'paid',
  };
}

function makeItem(orderId: string): CreateOrderItemInput {
  return { orderId, productId: 'p1', name: 'Item', price: 10, quantity: 1, taxable: false };
}

async function pendingOpCount(): Promise<number> {
  const rows = await realDb.getAllAsync<{ id: string }>('SELECT id FROM pending_ops');
  return rows.length;
}

beforeAll(async () => {
  await initializeSchema(realDb);
});

beforeEach(async () => {
  jest.clearAllMocks();
  // Shared :memory: db — each test owns a clean queue.
  await realDb.runAsync('DELETE FROM order_items');
  await realDb.runAsync('DELETE FROM orders');
  await realDb.runAsync('DELETE FROM pending_ops');
});

describe('queueOrder on real SQLite', () => {
  it('persists the order and items atomically with pending_upload', async () => {
    await pendingOrderStore.queueOrder(makeInput('ord-q1'), [makeItem('ord-q1')]);

    const order = await realDb.getFirstAsync<{ sync_status: string }>('SELECT sync_status FROM orders WHERE id = ?', ['ord-q1']);
    expect(order?.sync_status).toBe(PENDING_UPLOAD);
    const items = await realDb.getAllAsync('SELECT id FROM order_items WHERE order_id = ?', ['ord-q1']);
    expect(items).toHaveLength(1);
  });
});

describe('flush — outage and failure injection', () => {
  it('keeps the queued order untouched when the LAN is still down', async () => {
    await pendingOrderStore.queueOrder(makeInput('ord-down'), [makeItem('ord-down')]);
    client.createOrder.mockRejectedValue(LAN_DOWN);

    await pendingOrderStore.flush();

    const order = await realDb.getFirstAsync<{ sync_status: string; sync_error: string | null }>(
      'SELECT sync_status, sync_error FROM orders WHERE id = ?',
      ['ord-down']
    );
    expect(order?.sync_status).toBe(PENDING_UPLOAD);
    expect(order?.sync_error).toBeNull();
  });

  it('records a server rejection on the row but keeps it for retry', async () => {
    await pendingOrderStore.queueOrder(makeInput('ord-rej'), [makeItem('ord-rej')]);
    client.createOrder.mockRejectedValueOnce(SERVER_REJECT).mockResolvedValue({} as never);

    await pendingOrderStore.flush();
    const afterRejection = await realDb.getFirstAsync<{ sync_status: string; sync_error: string | null }>(
      'SELECT sync_status, sync_error FROM orders WHERE id = ?',
      ['ord-rej']
    );
    expect(afterRejection?.sync_status).toBe(PENDING_UPLOAD);
    expect(afterRejection?.sync_error).toContain('rejected');

    // Next cycle succeeds — order row and its items are removed locally.
    await pendingOrderStore.flush();
    expect(await realDb.getFirstAsync('SELECT id FROM orders WHERE id = ?', ['ord-rej'])).toBeNull();
    expect(await realDb.getAllAsync('SELECT id FROM order_items WHERE order_id = ?', ['ord-rej'])).toHaveLength(0);
  });

  it('keeps a failed op with an attempt counter instead of deleting it', async () => {
    await realDb.runAsync(
      `INSERT INTO orders (id, subtotal, tax, total, status, sync_status, created_at, updated_at)
       VALUES ('ord-live', 10, 0, 10, 'paid', 'synced', 1, 1)`
    );
    await pendingOrderStore.applyOrQueuePayment('ord-live', 'card', 'txn-9');
    expect(await pendingOpCount()).toBe(1);

    client.updateOrderPayment.mockRejectedValueOnce(SERVER_REJECT);
    await pendingOrderStore.flush();

    const op = await realDb.getFirstAsync<{ attempts: number; last_error: string | null; quarantined: number }>(
      'SELECT attempts, last_error, quarantined FROM pending_ops'
    );
    expect(op?.attempts).toBe(1);
    expect(op?.quarantined).toBe(0);
    expect(op?.last_error).toContain('rejected');
  });

  it('quarantines an op after max retries and stops replaying it', async () => {
    await posConfig.update('maxSyncRetries', 2);
    await realDb.runAsync(
      `INSERT INTO orders (id, subtotal, tax, total, status, sync_status, created_at, updated_at)
       VALUES ('ord-poison', 10, 0, 10, 'paid', 'synced', 1, 1)`
    );
    await realDb.runAsync(
      `INSERT INTO pending_ops (id, kind, payload, created_at) VALUES ('op-poison', 'update_status', '{"orderId":"ord-poison","status":"cancelled"}', 1)`
    );

    client.updateOrderStatus.mockRejectedValue(SERVER_REJECT);

    await pendingOrderStore.flush();
    await pendingOrderStore.flush();
    const op = await realDb.getFirstAsync<{ attempts: number; quarantined: number }>(
      'SELECT attempts, quarantined FROM pending_ops WHERE id = ?',
      ['op-poison']
    );
    expect(op?.attempts).toBe(2);
    expect(op?.quarantined).toBe(1);

    // Quarantined ops are never replayed again.
    const callsBefore = client.updateOrderStatus.mock.calls.length;
    await pendingOrderStore.flush();
    expect(client.updateOrderStatus.mock.calls.length).toBe(callsBefore);
  });
});
