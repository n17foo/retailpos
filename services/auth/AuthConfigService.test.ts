jest.mock('../../utils/db', () => ({ db: {} }));

// Prevent react-native-logs from firing deferred console.log after test teardown
jest.mock('../../services/logger/LoggerFactory', () => ({
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

import { AuthConfigService } from './AuthConfigService';
import { KeyValueRepository } from '../../repositories/KeyValueRepository';

// ── Mock KeyValueRepository ──────────────────────────────────────────

function makeMockKv(initialStore: Record<string, unknown> = {}): jest.Mocked<KeyValueRepository> {
  const store: Record<string, string> = {};
  for (const [k, v] of Object.entries(initialStore)) {
    store[k] = JSON.stringify(v);
  }

  return {
    getItem: jest.fn(async (key: string) => store[key] ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn(async (key: string) => {
      delete store[key];
    }),
    getObject: jest.fn(async <T>(key: string): Promise<T | null> => {
      const value = store[key];
      if (!value) return null;
      return JSON.parse(value) as T;
    }),
    setObject: jest.fn(async <T>(key: string, value: T) => {
      store[key] = JSON.stringify(value);
    }),
  } as unknown as jest.Mocked<KeyValueRepository>;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('AuthConfigService', () => {
  let kv: jest.Mocked<KeyValueRepository>;
  let svc: AuthConfigService;

  beforeEach(() => {
    kv = makeMockKv();
    svc = new AuthConfigService(kv);
  });

  // ── 2.1.1 load() restores persisted config ─────────────────────────

  describe('load()', () => {
    it('2.1.1 restores primaryMethod from persisted store', async () => {
      kv = makeMockKv({ 'auth.primaryMethod': 'biometric' });
      svc = new AuthConfigService(kv);
      await svc.load();
      expect(svc.primaryMethod).toBe('biometric');
    });

    it('2.1.1 restores allowedMethods from persisted store', async () => {
      kv = makeMockKv({ 'auth.allowedMethods': ['pin', 'password'] });
      svc = new AuthConfigService(kv);
      await svc.load();
      expect(svc.allowedMethods).toEqual(expect.arrayContaining(['pin', 'password']));
    });

    it('2.1.1 restores authMode from persisted store', async () => {
      kv = makeMockKv({ 'auth.mode': 'online' });
      svc = new AuthConfigService(kv);
      await svc.load();
      expect(svc.authMode).toBe('online');
    });

    it('2.1.1 defaults to pin / offline when store is empty', async () => {
      await svc.load();
      expect(svc.primaryMethod).toBe('pin');
      expect(svc.authMode).toBe('offline');
    });

    it('1.2 always includes pin in allowed list after load even if not stored', async () => {
      kv = makeMockKv({ 'auth.allowedMethods': ['password'] });
      svc = new AuthConfigService(kv);
      await svc.load();
      expect(svc.allowedMethods).toContain('pin');
    });

    it('5.1 operates with defaults when load() has not been called', () => {
      expect(svc.primaryMethod).toBe('pin');
      expect(svc.authMode).toBe('offline');
      expect(svc.allowedMethods).toContain('pin');
    });

    it('5.2 catches malformed JSON and falls back to defaults without throwing', async () => {
      kv.getObject.mockRejectedValueOnce(new SyntaxError('Unexpected token'));
      await expect(svc.load()).resolves.toBeUndefined();
      expect(svc.primaryMethod).toBe('pin');
      expect(svc.authMode).toBe('offline');
    });

    it('5.2 sets isLoaded=true even after a parse error', async () => {
      kv.getObject.mockRejectedValueOnce(new SyntaxError('bad json'));
      await svc.load();
      expect(svc.isLoaded).toBe(true);
    });
  });

  // ── 2.1.2 setPrimaryMethod ──────────────────────────────────────────

  describe('setPrimaryMethod()', () => {
    it('2.1.2 updates in-memory primary method', async () => {
      await svc.setPrimaryMethod('password');
      expect(svc.primaryMethod).toBe('password');
    });

    it('2.1.2 persists primary method immediately', async () => {
      await svc.setPrimaryMethod('biometric');
      expect(kv.setObject).toHaveBeenCalledWith('auth.primaryMethod', 'biometric');
    });

    it('ensures primary is also added to allowed if not already present', async () => {
      await svc.setPrimaryMethod('biometric');
      expect(svc.allowedMethods).toContain('biometric');
    });
  });

  // ── 2.1.3 setAllowedMethods ─────────────────────────────────────────

  describe('setAllowedMethods()', () => {
    it('2.1.3 updates allowed list in memory', async () => {
      await svc.setAllowedMethods(['pin', 'password', 'biometric']);
      expect(svc.allowedMethods).toEqual(expect.arrayContaining(['pin', 'password', 'biometric']));
    });

    it('2.1.3 persists change immediately', async () => {
      await svc.setAllowedMethods(['pin', 'magstripe']);
      expect(kv.setObject).toHaveBeenCalledWith('auth.allowedMethods', expect.arrayContaining(['pin', 'magstripe']));
    });

    it('1.2 always ensures pin is in the allowed list', async () => {
      await svc.setAllowedMethods(['password']);
      expect(svc.allowedMethods).toContain('pin');
    });

    it('falls back primary to pin when current primary is no longer allowed', async () => {
      await svc.setPrimaryMethod('password');
      await svc.setAllowedMethods(['pin']);
      expect(svc.primaryMethod).toBe('pin');
    });
  });

  // ── 2.1.4 enableMethod ──────────────────────────────────────────────

  describe('enableMethod()', () => {
    it('2.1.4 adds method to allowed list if not present', async () => {
      await svc.enableMethod('rfid_nfc');
      expect(svc.allowedMethods).toContain('rfid_nfc');
    });

    it('2.1.4 persists change', async () => {
      await svc.enableMethod('rfid_nfc');
      expect(kv.setObject).toHaveBeenCalledWith('auth.allowedMethods', expect.arrayContaining(['rfid_nfc']));
    });

    it('2.1.4 is idempotent — does not duplicate if already present', async () => {
      await svc.enableMethod('pin');
      const pinCount = svc.allowedMethods.filter(m => m === 'pin').length;
      expect(pinCount).toBe(1);
    });
  });

  // ── 2.1.5 / 2.1.6 disableMethod ────────────────────────────────────

  describe('disableMethod()', () => {
    beforeEach(async () => {
      await svc.setAllowedMethods(['pin', 'password', 'biometric']);
    });

    it('2.1.5 removes non-pin method from allowed list', async () => {
      await svc.disableMethod('password');
      expect(svc.allowedMethods).not.toContain('password');
    });

    it('2.1.5 persists change', async () => {
      await svc.disableMethod('biometric');
      expect(kv.setObject).toHaveBeenCalledWith('auth.allowedMethods', expect.not.arrayContaining(['biometric']));
    });

    it('2.1.6 is a no-op when called with pin', async () => {
      await svc.disableMethod('pin');
      expect(svc.allowedMethods).toContain('pin');
    });

    it('5.4 falls back primary to pin when disabled method was primary', async () => {
      await svc.setPrimaryMethod('password');
      await svc.disableMethod('password');
      expect(svc.primaryMethod).toBe('pin');
    });
  });

  // ── 2.1.7 / 2.1.8 setMethodConfig / getMethodConfig ─────────────────

  describe('setMethodConfig() / getMethodConfig()', () => {
    it('2.1.7 persists per-method config immediately', async () => {
      await svc.setMethodConfig('magstripe', { deviceId: 'COM3' });
      expect(kv.setObject).toHaveBeenCalledWith('auth.config.magstripe', { deviceId: 'COM3' });
    });

    it('2.1.8 returns stored config for a method', async () => {
      await svc.setMethodConfig('rfid_nfc', { port: 9900 });
      const cfg = await svc.getMethodConfig<{ port: number }>('rfid_nfc');
      expect(cfg).toEqual({ port: 9900 });
    });

    it('2.1.8 returns null when no config has been set', async () => {
      const cfg = await svc.getMethodConfig('biometric');
      expect(cfg).toBeNull();
    });
  });
});
