// Mock logger to avoid transitive expo-sqlite dependency (__DEV__ error)
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

// Mock repositories as singleton instances (matching ReturnService.ts imports)
const mockCreate = jest.fn();
const mockUpdateStatus = jest.fn();
const mockFindByOrderId = jest.fn();
jest.mock('../../repositories/ReturnRepository', () => ({
  returnRepository: {
    create: mockCreate,
    updateStatus: mockUpdateStatus,
    findByOrderId: mockFindByOrderId,
  },
}));

const mockOrderFindById = jest.fn();
jest.mock('../../repositories/OrderRepository', () => ({
  orderRepository: {
    findById: mockOrderFindById,
  },
}));

jest.mock('../../repositories/OrderItemRepository', () => ({
  OrderItemRepository: jest.fn().mockImplementation(() => ({
    findByOrderId: jest.fn().mockResolvedValue([]),
  })),
}));

const mockProcessRefund = jest.fn();
const mockRefundInit = jest.fn().mockResolvedValue(true);
const mockRefundIsInit = jest.fn().mockReturnValue(true);
const mockGetRefundHistory = jest.fn().mockResolvedValue([]);

const mockPlatformRefundImpl = () => ({
  processRefund: mockProcessRefund,
  initialize: mockRefundInit,
  isInitialized: mockRefundIsInit,
  getRefundHistory: mockGetRefundHistory,
});

jest.mock('./platforms/shopifyRefundService', () => ({
  ShopifyRefundService: jest.fn().mockImplementation(mockPlatformRefundImpl),
}));
jest.mock('./platforms/wooCommerceRefundService', () => ({
  WooCommerceRefundService: jest.fn().mockImplementation(mockPlatformRefundImpl),
}));
jest.mock('./platforms/magentoRefundService', () => ({
  MagentoRefundService: jest.fn().mockImplementation(mockPlatformRefundImpl),
}));
jest.mock('./platforms/bigCommerceRefundService', () => ({
  BigCommerceRefundService: jest.fn().mockImplementation(mockPlatformRefundImpl),
}));
jest.mock('./platforms/syliusRefundService', () => ({
  SyliusRefundService: jest.fn().mockImplementation(mockPlatformRefundImpl),
}));
jest.mock('./platforms/wixRefundService', () => ({
  WixRefundService: jest.fn().mockImplementation(mockPlatformRefundImpl),
}));
jest.mock('./platforms/PrestaShopRefundService', () => ({
  PrestaShopRefundService: jest.fn().mockImplementation(mockPlatformRefundImpl),
}));
jest.mock('./platforms/SquarespaceRefundService', () => ({
  SquarespaceRefundService: jest.fn().mockImplementation(mockPlatformRefundImpl),
}));
jest.mock('./platforms/CommercefullRefundService', () => ({
  CommercefullRefundService: jest.fn().mockImplementation(mockPlatformRefundImpl),
}));
jest.mock('./platforms/OfflineRefundService', () => ({
  OfflineRefundService: jest.fn().mockImplementation(() => ({
    processRefund: jest.fn().mockResolvedValue({ success: true, refundId: 'offline-refund-1', timestamp: new Date() }),
    initialize: jest.fn().mockResolvedValue(true),
    isInitialized: jest.fn().mockReturnValue(true),
    getRefundHistory: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('../audit/AuditLogService', () => ({
  auditLogService: {
    log: jest.fn(),
  },
}));

jest.mock('../notifications/NotificationService', () => ({
  notificationService: {
    notify: jest.fn(),
  },
}));

import { returnService } from './RefundService';
import { auditLogService } from '../audit/AuditLogService';
import { notificationService } from '../notifications/NotificationService';
import { ECommercePlatform } from '../../utils/platforms';

describe('ReturnService - Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
