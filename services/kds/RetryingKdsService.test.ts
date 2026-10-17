/**
 * RetryingKdsService — unit tests
 *
 * Verifies failed tickets are persisted and replayed oldest-first on the next
 * successful send or reconnect. The KV layer is faked in memory; logger and
 * notifications are mocked.
 */

jest.mock('../logger/LoggerFactory', () => ({
  LoggerFactory: {
    getInstance: jest.fn(() => ({
      createLogger: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
    })),
  },
}));

jest.mock('../notifications/NotificationService', () => ({
  notificationService: { notify: jest.fn() },
}));

import { RetryingKdsService } from './RetryingKdsService';
import { PendingKdsTicketStore } from './PendingKdsTicketStore';
import { KdsOrder, KdsServiceInterface } from './KdsServiceInterface';

function memoryStore(): PendingKdsTicketStore {
  const store = new PendingKdsTicketStore();
  const data = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (store as any).kv = {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string | object) => {
      data.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    removeItem: async (key: string) => {
      data.delete(key);
    },
  };
  return store;
}

function fakeInner(sendImpl: (order: KdsOrder) => Promise<boolean>): KdsServiceInterface & { sent: KdsOrder[] } {
  const sent: KdsOrder[] = [];
  return {
    sent,
    driverType: 'http',
    sendOrder: jest.fn(async (order: KdsOrder) => {
      const ok = await sendImpl(order);
      if (ok) sent.push(order);
      return ok;
    }),
    recallOrder: jest.fn(async () => true),
    cancelOrder: jest.fn(async () => true),
    onStatusUpdate: jest.fn(() => 'sub-1'),
    offStatusUpdate: jest.fn(),
    isConnected: jest.fn(() => true),
    connect: jest.fn(async () => true),
    disconnect: jest.fn(async () => {}),
  };
}

const flush = () => new Promise(r => setTimeout(r, 20));

const ticket = (orderId: string): KdsOrder => ({
  orderId,
  orderRef: orderId.slice(-4),
  items: [{ id: 'p1', name: 'Burger', quantity: 1 }],
  placedAt: Date.now(),
});

describe('RetryingKdsService', () => {
  it('queues a ticket when the send fails and returns false', async () => {
    const store = memoryStore();
    const inner = fakeInner(async () => false);
    const service = new RetryingKdsService(inner, store);

    expect(await service.sendOrder(ticket('order-1'))).toBe(false);
    expect(await store.count()).toBe(1);

    const { notificationService } = jest.requireMock('../notifications/NotificationService');
    expect(notificationService.notify).toHaveBeenCalledWith('KDS Unreachable', expect.stringContaining('er-1'), 'warning');
  });

  it('queues on thrown send errors', async () => {
    const store = memoryStore();
    const inner = fakeInner(async () => Promise.reject(new Error('connection refused')));
    const service = new RetryingKdsService(inner, store);

    expect(await service.sendOrder(ticket('order-1'))).toBe(false);
    expect(await store.count()).toBe(1);
  });

  it('replays queued tickets oldest-first after a successful send', async () => {
    const store = memoryStore();
    let down = true;
    const inner = fakeInner(async () => !down);
    const service = new RetryingKdsService(inner, store);

    await service.sendOrder(ticket('order-1'));
    await service.sendOrder(ticket('order-2'));
    expect(await store.count()).toBe(2);
    expect(inner.sent).toHaveLength(0);

    down = false;
    expect(await service.sendOrder(ticket('order-3'))).toBe(true);
    await flush(); // drain runs asynchronously after the successful send

    // Queued tickets replay after the live send
    expect(inner.sent.map(o => o.orderId)).toEqual(['order-3', 'order-1', 'order-2']);
    expect(await store.count()).toBe(0);
  });

  it('drains queued tickets on reconnect', async () => {
    const store = memoryStore();
    const inner = fakeInner(async () => false);
    const service = new RetryingKdsService(inner, store);

    await service.sendOrder(ticket('order-1'));
    expect(await store.count()).toBe(1);

    inner.sendOrder = jest.fn(async (order: KdsOrder) => {
      inner.sent.push(order);
      return true;
    });

    await service.connect({});
    await flush(); // drain runs asynchronously after connect
    expect(inner.sent.map(o => o.orderId)).toEqual(['order-1']);
    expect(await store.count()).toBe(0);
  });

  it('coalesces re-dispatched tickets for the same order', async () => {
    const store = memoryStore();
    const inner = fakeInner(async () => false);
    const service = new RetryingKdsService(inner, store);

    await service.sendOrder(ticket('order-1'));
    await service.sendOrder(ticket('order-1'));

    expect(await store.count()).toBe(1);
  });
});
