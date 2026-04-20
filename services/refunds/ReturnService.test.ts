/**
 * ReturnService — unit tests
 *
 * Tests processReturn validation, total calculation, and error paths.
 * All I/O (repositories, audit, notifications, logger) is mocked.
 */

// ── Mocks ─────────────────────────────────────────────────────────────────

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

jest.mock('../audit/AuditLogService', () => ({
  auditLogService: { log: jest.fn() },
}));

jest.mock('../notifications/NotificationService', () => ({
  notificationService: { notify: jest.fn() },
}));

// Block expo-sqlite from loading — ReturnRepository is injected via setReturnRepository()
jest.mock('../../utils/db', () => ({}));
jest.mock('../../repositories/ReturnRepository', () => ({
  returnRepository: {},
  getReturnRepository: jest.fn(),
}));
jest.mock('../../repositories/OrderRepository', () => ({
  orderRepository: { findById: jest.fn() },
}));
jest.mock('../../repositories/OrderItemRepository', () => ({
  OrderItemRepository: jest.fn().mockImplementation(() => ({
    findByOrderId: jest.fn().mockResolvedValue([]),
  })),
}));
jest.mock('../../services/instoreapi/InstoreApiConfig', () => ({
  instoreApiConfig: { isClient: false },
}));

// Mock all platform refund services to avoid HTTP client imports
jest.mock('./platforms/shopifyRefundService', () => ({ ShopifyRefundService: jest.fn() }));
jest.mock('./platforms/wooCommerceRefundService', () => ({ WooCommerceRefundService: jest.fn() }));
jest.mock('./platforms/magentoRefundService', () => ({ MagentoRefundService: jest.fn() }));
jest.mock('./platforms/bigCommerceRefundService', () => ({ BigCommerceRefundService: jest.fn() }));
jest.mock('./platforms/syliusRefundService', () => ({ SyliusRefundService: jest.fn() }));
jest.mock('./platforms/wixRefundService', () => ({ WixRefundService: jest.fn() }));
jest.mock('./platforms/PrestaShopRefundService', () => ({ PrestaShopRefundService: jest.fn() }));
jest.mock('./platforms/SquarespaceRefundService', () => ({ SquarespaceRefundService: jest.fn() }));
jest.mock('./platforms/CommerceFullRefundService', () => ({ CommerceFullRefundService: jest.fn() }));
jest.mock('./platforms/OfflineRefundService', () => ({
  OfflineRefundService: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    isInitialized: jest.fn().mockReturnValue(true),
    processRefund: jest.fn().mockResolvedValue({ success: true, refundId: 'ref-1', timestamp: new Date() }),
    getRefundHistory: jest.fn().mockResolvedValue([]),
  })),
}));

import { ReturnService, ProcessReturnInput } from './RefundService';
import { ReturnRepository } from '../../repositories/ReturnRepository';
import { orderRepository } from '../../repositories/OrderRepository';

const mockReturnRepo: jest.Mocked<ReturnRepository> = {
  create: jest.fn().mockResolvedValue('return-id-1'),
  findById: jest.fn(),
  findByOrderId: jest.fn().mockResolvedValue([]),
  findAll: jest.fn().mockResolvedValue([]),
  findByDateRange: jest.fn().mockResolvedValue([]),
  updateStatus: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn().mockResolvedValue(undefined),
};

// ── Helpers ───────────────────────────────────────────────────────────────

const paidOrder = {
  id: 'order-1',
  platform_order_id: null,
  platform: null,
  status: 'paid' as const,
  sync_status: 'synced',
  subtotal: 20,
  tax: 1.6,
  total: 21.6,
  payment_method: 'cash',
  cashier_id: 'c1',
  cashier_name: 'Alice',
  created_at: Date.now(),
  updated_at: Date.now(),
  paid_at: Date.now(),
  synced_at: null,
  discount_amount: null,
  discount_code: null,
  customer_email: null,
  customer_name: null,
  note: null,
  payment_transaction_id: null,
  sync_error: null,
};

function getService(): ReturnService {
  // Reset singleton between tests
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (ReturnService as any).instance = undefined;
  const service = ReturnService.getInstance();
  service.setReturnRepository(mockReturnRepo);
  return service;
}

