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

import { AuthService } from './AuthService';
import { AuthConfigService } from './AuthConfigService';
import { AuthMethodProvider, AuthMethodType, AuthMode, AUTH_METHOD_INFO, getAuthMethodsForMode } from './AuthMethodInterface';
import { KeyValueRepository } from '../../repositories/KeyValueRepository';
jest.mock('./providers/PinAuthProvider', () => ({
  PinAuthProvider: jest.fn().mockImplementation(() => ({
    type: 'pin',
    info: {},
    isAvailable: jest.fn().mockResolvedValue(true),
    authenticate: jest.fn().mockResolvedValue({ success: true }),
    enroll: jest.fn(),
    unenroll: jest.fn(),
    isEnrolled: jest.fn(),
  })),
}));
jest.mock('./providers/BiometricAuthProvider', () => ({
  BiometricAuthProvider: jest.fn().mockImplementation(() => ({
    type: 'biometric',
    info: {},
    isAvailable: jest.fn().mockResolvedValue(true),
    authenticate: jest.fn().mockResolvedValue({ success: true }),
    enroll: jest.fn(),
    unenroll: jest.fn(),
    isEnrolled: jest.fn(),
  })),
}));
jest.mock('./providers/PasswordAuthProvider', () => ({
  PasswordAuthProvider: jest.fn().mockImplementation(() => ({
    type: 'password',
    info: {},
    isAvailable: jest.fn().mockResolvedValue(true),
    authenticate: jest.fn().mockResolvedValue({ success: true }),
    enroll: jest.fn(),
    unenroll: jest.fn(),
    isEnrolled: jest.fn(),
  })),
}));
jest.mock('./providers/MagstripeAuthProvider', () => ({
  MagstripeAuthProvider: jest.fn().mockImplementation(() => ({
    type: 'magstripe',
    info: {},
    isAvailable: jest.fn().mockResolvedValue(true),
    authenticate: jest.fn().mockResolvedValue({ success: true }),
    enroll: jest.fn(),
    unenroll: jest.fn(),
    isEnrolled: jest.fn(),
  })),
}));
jest.mock('./providers/RfidNfcAuthProvider', () => ({
  RfidNfcAuthProvider: jest.fn().mockImplementation(() => ({
    type: 'rfid_nfc',
    info: {},
    isAvailable: jest.fn().mockResolvedValue(true),
    authenticate: jest.fn().mockResolvedValue({ success: true }),
    enroll: jest.fn(),
    unenroll: jest.fn(),
    isEnrolled: jest.fn(),
  })),
}));
jest.mock('./providers/PlatformAuthProvider', () => ({
  PlatformAuthProvider: jest.fn().mockImplementation(() => ({
    type: 'platform_auth',
    info: {},
    isAvailable: jest.fn().mockResolvedValue(true),
    authenticate: jest.fn().mockResolvedValue({ success: true }),
    enroll: jest.fn(),
    unenroll: jest.fn(),
    isEnrolled: jest.fn(),
  })),
}));

// ── Helpers ──────────────────────────────────────────────────────────

function makeProvider(type: AuthMethodType, available = true): jest.Mocked<AuthMethodProvider> {
  return {
    type,
    info: AUTH_METHOD_INFO[type],
    isAvailable: jest.fn().mockResolvedValue(available),
    authenticate: jest.fn().mockResolvedValue({ success: true }),
    enroll: jest.fn().mockResolvedValue(true),
    unenroll: jest.fn().mockResolvedValue(true),
    isEnrolled: jest.fn().mockResolvedValue(false),
  };
}

function makeMockKv(): jest.Mocked<KeyValueRepository> {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn(async (k: string) => store[k] ?? null),
    setItem: jest.fn(async (k: string, v: string) => {
      store[k] = v;
    }),
    removeItem: jest.fn(async (k: string) => {
      delete store[k];
    }),
    getObject: jest.fn(async <T>(k: string): Promise<T | null> => {
      const v = store[k];
      return v ? (JSON.parse(v) as T) : null;
    }),
    setObject: jest.fn(async <T>(k: string, v: T) => {
      store[k] = JSON.stringify(v);
    }),
  } as unknown as jest.Mocked<KeyValueRepository>;
}

