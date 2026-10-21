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
jest.mock('../../repositories/ReturnRepository', () => ({
  returnRepository: {
    create: jest.fn(),
    updateStatus: jest.fn(),
    findByOrderId: jest.fn(),
  },
}));

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
