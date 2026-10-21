import { InstoreApiOrderRepository } from './InstoreApiOrderRepository';
import { instoreApiClient } from '../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import { pendingOrderStore } from '../../multi-register/services/offline/PendingOrderStore';
import { isStoreApiUnavailable } from '../../multi-register/services/offline/isStoreApiUnavailable';
import type { CreateOrderInput, OrderRow } from './OrderRepository';
import type { CreateOrderItemInput } from './OrderItemRepository';

jest.mock('../../platform-clients/services/clients/instoreapi/InstoreApiClient', () => ({
  instoreApiClient: {
    createOrder: jest.fn(),
    getOrders: jest.fn(),
    getOrdersInRange: jest.fn(),
    getOrder: jest.fn(),
    getUnsyncedOrders: jest.fn(),
    updateOrderStatus: jest.fn(),
    updateOrderPayment: jest.fn(),
    updateOrderSync: jest.fn(),
    claimOrderSync: jest.fn(),
  },
}));

jest.mock('../../multi-register/services/offline/PendingOrderStore', () => ({
  pendingOrderStore: {
    queueOrder: jest.fn(),
    isPending: jest.fn(),
    listPending: jest.fn(),
    findPendingById: jest.fn(),
    applyOrQueueStatus: jest.fn(),
    applyOrQueuePayment: jest.fn(),
    applyOrQueueSyncResult: jest.fn(),
  },
}));

const client = instoreApiClient as jest.Mocked<typeof instoreApiClient>;
const store = pendingOrderStore as jest.Mocked<typeof pendingOrderStore>;

const LAN_DOWN = new TypeError('Network request failed');
const HTTP_500 = new Error('POST /api/orders failed: 500');

function makeInput(): CreateOrderInput {
  return {
    id: 'ord-1',
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

function makeItem(): CreateOrderItemInput {
  return { orderId: 'ord-1', productId: 'p1', name: 'Item', price: 10, quantity: 1, taxable: false };
}

function makeRow(id: string): OrderRow {
  return {
    id,
    platform_order_id: null,
    platform: null,
    subtotal: 10,
    tax: 0,
    total: 10,
    discount_amount: null,
    discount_code: null,
    customer_email: null,
    customer_name: null,
    note: null,
    sale_mode: null,
    payment_method: 'cash',
    payment_transaction_id: null,
    cashier_id: 'u1',
    cashier_name: 'Cashier',
    status: 'paid',
    sync_status: 'pending_upload',
    sync_error: null,
    register_id: 'reg-1',
    created_at: 1000,
    updated_at: 1000,
    paid_at: 1000,
    synced_at: null,
    payments_json: null,
  };
}

describe('isStoreApiUnavailable', () => {
  it('flags fetch-level failures only', () => {
    expect(isStoreApiUnavailable(new TypeError('Network request failed'))).toBe(true);
    expect(isStoreApiUnavailable(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBe(true);
    expect(isStoreApiUnavailable(HTTP_500)).toBe(false);
    expect(isStoreApiUnavailable(new Error('invalid PIN'))).toBe(false);
  });
});

describe('InstoreApiOrderRepository — LAN degraded', () => {
  const repo = new InstoreApiOrderRepository();

  beforeEach(() => jest.clearAllMocks());

  it('queues createWithItems locally when the server is unreachable', async () => {
    client.createOrder.mockRejectedValue(LAN_DOWN);
    const input = makeInput();
    const items = [makeItem()];

    await repo.createWithItems(input, items);

    expect(store.queueOrder).toHaveBeenCalledWith(input, items);
  });

  it('propagates real HTTP errors instead of queueing', async () => {
    client.createOrder.mockRejectedValue(HTTP_500);
    await expect(repo.createWithItems(makeInput(), [])).rejects.toThrow('500');
    expect(store.queueOrder).not.toHaveBeenCalled();
  });

  it('queues status updates on server-known orders, applies locally on pending ones', async () => {
    client.updateOrderStatus.mockRejectedValue(LAN_DOWN);
    store.isPending.mockResolvedValueOnce(false);
    await repo.updateStatus('ord-9', 'cancelled');
    expect(store.applyOrQueueStatus).toHaveBeenCalledWith('ord-9', 'cancelled');
  });

  it('merges locally-queued orders into findAll while degraded', async () => {
    client.getOrders.mockRejectedValue(LAN_DOWN);
    store.listPending.mockResolvedValue([makeRow('ord-local')]);
    const rows = await repo.findAll();
    expect(rows.map(r => r.id)).toEqual(['ord-local']);
  });

  it('merges pending rows alongside server results while online', async () => {
    client.getOrders.mockResolvedValue([makeRow('ord-remote')]);
    store.listPending.mockResolvedValue([makeRow('ord-local')]);
    const rows = await repo.findAll();
    expect(rows.map(r => r.id).sort()).toEqual(['ord-local', 'ord-remote']);
  });

  it('returns false for claimSync while degraded (platform push retries post-recovery)', async () => {
    client.claimOrderSync.mockRejectedValue(LAN_DOWN);
    expect(await repo.claimSync('ord-1')).toBe(false);
  });
});
