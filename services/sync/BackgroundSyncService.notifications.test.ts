// Mock dependencies - paths must match what BackgroundSyncService.ts imports
jest.mock('../basket/basketServiceFactory', () => ({
  getServiceContainer: jest.fn(),
}));

jest.mock('../logger/loggerFactory', () => ({
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

jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
}));

jest.mock('../notifications/NotificationService', () => ({
  notificationService: {
    notify: jest.fn(),
  },
}));

import { BackgroundSyncService } from './BackgroundSyncService';
import { notificationService } from '../notifications/NotificationService';
import { getServiceContainer } from '../basket/basketServiceFactory';

describe('BackgroundSyncService - Notification Integration', () => {
  let service: BackgroundSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BackgroundSyncService();
  });

  afterEach(() => {
    service.stop();
  });

  describe('performSync - Notification Wiring', () => {
    it('should notify success when orders sync successfully', async () => {
      (getServiceContainer as jest.Mock).mockResolvedValue({
        orderSyncService: {
          syncAllPendingOrders: jest.fn().mockResolvedValue({
            synced: 2,
            failed: 0,
          }),
        },
      });

      // Access private performSync via prototype
      await (service as any).performSync();

      expect(notificationService.notify).toHaveBeenCalledWith('Orders Synced', '2 order(s) synced successfully.', 'success');
    });

    it('should notify error when orders fail to sync', async () => {
      (getServiceContainer as jest.Mock).mockResolvedValue({
        orderSyncService: {
          syncAllPendingOrders: jest.fn().mockResolvedValue({
            synced: 0,
            failed: 1,
          }),
        },
      });

      await (service as any).performSync();

      expect(notificationService.notify).toHaveBeenCalledWith(
        'Sync Failed',
        '1 order(s) failed to sync. Will retry automatically.',
        'error'
      );
    });

    it('should notify warning on sync exception', async () => {
      (getServiceContainer as jest.Mock).mockRejectedValue(new Error('Network error'));

      await (service as any).performSync();

      expect(notificationService.notify).toHaveBeenCalledWith('Sync Error', 'Background sync encountered an error. Retrying…', 'warning');
    });
  });
});