function makeConfig(primary: AuthMethodType = 'pin', allowed: AuthMethodType[] = ['pin'], mode: AuthMode = 'offline') {
  const kv = makeMockKv();
  const cfg = new AuthConfigService(kv);
  // Patch in-memory values directly via setters
  (cfg as unknown as Record<string, unknown>)['primary'] = primary;
  (cfg as unknown as Record<string, unknown>)['allowed'] = allowed;
  (cfg as unknown as Record<string, unknown>)['mode'] = mode;
  return cfg;
}

// ── Tests ─────────────────────────────────────────────────────────────

describe('AuthService', () => {
  afterEach(() => {
    AuthService.resetInstance();
  });

  // ── 1.1 Provider registration ────────────────────────────────────────

  describe('constructor / provider registration (req 1.1)', () => {
    it('registers all six built-in providers at construction', () => {
      const cfg = makeConfig();
      const svc = new AuthService(cfg);
      const types: AuthMethodType[] = ['pin', 'biometric', 'password', 'magstripe', 'rfid_nfc', 'platform_auth'];
      for (const t of types) {
        expect(svc.getProvider(t)).toBeDefined();
      }
    });
  });

  // ── 2.2 authenticate(method, credential) ────────────────────────────

  describe('authenticate()', () => {
    it('2.2.1 calls isAvailable() before authenticating', async () => {
      const cfg = makeConfig();
      const svc = new AuthService(cfg);
      const pin = makeProvider('pin');
      svc.registerProvider(pin);

      await svc.authenticate('pin', '123456');
      expect(pin.isAvailable).toHaveBeenCalled();
      expect(pin.authenticate).toHaveBeenCalledWith('123456');
    });

    it('2.2.2 returns failure (no throw) when isAvailable() is false', async () => {
      const cfg = makeConfig();
      const svc = new AuthService(cfg);
      const bio = makeProvider('biometric', false);
      svc.registerProvider(bio);

      const result = await svc.authenticate('biometric');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(bio.authenticate).not.toHaveBeenCalled();
    });

    it('returns failure when provider type is unknown', async () => {
      const cfg = makeConfig();
      const svc = new AuthService(cfg);
      const result = await svc.authenticate('unknown_method' as AuthMethodType, 'cred');
      expect(result.success).toBe(false);
    });
  });

  // ── 2.2.3–2.2.5 authenticateWithPrimary ─────────────────────────────

  describe('authenticateWithPrimary()', () => {
    it('2.2.3 uses the configured primary method', async () => {
      const cfg = makeConfig('password', ['pin', 'password']);
      const svc = new AuthService(cfg);
      const pwd = makeProvider('password');
      svc.registerProvider(pwd);
      pwd.authenticate.mockResolvedValue({ success: true });

      await svc.authenticateWithPrimary('secret');
      expect(pwd.authenticate).toHaveBeenCalledWith('secret');
    });

    it('2.2.4 falls back to PIN when primary authentication fails', async () => {
      const cfg = makeConfig('password', ['pin', 'password']);
      const svc = new AuthService(cfg);

      const pwd = makeProvider('password');
      pwd.authenticate.mockResolvedValue({ success: false, error: 'wrong password' });
      svc.registerProvider(pwd);

      const pin = makeProvider('pin');
      pin.authenticate.mockResolvedValue({ success: true });
      svc.registerProvider(pin);

      const result = await svc.authenticateWithPrimary('secret');
      expect(pin.authenticate).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('2.2.5 falls back to PIN directly when primary is unavailable', async () => {
      const cfg = makeConfig('magstripe', ['pin', 'magstripe']);
      const svc = new AuthService(cfg);

      const mag = makeProvider('magstripe', false);
      svc.registerProvider(mag);

      const pin = makeProvider('pin');
      pin.authenticate.mockResolvedValue({ success: true });
      svc.registerProvider(pin);

      const result = await svc.authenticateWithPrimary('card-data');
      expect(pin.authenticate).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('3.4 does not trigger fallback when PIN is primary and succeeds', async () => {
      const cfg = makeConfig('pin', ['pin']);
      const svc = new AuthService(cfg);

      const pin = makeProvider('pin');
      pin.authenticate.mockResolvedValue({ success: true });
      svc.registerProvider(pin);

      const result = await svc.authenticateWithPrimary('111111');
      expect(result.success).toBe(true);
      expect(pin.authenticate).toHaveBeenCalledTimes(1);
    });

    it('5.3 returns PIN failure when fallback PIN also fails — no further fallback', async () => {
      const cfg = makeConfig('password', ['pin', 'password']);
      const svc = new AuthService(cfg);

      const pwd = makeProvider('password');
      pwd.authenticate.mockResolvedValue({ success: false, error: 'wrong password' });
      svc.registerProvider(pwd);

      const pin = makeProvider('pin');
      pin.authenticate.mockResolvedValue({ success: false, error: 'wrong pin' });
      svc.registerProvider(pin);

      const result = await svc.authenticateWithPrimary('secret');
      expect(result.success).toBe(false);
      expect(result.error).toBe('wrong pin');
    });
  });

  // ── 2.3 getAvailableProviders ────────────────────────────────────────

  describe('getAvailableProviders()', () => {
    it('2.3.1 returns only allowed methods that are available', async () => {
      const cfg = makeConfig('pin', ['pin', 'biometric', 'password']);
      const svc = new AuthService(cfg);

      const pin = makeProvider('pin', true);
      const bio = makeProvider('biometric', false);
      const pwd = makeProvider('password', true);
      svc.registerProvider(pin);
      svc.registerProvider(bio);
      svc.registerProvider(pwd);

      const result = await svc.getAvailableProviders();
      const types = result.map(p => p.type);
      expect(types).toContain('pin');
      expect(types).toContain('password');
      expect(types).not.toContain('biometric');
    });

    it('2.3.2 always includes PIN even if not in the allowed list result', async () => {
      const cfg = makeConfig('biometric', ['biometric']);
      const svc = new AuthService(cfg);

      const bio = makeProvider('biometric', false);
      svc.registerProvider(bio);

      const pin = makeProvider('pin', true);
      svc.registerProvider(pin);

      const result = await svc.getAvailableProviders();
      expect(result.some(p => p.type === 'pin')).toBe(true);
    });

    it('5.5 returns only PIN when all other methods are unavailable', async () => {
      const cfg = makeConfig('pin', ['pin', 'biometric', 'magstripe']);
      const svc = new AuthService(cfg);

      const pin = makeProvider('pin', true);
      const bio = makeProvider('biometric', false);
      const mag = makeProvider('magstripe', false);
      svc.registerProvider(pin);
      svc.registerProvider(bio);
      svc.registerProvider(mag);

      const result = await svc.getAvailableProviders();
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('pin');
    });

    it('5.6 treats a provider as unavailable when isAvailable() throws, continues evaluating others', async () => {
      const cfg = makeConfig('pin', ['pin', 'biometric', 'password']);
      const svc = new AuthService(cfg);

      const pin = makeProvider('pin', true);
      const bio = makeProvider('biometric');
      bio.isAvailable.mockRejectedValue(new Error('OS crash'));
      const pwd = makeProvider('password', true);

      svc.registerProvider(pin);
      svc.registerProvider(bio);
      svc.registerProvider(pwd);

      const result = await svc.getAvailableProviders();
      const types = result.map(p => p.type);
      expect(types).not.toContain('biometric');
      expect(types).toContain('password');
      expect(types).toContain('pin');
    });
  });

  // ── 2.3.3 getAuthMethodsForMode ─────────────────────────────────────

  describe('getAuthMethodsForMode()', () => {
    it('2.3.3 returns methods that support online mode', () => {
      const online = getAuthMethodsForMode('online');
      expect(online).toContain('platform_auth');
      expect(online).toContain('pin');
    });

    it('2.3.3 returns methods that support offline mode', () => {
      const offline = getAuthMethodsForMode('offline');
      expect(offline).toContain('pin');
      expect(offline).not.toContain('platform_auth');
    });

    it('3.1 platform_auth does not appear in offline mode results', () => {
      const offline = getAuthMethodsForMode('offline');
      expect(offline).not.toContain('platform_auth');
    });
  });
});
