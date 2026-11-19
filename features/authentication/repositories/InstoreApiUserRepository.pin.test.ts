/**
 * AUTH-01 regression — PIN login on a client register must fall back to the
 * locally cached credential when the LAN is down, and only an explicit 401/403
 * from the server may count as "invalid PIN" (a transport failure is not a
 * rejection).
 */
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('expo-sqlite', () => {
  const { openDb } = require('../../../tests/helpers/nodeSqliteAdapter');
  const real = openDb();
  return {
    openDatabaseAsync: jest.fn(async () => real),
    openDatabaseSync: jest.fn(() => real),
  };
});

jest.mock('../../../shared/services/logger/LoggerFactory', () => ({
  LoggerFactory: {
    getInstance: jest.fn(() => ({
      createLogger: jest.fn(() => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() })),
    })),
  },
}));

jest.mock('../../multi-register/services/InstoreApiConfig', () => ({
  instoreApiConfig: { isClient: true, current: { registerId: 'reg-1' } },
}));

import { db } from '../../../shared/utils/db';
import { initializeSchema } from '../../../shared/utils/dbSchema';
import { instoreApiClient } from '../../platform-clients/services/clients/instoreapi/InstoreApiClient';
import { ApiError, RequestTimeoutError } from '../../../shared/utils/apiErrors';
import { userRepository } from './UserRepository';
import { InstoreApiUserRepository } from './InstoreApiUserRepository';
import { PinAuthProvider } from '../services/auth/providers/PinAuthProvider';

const realDb = db as unknown as SQLiteDatabase;

/** Reach the client's private post() to simulate transport outcomes. */
const postMock = jest.fn();
beforeAll(() => {
  (instoreApiClient as unknown as { post: typeof postMock }).post = postMock;
});
afterAll(() => {
  delete (instoreApiClient as unknown as { post?: unknown }).post;
});

beforeEach(async () => {
  await initializeSchema(realDb);
  await realDb.runAsync('DELETE FROM users');
  postMock.mockReset();
});

describe('AUTH-01 — verifyPin error classification', () => {
  it('returns null only on explicit 401/403 rejection', async () => {
    postMock.mockRejectedValueOnce(new ApiError(401, 'invalid pin'));
    await expect(instoreApiClient.verifyPin('123456')).resolves.toBeNull();

    postMock.mockRejectedValueOnce(new ApiError(403, 'forbidden'));
    await expect(instoreApiClient.verifyPin('123456')).resolves.toBeNull();
  });

  it('rethrows transport failures and 5xx instead of swallowing them', async () => {
    postMock.mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(instoreApiClient.verifyPin('123456')).rejects.toThrow('Network request failed');

    postMock.mockRejectedValueOnce(new RequestTimeoutError('POST /api/users/verify-pin timed out'));
    await expect(instoreApiClient.verifyPin('123456')).rejects.toThrow(RequestTimeoutError);

    postMock.mockRejectedValueOnce(new ApiError(503, 'server wedged'));
    await expect(instoreApiClient.verifyPin('123456')).rejects.toThrow(ApiError);
  });
});

describe('AUTH-01 — PIN login falls back to the cached credential during a LAN outage', () => {
  it('authenticates a previously verified PIN while the store API is down', async () => {
    // Cache a user who verified on this register before the outage.
    await userRepository.create({ name: 'Alice', email: 'a@x.com', pin: '000000', role: 'cashier' });
    const seeded = await userRepository.findByPin('000000');
    await userRepository.cacheVerifiedPin(seeded!.id, '654321');
    postMock.mockRejectedValue(new TypeError('Network request failed'));

    const provider = new PinAuthProvider();
    const result = await provider.authenticate('654321');

    expect(result.success).toBe(true);
    expect(result.user?.id).toBe(seeded!.id);
  });

  it('still rejects a PIN this register has never seen while offline', async () => {
    postMock.mockRejectedValue(new TypeError('Network request failed'));

    const provider = new PinAuthProvider();
    const result = await provider.authenticate('999999');

    expect(result.success).toBe(false);
  });

  it('caches a server-verified PIN for the next outage', async () => {
    await userRepository.create({ name: 'Bob', email: 'b@x.com', pin: '000000', role: 'manager' });
    const seeded = await userRepository.findByPin('000000');
    postMock.mockResolvedValueOnce({ user: { id: seeded!.id, name: 'Bob', role: 'manager' } });

    const repo = new InstoreApiUserRepository();
    const online = await repo.findByPin('123456');
    expect(online?.id).toBe(seeded!.id);

    // LAN goes down — the just-cached credential verifies locally.
    postMock.mockRejectedValue(new TypeError('Network request failed'));
    const offline = await repo.findByPin('123456');
    expect(offline?.id).toBe(seeded!.id);
    expect(offline?.role).toBe('manager');
  });
});
