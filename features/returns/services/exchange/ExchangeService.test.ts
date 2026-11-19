/**
 * RET-01 / RET-02 regression tests.
 *
 * RET-01: the exchange order must be built from the exchange session's
 * selected items — never from the live sale basket.
 * RET-02: confirmation requires 'exchange:process' permission (or a verified
 * approver), and settlement is recorded as explicit tender lines — including
 * the consumed return credit — that must cover the new order total.
 */
jest.mock('../../../../shared/services/logger/LoggerFactory', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
    }),
  },
}));

jest.mock('../../../../shared/services/audit/AuditLogService', () => ({
  auditLogService: { log: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../repositories/ReturnRepository', () => ({
  getReturnRepository: () => ({ delete: jest.fn(), linkToExchange: jest.fn() }),
}));

jest.mock('../../../authentication/services/permissions/PermissionService', () => ({
  permissionService: { can: jest.fn() },
}));

let uuidCounter = 0;
jest.mock('../../../../shared/utils/uuid', () => ({
  generateUUID: () => `uuid-${++uuidCounter}`,
}));

import { ExchangeService, ExchangeSession } from './ExchangeService';
import { ReturnService } from '../refunds/RefundService';
import { CheckoutServiceInterface } from '../../../checkout/services/CheckoutServiceInterface';
import { permissionService } from '../../../authentication/services/permissions/PermissionService';
import type { PaymentLine } from '../../../orders-sync/services/order/order';
import type { LocalOrder } from '../../../orders-sync/services/order/order';

const mockCan = permissionService.can as jest.Mock;

function makeReturnService(): jest.Mocked<Pick<ReturnService, 'processReturn'>> {
  return {
    processReturn: jest.fn().mockResolvedValue({ success: true, returnIds: ['ret-1'], totalRefund: 10 }),
  };
}

function makeCheckout(
  orderTotal = 10
): jest.Mocked<Pick<CheckoutServiceInterface, 'createOrderFromItems' | 'startCheckout' | 'completePayment'>> {
  return {
    createOrderFromItems: jest.fn().mockResolvedValue({ id: 'new-order-1', total: orderTotal } as LocalOrder),
    startCheckout: jest.fn(),
    completePayment: jest.fn().mockResolvedValue({ success: true, orderId: 'new-order-1' }),
  };
}

function makeSession(overrides: Partial<ExchangeSession> = {}): ExchangeSession {
  return {
    id: 'ex-1',
    originalOrderId: 'orig-order',
    returnItems: [{ orderItemId: 'oi-1', productId: 'p-old', productName: 'Old Item', quantity: 1, price: 10, refundAmount: 10 }],
    returnCredit: 10,
    newItems: [{ id: 'line-new', productId: 'p-new', name: 'New Item', price: 10, quantity: 1 }],
    newItemsTotal: 10,
    netDue: 0,
    payments: [],
    remainingDue: 0,
    ...overrides,
  };
}

function getService(returnService: ReturnService, checkout: CheckoutServiceInterface): ExchangeService {
  (ExchangeService as unknown as { instance?: ExchangeService }).instance = undefined;
  return ExchangeService.getInstance(returnService, checkout);
}

describe('ExchangeService.confirm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // cash-1 lacks exchange:process; mgr-1 holds it
    mockCan.mockImplementation(async (userId: string) => userId === 'mgr-1');
  });

  it('builds the new order from the exchange session items, not the live basket (RET-01)', async () => {
    const returnSvc = makeReturnService();
    const checkout = makeCheckout(10);
    const svc = getService(returnSvc as unknown as ReturnService, checkout as unknown as CheckoutServiceInterface);
    const session = makeSession();

    const result = await svc.confirm(session, 'mgr-1', 'Manager');

    expect(result.success).toBe(true);
    expect(checkout.createOrderFromItems).toHaveBeenCalledWith(session.newItems, 'mgr-1', 'Manager');
    expect(checkout.startCheckout).not.toHaveBeenCalled();
    // The exchange order must not touch the live basket when completing
    expect(checkout.completePayment).toHaveBeenCalledWith('new-order-1', expect.any(String), expect.anything(), expect.any(Array), {
      preserveBasket: true,
    });
  });

  it('settles an equal-value exchange with an explicit return-credit tender line (RET-02)', async () => {
    const returnSvc = makeReturnService();
    const checkout = makeCheckout(10);
    const svc = getService(returnSvc as unknown as ReturnService, checkout as unknown as CheckoutServiceInterface);

    const result = await svc.confirm(makeSession(), 'mgr-1', 'Manager');

    expect(result.success).toBe(true);
    const tenderLines = (checkout.completePayment as jest.Mock).mock.calls[0][3] as PaymentLine[];
    expect(tenderLines).toHaveLength(1);
    expect(tenderLines[0]).toMatchObject({ method: 'store_credit', amount: 10, transactionId: 'orig-order' });
    // Tender lines cover the order total exactly — no zero-tender 'other' payment
    expect(tenderLines.every(l => l.method !== 'other')).toBe(true);
  });

  it('rejects confirmation when neither cashier nor approver holds exchange:process (RET-02)', async () => {
    const returnSvc = makeReturnService();
    const checkout = makeCheckout(10);
    const svc = getService(returnSvc as unknown as ReturnService, checkout as unknown as CheckoutServiceInterface);

    const result = await svc.confirm(makeSession(), 'cash-1', 'Cashier');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/exchange permission|manager approval/);
    expect(returnSvc.processReturn).not.toHaveBeenCalled();
    expect(checkout.createOrderFromItems).not.toHaveBeenCalled();
  });

  it('accepts confirmation when the approver id holds exchange:process', async () => {
    const returnSvc = makeReturnService();
    const checkout = makeCheckout(10);
    const svc = getService(returnSvc as unknown as ReturnService, checkout as unknown as CheckoutServiceInterface);

    const result = await svc.confirm(makeSession(), 'cash-1', 'Cashier', { approvedByUserId: 'mgr-1' });

    expect(result.success).toBe(true);
    expect(mockCan).toHaveBeenCalledWith('mgr-1', 'exchange:process');
  });

  it('rejects a forged approver id that does not hold the permission', async () => {
    const returnSvc = makeReturnService();
    const checkout = makeCheckout(10);
    const svc = getService(returnSvc as unknown as ReturnService, checkout as unknown as CheckoutServiceInterface);

    const result = await svc.confirm(makeSession(), 'cash-1', 'Cashier', { approvedByUserId: 'cash-2' });

    expect(result.success).toBe(false);
    expect(returnSvc.processReturn).not.toHaveBeenCalled();
  });

  it('settles a top-up payment plus the remaining credit as tender lines', async () => {
    const returnSvc = makeReturnService();
    const checkout = makeCheckout(30);
    const svc = getService(returnSvc as unknown as ReturnService, checkout as unknown as CheckoutServiceInterface);
    const session = makeSession({
      newItems: [{ id: 'line-new', productId: 'p-new', name: 'New Item', price: 30, quantity: 1 }],
      newItemsTotal: 30,
      netDue: 20,
      remainingDue: 0,
      payments: [{ id: 'pay-1', method: 'cash', amount: 20, processedAt: Date.now() }],
    });

    const result = await svc.confirm(session, 'mgr-1', 'Manager');

    expect(result.success).toBe(true);
    const tenderLines = (checkout.completePayment as jest.Mock).mock.calls[0][3] as PaymentLine[];
    expect(tenderLines).toHaveLength(2);
    expect(tenderLines[0]).toMatchObject({ method: 'cash', amount: 20 });
    expect(tenderLines[1]).toMatchObject({ method: 'store_credit', amount: 10, transactionId: 'orig-order' });
    expect(tenderLines.reduce((s, p) => s + p.amount, 0)).toBe(30);
  });

  it('reports credit owed when the return exceeds the new order', async () => {
    const returnSvc = makeReturnService();
    const checkout = makeCheckout(8);
    const svc = getService(returnSvc as unknown as ReturnService, checkout as unknown as CheckoutServiceInterface);
    const session = makeSession({
      newItems: [{ id: 'line-new', productId: 'p-new', name: 'New Item', price: 8, quantity: 1 }],
      newItemsTotal: 8,
      netDue: -2,
      remainingDue: -2,
    });

    const result = await svc.confirm(session, 'mgr-1', 'Manager');

    expect(result.success).toBe(true);
    expect(result.creditOwed).toBe(2);
    // Only the consumed credit ($8) is tendered, not the full $10 return credit
    const tenderLines = (checkout.completePayment as jest.Mock).mock.calls[0][3] as PaymentLine[];
    expect(tenderLines[0]).toMatchObject({ method: 'store_credit', amount: 8 });
  });
});