const baseInput: ProcessReturnInput = {
  orderId: 'order-1',
  items: [
    {
      productId: 'prod-1',
      productName: 'Widget',
      quantity: 1,
      refundAmount: 10,
      reason: 'Damaged',
      restock: true,
    },
  ],
  processedBy: 'manager-1',
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe('ReturnService.processReturn', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (orderRepository.findById as jest.Mock).mockResolvedValue(paidOrder);
    mockReturnRepo.create.mockResolvedValue('return-id-1');
  });

  // ── Validation ────────────────────────────────────────────────────────

  it('returns failure when order is not found', async () => {
    (orderRepository.findById as jest.Mock).mockResolvedValue(null);
    const service = getService();

    const result = await service.processReturn(baseInput);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
    expect(mockReturnRepo.create).not.toHaveBeenCalled();
  });

  it('returns failure when order status is pending (not paid)', async () => {
    (orderRepository.findById as jest.Mock).mockResolvedValue({ ...paidOrder, status: 'pending' });
    const service = getService();

    const result = await service.processReturn(baseInput);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/paid/i);
    expect(mockReturnRepo.create).not.toHaveBeenCalled();
  });

  it('returns failure when order status is draft', async () => {
    (orderRepository.findById as jest.Mock).mockResolvedValue({ ...paidOrder, status: 'draft' });
    const service = getService();

    const result = await service.processReturn(baseInput);

    expect(result.success).toBe(false);
    expect(mockReturnRepo.create).not.toHaveBeenCalled();
  });

  it('succeeds for a synced order', async () => {
    (orderRepository.findById as jest.Mock).mockResolvedValue({ ...paidOrder, status: 'synced' });
    const service = getService();

    const result = await service.processReturn(baseInput);

    expect(result.success).toBe(true);
  });

  // ── Return creation ───────────────────────────────────────────────────

  it('creates one return record per item', async () => {
    const service = getService();
    const input: ProcessReturnInput = {
      ...baseInput,
      items: [
        { productId: 'p1', productName: 'A', quantity: 1, refundAmount: 5 },
        { productId: 'p2', productName: 'B', quantity: 2, refundAmount: 15 },
      ],
    };

    await service.processReturn(input);

    expect(mockReturnRepo.create).toHaveBeenCalledTimes(2);
  });

  it('marks each return as completed', async () => {
    const service = getService();
    await service.processReturn(baseInput);

    expect(mockReturnRepo.updateStatus).toHaveBeenCalledWith('return-id-1', 'completed', 'manager-1');
  });

  // ── Total calculation ─────────────────────────────────────────────────

  it('sums refundAmount across all items', async () => {
    const service = getService();
    const input: ProcessReturnInput = {
      ...baseInput,
      items: [
        { productId: 'p1', productName: 'A', quantity: 1, refundAmount: 10.5 },
        { productId: 'p2', productName: 'B', quantity: 1, refundAmount: 4.5 },
      ],
    };

    const result = await service.processReturn(input);

    expect(result.totalRefund).toBeCloseTo(15, 2);
  });

  it('rounds totalRefund to 2 decimal places', async () => {
    const service = getService();
    const input: ProcessReturnInput = {
      ...baseInput,
      items: [
        { productId: 'p1', productName: 'A', quantity: 1, refundAmount: 0.1 },
        { productId: 'p2', productName: 'B', quantity: 1, refundAmount: 0.2 },
      ],
    };

    const result = await service.processReturn(input);

    // 0.1 + 0.2 in floating point = 0.30000000000000004 — should be rounded
    expect(result.totalRefund).toBe(0.3);
  });

  it('returns the created return IDs', async () => {
    mockReturnRepo.create.mockResolvedValueOnce('ret-a').mockResolvedValueOnce('ret-b');

    const service = getService();
    const input: ProcessReturnInput = {
      ...baseInput,
      items: [
        { productId: 'p1', productName: 'A', quantity: 1, refundAmount: 5 },
        { productId: 'p2', productName: 'B', quantity: 1, refundAmount: 5 },
      ],
    };

    const result = await service.processReturn(input);

    expect(result.returnIds).toEqual(['ret-a', 'ret-b']);
  });

  // ── Error handling ────────────────────────────────────────────────────

  it('returns failure when repository throws', async () => {
    mockReturnRepo.create.mockRejectedValue(new Error('DB error'));
    const service = getService();

    const result = await service.processReturn(baseInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Failed to process return');
  });

  // ── Audit + notification ──────────────────────────────────────────────

  it('logs an audit event on success', async () => {
    const { auditLogService } = jest.requireMock('../audit/AuditLogService');
    const service = getService();

    await service.processReturn(baseInput);

    expect(auditLogService.log).toHaveBeenCalledWith('return:created', expect.objectContaining({ userId: 'manager-1' }));
  });

  it('sends a notification on success', async () => {
    const { notificationService } = jest.requireMock('../notifications/NotificationService');
    const service = getService();

    await service.processReturn(baseInput);

    expect(notificationService.notify).toHaveBeenCalledWith('Return Processed', expect.stringContaining('order-1'), 'info');
  });
});
