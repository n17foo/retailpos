/**
 * Bug 9: every signed Store API request must be time-bounded — a frozen
 * server cannot be allowed to hang checkout — and 5xx responses must
 * surface as typed ApiError so isStoreApiUnavailable can degrade safely.
 */
jest.mock('../../../../multi-register/services/InstoreApiConfig', () => ({
  instoreApiConfig: {
    baseUrl: 'http://store.local:8080',
    current: { sharedSecret: 's3cret', registerId: 'reg-1' },
  },
}));

jest.mock('../../../../multi-register/services/StoreApiHealthService', () => ({
  storeApiHealthService: {
    noteRequestSuccess: jest.fn(),
    noteRequestFailure: jest.fn(),
  },
}));

import { instoreApiClient } from './InstoreApiClient';
import { ApiError, RequestTimeoutError } from '../../../../../shared/utils/apiErrors';
import { isStoreApiUnavailable } from '../../../../multi-register/services/offline/isStoreApiUnavailable';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

describe('InstoreApiClient timeouts and 5xx classification', () => {
  it('rejects with RequestTimeoutError when the server never answers', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(
      (_url, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
          });
        })
    ) as jest.Mock;

    const pending = instoreApiClient.getOrders();
    const assertion = expect(pending).rejects.toThrow(RequestTimeoutError);
    await jest.advanceTimersByTimeAsync(11_000);
    await assertion;
  });

  it('a wedged server returning 503 degrades as unavailable', async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ error: 'backend unavailable' }), { status: 503 })) as jest.Mock;

    const error = await instoreApiClient.getOrders().catch(e => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(503);
    expect(isStoreApiUnavailable(error)).toBe(true);
  });

  it('a 422 rejection stays an application error, not a degradation', async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ error: 'validation failed' }), { status: 422 })) as jest.Mock;

    const error = await instoreApiClient.getOrders().catch(e => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(422);
    expect(isStoreApiUnavailable(error)).toBe(false);
  });
});
