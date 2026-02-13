// Mock the DB layer to avoid expo-sqlite native module in tests
jest.mock('../../utils/db', () => ({
  db: {
    getFirstAsync: jest.fn().mockResolvedValue(null),
    getAllAsync: jest.fn().mockResolvedValue([]),
    runAsync: jest.fn().mockResolvedValue(undefined),
  },
}));

import { POSConfigService, REQUIRED_FIELDS, SETTINGS_KEYS } from './POSConfigService';
import { KeyValueRepository } from '../../repositories/KeyValueRepository';

function createMockRepo(): jest.Mocked<KeyValueRepository> {
  return {
    getSetting: jest.fn().mockResolvedValue(null),
    setSetting: jest.fn().mockResolvedValue(undefined),
    deleteSetting: jest.fn().mockResolvedValue(undefined),
    getAllSettings: jest.fn().mockResolvedValue({}),
  } as any;
}

describe('POSConfigService', () => {
  let service: POSConfigService;
  let repo: jest.Mocked<KeyValueRepository>;

  beforeEach(() => {
    repo = createMockRepo();
    service = new POSConfigService(repo);
  });

  describe('initial state', () => {
    it('isLoaded is false before load()', () => {
      expect(service.isLoaded).toBe(false);
    });

    it('isConfigured is false when no values are set', () => {
      expect(service.isConfigured).toBe(false);
    });

    it('getMissingFields returns all required fields initially', () => {
      expect(service.getMissingFields()).toEqual(REQUIRED_FIELDS);
    });
  });

  describe('load()', () => {
    it('reads every setting key from the repository', async () => {
      await service.load();

      const allKeys = Object.values(SETTINGS_KEYS);
      for (const key of allKeys) {
        expect(repo.getObject).toHaveBeenCalledWith(key);
      }
      expect(service.isLoaded).toBe(true);
    });

    it('populates config from stored values', async () => {
      repo.getObject.mockImplementation(async (key: string) => {
        const data: Record<string, any> = {
          'pos.taxRate': 0.1,
          'pos.storeName': 'My Store',
          'pos.currencySymbol': '$',
          'pos.maxSyncRetries': 5,
        };
        return data[key] ?? null;
      });

      await service.load();

      expect(service.values.taxRate).toBe(0.1);
      expect(service.values.storeName).toBe('My Store');
      expect(service.values.currencySymbol).toBe('$');
      expect(service.values.maxSyncRetries).toBe(5);
    });

    it('skips null/undefined values from the repo', async () => {
      repo.getObject.mockResolvedValue(null);
      await service.load();

      expect(service.values.taxRate).toBeUndefined();
      expect(service.isConfigured).toBe(false);
    });
  });

  describe('update()', () => {
    it('persists a value to the repo and updates in-memory config', async () => {
      await service.update('taxRate', 0.07);

      expect(repo.setObject).toHaveBeenCalledWith('pos.taxRate', 0.07);
      expect(service.values.taxRate).toBe(0.07);
    });

    it('persists string values correctly', async () => {
      await service.update('storeName', 'Test Shop');

      expect(repo.setObject).toHaveBeenCalledWith('pos.storeName', 'Test Shop');
      expect(service.values.storeName).toBe('Test Shop');
    });

    it('persists boolean values correctly', async () => {
      await service.update('drawerOpenOnCash', false);

      expect(repo.setObject).toHaveBeenCalledWith('pos.drawerOpenOnCash', false);
      expect(service.values.drawerOpenOnCash).toBe(false);
    });
  });

  describe('updateAll()', () => {
    it('updates multiple fields in one call', async () => {
      await service.updateAll({
        taxRate: 0.05,
        storeName: 'Bulk Store',
        currencySymbol: '$',
      });

      expect(service.values.taxRate).toBe(0.05);
      expect(service.values.storeName).toBe('Bulk Store');
      expect(service.values.currencySymbol).toBe('$');
      expect(repo.setObject).toHaveBeenCalledTimes(3);
    });

    it('skips undefined values', async () => {
      await service.updateAll({ taxRate: 0.08, storeName: undefined as any });

      expect(repo.setObject).toHaveBeenCalledTimes(1);
      expect(repo.setObject).toHaveBeenCalledWith('pos.taxRate', 0.08);
    });
  });

  describe('isConfigured', () => {
    it('returns false when some required fields are missing', async () => {
      await service.update('taxRate', 0.08);
      await service.update('storeName', 'Shop');
      // currencySymbol is still missing

      expect(service.isConfigured).toBe(false);
      expect(service.getMissingFields()).toEqual(['currencySymbol']);
    });

    it('returns true when all required fields are set', async () => {
      await service.update('taxRate', 0.08);
      await service.update('storeName', 'Shop');
      await service.update('currencySymbol', '$');

      expect(service.isConfigured).toBe(true);
      expect(service.getMissingFields()).toEqual([]);
    });
  });
});
