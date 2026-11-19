// Mock logger to avoid transitive expo-sqlite dependency (__DEV__ error)
jest.mock('../../../../shared/services/logger/LoggerFactory', () => ({
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

// Mock repositories as singleton instances (matching ReturnService.ts imports).
// jest.fn()s are created inside the factories — jest.mock factories run when
// the mocked module is first required (during the import phase, before the
// file's consts initialise), so out-of-scope references resolve to undefined.
jest.mock('../../repositories/ReturnRepository', () => {
  const repo = {
    create: jest.fn(),
    updateStatus: jest.fn(),
    findByOrderId: jest.fn(),
    findById: jest.fn(),
    updateRefundStatus: jest.fn(),
    findUnrefunded: jest.fn(),
  };
  return { returnRepository: repo, getReturnRepository: () => repo };
});

jest.mock('../../../orders-sync/repositories/OrderRepository', () => {
  const repo = { findById: jest.fn() };
  return { orderRepository: repo, getOrderRepository: () => repo };
});

jest.mock('../../../orders-sync/repositories/OrderItemRepository', () => {
  const repo = { findByOrderId: jest.fn().mockResolvedValue([]) };
  return {
    OrderItemRepository: jest.fn().mockImplementation(() => repo),
    orderItemRepository: repo,
    getOrderItemRepository: () => repo,
  };
});

// Constructors are bare jest.fn()s — implementations are wired in beforeEach
// for the same hoisting reason as the repository mocks above.
jest.mock('./platforms/shopifyRefundService', () => ({ ShopifyRefundService: jest.fn() }));
jest.mock('./platforms/wooCommerceRefundService', () => ({ WooCommerceRefundService: jest.fn() }));
jest.mock('./platforms/magentoRefundService', () => ({ MagentoRefundService: jest.fn() }));
jest.mock('./platforms/bigCommerceRefundService', () => ({ BigCommerceRefundService: jest.fn() }));
jest.mock('./platforms/syliusRefundService', () => ({ SyliusRefundService: jest.fn() }));
jest.mock('./platforms/wixRefundService', () => ({ WixRefundService: jest.fn() }));
jest.mock('./platforms/PrestaShopRefundService', () => ({ PrestaShopRefundService: jest.fn() }));
jest.mock('./platforms/CommercefullRefundService', () => ({ CommercefullRefundService: jest.fn() }));
jest.mock('./platforms/OfflineRefundService', () => ({ OfflineRefundService: jest.fn() }));

jest.mock('../../../../shared/services/audit/AuditLogService', () => ({
  auditLogService: {
    log: jest.fn(),
  },
}));

jest.mock('../../../../shared/services/notifications/NotificationService', () => ({
  notificationService: {
    notify: jest.fn(),
  },
}));

import { returnService } from './RefundService';
import { returnRepository } from '../../repositories/ReturnRepository';
import { orderRepository } from '../../../orders-sync/repositories/OrderRepository';
import { WooCommerceRefundService } from './platforms/wooCommerceRefundService';
import { OfflineRefundService } from './platforms/OfflineRefundService';
import { auditLogService } from '../../../../shared/services/audit/AuditLogService';
import { notificationService } from '../../../../shared/services/notifications/NotificationService';
import { ECommercePlatform } from '../../../../shared/utils/platforms';

const mockCreate = returnRepository.create as jest.Mock;
const mockUpdateStatus = returnRepository.updateStatus as jest.Mock;
const mockFindByOrderId = returnRepository.findByOrderId as jest.Mock;
const mockFindById = (returnRepository as unknown as { findById: jest.Mock }).findById;
const mockUpdateRefundStatus = (returnRepository as unknown as { updateRefundStatus: jest.Mock }).updateRefundStatus;
const mockFindUnrefunded = (returnRepository as unknown as { findUnrefunded: jest.Mock }).findUnrefunded;
const mockOrderFindById = orderRepository.findById as jest.Mock;
const mockProcessRefund = jest.fn();
const mockPlatformRefundImpl = () => ({
  processRefund: mockProcessRefund,
  initialize: jest.fn().mockResolvedValue(true),
  isInitialized: jest.fn().mockReturnValue(true),
  getRefundHistory: jest.fn().mockResolvedValue([]),
});

describe('ReturnService - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (WooCommerceRefundService as unknown as jest.Mock).mockImplementation(mockPlatformRefundImpl);
    (OfflineRefundService as unknown as jest.Mock).mockImplementation(() => ({
      processRefund: jest.fn().mockResolvedValue({ success: true, refundId: 'offline-refund-1', timestamp: new Date() }),
      initialize: jest.fn().mockResolvedValue(true),
      isInitialized: jest.fn().mockReturnValue(true),
      getRefundHistory: jest.fn().mockResolvedValue([]),
    }));
    mockFindByOrderId.mockResolvedValue([]);
  });

  describe('processReturn - Platform Refund Integration', () => {
    it('should process return with platform refund when issueRefund is true', async () => {
      mockOrderFindById.mockResolvedValue({
        id: 'order-1',
        platform: ECommercePlatform.WOOCOMMERCE,
        platform_order_id: 'plat-order-1',
        status: 'paid',
      });
      mockCreate.mockResolvedValue('return-1');
      mockUpdateStatus.mockResolvedValue(undefined);

      mockProcessRefund.mockResolvedValue({ success: true, refundId: 'refund-123', timestamp: new Date() });

      const result = await returnService.processReturn({
        orderId: 'order-1',
        items: [{ orderItemId: 'item-1', productId: 'prod-1', productName: 'Test Item', quantity: 1, refundAmount: 10, reason: 'damaged' }],
        issueRefund: true,
        platform: ECommercePlatform.WOOCOMMERCE,
      });

      expect(result.success).toBe(true);
      expect(result.returnIds).toEqual(['return-1']);
      expect(result.refundId).toBe('refund-123');

      // Verify platform refund was called
      expect(mockProcessRefund).toHaveBeenCalled();

      // Verify audit logging
      expect(auditLogService.log).toHaveBeenCalledWith(
        'return:created',
        expect.objectContaining({
          userId: undefined,
        })
      );

      // Verify notification
      expect(notificationService.notify).toHaveBeenCalledWith(
        'Return Processed',
        expect.stringContaining('item(s) returned for order'),
        'info'
      );
    });

    it('should process return without platform refund when issueRefund is false', async () => {
      mockOrderFindById.mockResolvedValue({
        id: 'order-1',
        platform: ECommercePlatform.WOOCOMMERCE,
        status: 'paid',
      });
      mockCreate.mockResolvedValue('return-1');
      mockUpdateStatus.mockResolvedValue(undefined);

      const result = await returnService.processReturn({
        orderId: 'order-1',
        items: [{ orderItemId: 'item-1', productId: 'prod-1', productName: 'Test Item', quantity: 1, refundAmount: 10, reason: 'damaged' }],
        issueRefund: false,
      });

      expect(result.success).toBe(true);
      expect(result.returnIds).toEqual(['return-1']);
      expect(result.refundId).toBeUndefined();

      // Platform refund service should not be called
      expect(mockProcessRefund).not.toHaveBeenCalled();
    });

    it('should handle return processing failure', async () => {
      mockOrderFindById.mockResolvedValue(null);

      const result = await returnService.processReturn({
        orderId: 'invalid-order',
        items: [{ orderItemId: 'item-1', productId: 'prod-1', productName: 'Test Item', quantity: 1, refundAmount: 10, reason: 'damaged' }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Order not found');
    });
  });

  describe('RET-05 — refund lifecycle, retry, and honest reporting', () => {
    const returnInput = {
      orderId: 'order-1',
      items: [{ orderItemId: 'item-1', productId: 'prod-1', productName: 'Test Item', quantity: 1, refundAmount: 10, reason: 'damaged' }],
      issueRefund: true,
      platform: ECommercePlatform.WOOCOMMERCE,
    };

    const failedReturnRow = {
      id: 'return-1',
      order_id: 'order-1',
      order_item_id: 'item-1',
      product_id: 'prod-1',
      variant_id: null,
      product_name: 'Test Item',
      quantity: 1,
      refund_amount: 10,
      reason: 'damaged',
      restock: 1,
      status: 'completed',
      refund_status: 'failed' as const,
      refund_id: null,
      processed_by: null,
      processed_at: null,
      created_at: 1,
      updated_at: 1,
    };

    beforeEach(() => {
      mockOrderFindById.mockResolvedValue({
        id: 'order-1',
        platform: ECommercePlatform.WOOCOMMERCE,
        platform_order_id: 'plat-order-1',
        status: 'paid',
        total: 50,
      });
      mockCreate.mockResolvedValue('return-1');
      mockUpdateStatus.mockResolvedValue(undefined);
      mockUpdateRefundStatus.mockResolvedValue(undefined);
    });

    it('persists the refund intent before attempting, fails honestly, and stays retryable', async () => {
      mockProcessRefund.mockResolvedValue({ success: false, error: 'provider down', timestamp: new Date() });

      const result = await returnService.processReturn(returnInput);

      // The return is recorded, but a failed refund is NOT overall success.
      expect(result.success).toBe(false);
      expect(result.returnIds).toEqual(['return-1']);
      expect(result.totalRefund).toBe(10);
      expect(result.refundStatus).toBe('failed');
      expect(result.error).toMatch(/retried/);

      // Intent persisted 'pending' before the attempt, 'failed' after.
      const statusCalls = mockUpdateRefundStatus.mock.calls.map(c => c[1]);
      expect(statusCalls).toEqual(['pending', 'failed']);
    });

    it('marks returns refunded with the platform refund id on success', async () => {
      mockProcessRefund.mockResolvedValue({ success: true, refundId: 'refund-123', timestamp: new Date() });

      const result = await returnService.processReturn(returnInput);

      expect(result.success).toBe(true);
      expect(result.refundStatus).toBe('refunded');
      expect(mockUpdateRefundStatus).toHaveBeenLastCalledWith('return-1', 'refunded', 'refund-123');
    });

    it('retryRefund re-attempts a failed row and marks it refunded', async () => {
      mockFindById.mockResolvedValue(failedReturnRow);
      mockProcessRefund.mockResolvedValue({ success: true, refundId: 'refund-retry-1', timestamp: new Date() });

      const result = await returnService.retryRefund('return-1');

      expect(result.success).toBe(true);
      expect(result.refundId).toBe('refund-retry-1');
      expect(mockProcessRefund).toHaveBeenCalledWith('plat-order-1', expect.objectContaining({ amount: 10, reason: 'damaged' }));
      expect(mockUpdateRefundStatus).toHaveBeenCalledWith('return-1', 'refunded', 'refund-retry-1');
    });

    it('retryRefund is idempotent for already-refunded rows and refuses rows with no outstanding refund', async () => {
      mockFindById.mockResolvedValue({ ...failedReturnRow, refund_status: 'refunded', refund_id: 'refund-123' });
      const settled = await returnService.retryRefund('return-1');
      expect(settled.success).toBe(true);
      expect(settled.refundId).toBe('refund-123');
      expect(mockProcessRefund).not.toHaveBeenCalled();

      mockFindById.mockResolvedValue({ ...failedReturnRow, refund_status: 'none' });
      const none = await returnService.retryRefund('return-1');
      expect(none.success).toBe(false);
      expect(mockProcessRefund).not.toHaveBeenCalled();
    });

    it('retryUnrefundedReturns drains the work queue and reports what is still owed', async () => {
      mockFindUnrefunded.mockResolvedValue([failedReturnRow, { ...failedReturnRow, id: 'return-2', refund_status: 'pending' as const }]);
      mockFindById.mockImplementation(async (id: string) =>
        id === 'return-1' ? failedReturnRow : { ...failedReturnRow, id: 'return-2', refund_status: 'pending' as const }
      );
      mockProcessRefund
        .mockResolvedValueOnce({ success: true, refundId: 'r-1', timestamp: new Date() })
        .mockResolvedValueOnce({ success: false, error: 'still down', timestamp: new Date() });

      const summary = await returnService.retryUnrefundedReturns();
      expect(summary).toEqual({ attempted: 2, refunded: 1, outstanding: 1 });
      expect(mockUpdateRefundStatus).toHaveBeenCalledWith('return-2', 'failed', null);
    });
  });

  describe('Audit Logging Integration', () => {
    it('should log return creation with user context', async () => {
      mockOrderFindById.mockResolvedValue({
        id: 'order-1',
        status: 'paid',
      });
      mockCreate.mockResolvedValue('return-1');
      mockUpdateStatus.mockResolvedValue(undefined);

      await returnService.processReturn({
        orderId: 'order-1',
        items: [{ orderItemId: 'item-1', productId: 'prod-1', productName: 'Test Item', quantity: 1, refundAmount: 10, reason: 'damaged' }],
        processedBy: 'cashier-1',
      });

      expect(auditLogService.log).toHaveBeenCalledWith(
        'return:created',
        expect.objectContaining({
          userId: 'cashier-1',
        })
      );
    });
  });
});
