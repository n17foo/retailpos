// Mock logger to avoid transitive expo-sqlite dependency
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

jest.mock('../../repositories/KeyValueRepository', () => {
  const store: Record<string, string> = {};
  return {
    keyValueRepository: {
      get: jest.fn(async (key: string) => store[key] ?? null),
      set: jest.fn(async (key: string, value: string) => {
        store[key] = value;
      }),
      delete: jest.fn(async (key: string) => {
        delete store[key];
      }),
    },
  };
});

jest.mock('../../utils/uuid', () => ({
  generateUUID: jest.fn().mockReturnValue('test-uuid'),
}));

import { auditLogService } from './AuditLogService';

describe('AuditLogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should log audit events successfully', async () => {
      await auditLogService.log('order:created', {
        userId: 'user-1',
        details: 'Test order created',
        metadata: { total: 100 },
      });

      // Verify the log was recorded
      const logs = await auditLogService.getAll();
      expect(logs.length).toBeGreaterThan(0);
      const recentLog = logs[0];
      expect(recentLog.action).toBe('order:created');
      expect(recentLog.userId).toBe('user-1');
      expect(recentLog.details).toBe('Test order created');
    });

    it('should handle logging without options', async () => {
      await auditLogService.log('auth:login', {
        userId: 'user-2',
      });

      const logs = await auditLogService.getAll();
      const recentLog = logs[0];
      expect(recentLog.action).toBe('auth:login');
      expect(recentLog.userId).toBe('user-2');
    });
  });

  describe('getAll', () => {
    it('should return audit log entries', async () => {
      const logs = await auditLogService.getAll();
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe('getByAction', () => {
    it('should filter logs by action', async () => {
      const logs = await auditLogService.getByAction('order:created');
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe('getByUser', () => {
    it('should filter logs by user', async () => {
      const logs = await auditLogService.getByUser('user-1');
      expect(Array.isArray(logs)).toBe(true);
    });
  });
});
