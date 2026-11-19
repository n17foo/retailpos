/**
 * RET-04 regression tests on real SQLite.
 *
 * Before the fix the Refund screen's "payment" and "ecommerce" modes accepted
 * any ID and any amount: refunds were recorded locally as 'completed' with no
 * order lookup, no cap, and — for terminal refunds — no payment provider call.
 * Now every refund must bind to a real paid order, fit within its remaining
 * refundable balance, and terminal refunds must be confirmed by the provider
 * before anything is recorded.
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

let uuidCounter = 0;
jest.mock('../../../../shared/utils/uuid', () => ({
  generateUUID: () => `mock-uuid-${++uuidCounter}`,
}));

jest.mock('../../../payments/services/PaymentService', () => ({
  __esModule: true,
  default: { refundTransaction: jest.fn() },
}));

jest.mock('../../../../shared/services/audit/AuditLogService', () => ({
  auditLogService: { log: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../../../shared/services/notifications/NotificationService', () => ({
  notificationService: { notify: jest.fn() },
}));

jest.mock('../../../fiscal/services/FiscalServiceFactory', () => ({
  getFiscalService: jest.fn(),
}));

import { db } from '../../../../shared/utils/db';
import { initializeSchema } from '../../../../shared/utils/dbSchema';
import { orderRepository } from '../../../orders-sync/repositories/OrderRepository';
import { ReturnService } from './RefundService';
import paymentService from '../../../payments/services/PaymentService';

const realDb = db as unknown as SQLiteDatabase;
const mockRefundTransaction = paymentService.refundTransaction as jest.Mock;

async function seedOrder(opts: { id: string; total: number; transactionId?: string; platformOrderId?: string }): Promise<void> {
  await orderRepository.createWithItems(
    {
      id: opts.id,
      platform: null,
      platformOrderId: opts.platformOrderId ?? null,
      subtotal: opts.total,
      tax: 0,
      total: opts.total,
      discountAmount: null,
      discountCode: null,
      customerEmail: null,
      customerName: null,
      note: null,
      cashierId: null,
      cashierName: null,
      status: 'paid',
    },
    [
      {
        orderId: opts.id,
        productId: 'p1',
        name: 'Widget',
        price: opts.total,
        quantity: 1,
        taxable: false,
      },
    ]
  );
  if (opts.transactionId) {
    await orderRepository.updatePayment(opts.id, 'card_terminal', opts.transactionId);
  }
}

describe('ReturnService refunds (RET-04)', () => {
  const svc = ReturnService.getInstance();

  beforeEach(async () => {
    await initializeSchema(realDb);
    await realDb.runAsync('DELETE FROM orders');
    await realDb.runAsync('DELETE FROM order_items');
    await realDb.runAsync('DELETE FROM returns');
    await realDb.runAsync("DELETE FROM key_value_store WHERE key = 'offline_local_refunds'");
    jest.clearAllMocks();
    await svc.initializeRefundService();
    // Clear the offline service's in-memory history — it is only loaded from
    // storage once, so deleting the stored key alone leaks between tests.
    const offline = (svc as unknown as { offlineRefundService?: { clearLocalRefunds(): Promise<void> } }).offlineRefundService;
    await offline?.clearLocalRefunds();
  });

  it('rejects a payment refund for a transaction that is not on record', async () => {
    const result = await svc.processPaymentRefund('ghost-txn', 10);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unknown transaction/);
    expect(mockRefundTransaction).not.toHaveBeenCalled();
  });

  it('rejects a payment refund that exceeds the remaining refundable balance', async () => {
    await seedOrder({ id: 'ord-1', total: 50, transactionId: 'txn-1' });

    const result = await svc.processPaymentRefund('txn-1', 50.01);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/remaining refundable/);
    expect(mockRefundTransaction).not.toHaveBeenCalled();
  });

  it('routes a terminal refund through the provider and records it after confirmation', async () => {
    await seedOrder({ id: 'ord-2', total: 50, transactionId: 'txn-2' });
    mockRefundTransaction.mockResolvedValue({ success: true, transactionId: 'txn-2', timestamp: new Date() });

    const result = await svc.processPaymentRefund('txn-2', 20);

    expect(result.success).toBe(true);
    expect(mockRefundTransaction).toHaveBeenCalledWith('txn-2', 20);

    const history = await svc.getRefundHistory('txn-2');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ status: 'completed', source: 'payment_terminal', amount: 20 });
  });

  it('records nothing when the provider declines the refund', async () => {
    await seedOrder({ id: 'ord-3', total: 50, transactionId: 'txn-3' });
    mockRefundTransaction.mockResolvedValue({ success: false, errorMessage: 'card_declined', timestamp: new Date() });

    const result = await svc.processPaymentRefund('txn-3', 20);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/declined/i);
    const history = await svc.getRefundHistory('txn-3');
    expect(history).toHaveLength(0);
  });

  it('rejects an ecommerce refund for an unknown order id', async () => {
    const result = await svc.processRefund('no-such-order', { amount: 5 });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('rejects an ecommerce refund above the remaining balance, then accepts within it', async () => {
    await seedOrder({ id: 'ord-4', total: 50 });

    const tooBig = await svc.processRefund('ord-4', { amount: 60 });
    expect(tooBig.success).toBe(false);
    expect(tooBig.error).toMatch(/remaining refundable/);

    const ok = await svc.processRefund('ord-4', { amount: 20 });
    expect(ok.success).toBe(true);

    // A second refund must fit the balance left by the first
    const overflow = await svc.processRefund('ord-4', { amount: 31 });
    expect(overflow.success).toBe(false);
  });

  it('resolves an order by its platform order id', async () => {
    await seedOrder({ id: 'ord-5', total: 50, platformOrderId: 'plat-99' });

    const result = await svc.processRefund('plat-99', { amount: 5 });

    expect(result.success).toBe(true);
  });

  it('rejects a refund for an unpaid order', async () => {
    await seedOrder({ id: 'ord-6', total: 50 });
    await orderRepository.updateStatus('ord-6', 'pending');

    const result = await svc.processRefund('ord-6', { amount: 5 });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/paid/);
  });
});
