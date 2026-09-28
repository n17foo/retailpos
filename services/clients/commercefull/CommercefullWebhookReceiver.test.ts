jest.mock('../../logger/LoggerFactory', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
    }),
  },
}));

import { CommercefullWebhookReceiver } from './CommercefullWebhookReceiver';
import type { CommercefullSyncService } from '../../sync/platforms/CommercefullSyncService';
import type { WebhookDeliveryStore } from '../../../repositories/WebhookDeliveryRepository';

function makeSyncService() {
  return {
    getWebhookSecret: jest.fn(() => 'webhook-secret'),
    getWebhookEndpointId: jest.fn(() => 'endpoint-1'),
    verifyWebhookSignature: jest.fn(() => true),
    handleWebhookEvent: jest.fn(async () => undefined),
  };
}

function makeDeliveryStore() {
  const completed = new Set<string>();
  return {
    claim: jest.fn(async (_provider: string, key: string) => (completed.has(key) ? 'duplicate' : 'claimed')),
    markCompleted: jest.fn(async (_provider: string, key: string) => {
      completed.add(key);
    }),
    markFailed: jest.fn(async () => undefined),
    purgeExpired: jest.fn(async () => undefined),
  } as WebhookDeliveryStore & {
    claim: jest.Mock;
    markCompleted: jest.Mock;
    markFailed: jest.Mock;
    purgeExpired: jest.Mock;
  };
}

describe('CommercefullWebhookReceiver', () => {
  it('processes a signed delivery only once', async () => {
    const receiver = CommercefullWebhookReceiver.getInstance();
    const syncService = makeSyncService();
    receiver.setSyncService(syncService as unknown as CommercefullSyncService);
    receiver.setDeliveryStore(makeDeliveryStore());
    const body = JSON.stringify({ event: 'product.updated', data: { id: 'p1' }, timestamp: new Date().toISOString() });
    const headers = { 'x-webhook-signature': 'a'.repeat(64), 'x-webhook-delivery-id': 'delivery-replay-test' };

    const first = await receiver.handleRequest(body, headers);
    const replay = await receiver.handleRequest(body, headers);
    await Promise.resolve();

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ duplicate: true });
    expect(syncService.handleWebhookEvent).toHaveBeenCalledTimes(1);
  });

  it('marks failed deliveries retryable instead of acknowledging them', async () => {
    const receiver = CommercefullWebhookReceiver.getInstance();
    const syncService = makeSyncService();
    const deliveryStore = makeDeliveryStore();
    receiver.setSyncService(syncService as unknown as CommercefullSyncService);
    receiver.setDeliveryStore(deliveryStore);
    syncService.handleWebhookEvent.mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce(undefined);
    const body = JSON.stringify({ event: 'order.updated', data: { id: 'o1' }, timestamp: new Date().toISOString() });
    const headers = { 'x-webhook-signature': 'd'.repeat(64), 'x-webhook-delivery-id': 'delivery-failure-test' };

    const first = await receiver.handleRequest(body, headers);
    const retry = await receiver.handleRequest(body, headers);

    expect(first.status).toBe(500);
    expect(deliveryStore.markFailed).toHaveBeenCalledTimes(1);
    expect(retry.status).toBe(200);
    expect(syncService.handleWebhookEvent).toHaveBeenCalledTimes(2);
  });

  it('accepts numeric webhook timestamps', async () => {
    const receiver = CommercefullWebhookReceiver.getInstance();
    const syncService = makeSyncService();
    receiver.setSyncService(syncService as unknown as CommercefullSyncService);
    receiver.setDeliveryStore(makeDeliveryStore());
    const body = JSON.stringify({ event: 'inventory.updated', data: { id: 'i1' }, timestamp: Math.floor(Date.now() / 1000) });

    const result = await receiver.handleRequest(body, {
      'x-webhook-signature': 'e'.repeat(64),
      'x-webhook-delivery-id': 'delivery-numeric-timestamp-test',
    });

    expect(result.status).toBe(200);
    expect(syncService.handleWebhookEvent).toHaveBeenCalledTimes(1);
  });

  it('rejects stale signed deliveries', async () => {
    const receiver = CommercefullWebhookReceiver.getInstance();
    const syncService = makeSyncService();
    receiver.setSyncService(syncService as unknown as CommercefullSyncService);
    receiver.setDeliveryStore(makeDeliveryStore());
    const body = JSON.stringify({ event: 'product.updated', data: { id: 'p1' }, timestamp: '2020-01-01T00:00:00.000Z' });

    const result = await receiver.handleRequest(body, {
      'x-webhook-signature': 'c'.repeat(64),
      'x-webhook-delivery-id': 'delivery-stale-test',
    });

    expect(result.status).toBe(400);
    expect(syncService.handleWebhookEvent).not.toHaveBeenCalled();
  });

  it('rejects malformed event envelopes after signature verification', async () => {
    const receiver = CommercefullWebhookReceiver.getInstance();
    const syncService = makeSyncService();
    receiver.setSyncService(syncService as unknown as CommercefullSyncService);
    receiver.setDeliveryStore(makeDeliveryStore());

    const result = await receiver.handleRequest('{"event":123,"data":null}', {
      'x-webhook-signature': 'b'.repeat(64),
      'x-webhook-delivery-id': 'delivery-malformed-test',
    });

    expect(result.status).toBe(400);
    expect(syncService.handleWebhookEvent).not.toHaveBeenCalled();
  });
});
