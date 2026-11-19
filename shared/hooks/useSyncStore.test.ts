/**
 * SHR-01 regression — overlapping queue drains must not fetch the same queued
 * request twice. The drain is single-flight and iterates the live queue head,
 * so entries enqueued mid-drain are still processed by the same drain.
 */
const store = new Map<string, string>();

jest.mock('../repositories/KeyValueRepository', () => ({
  keyValueRepository: {
    getItem: jest.fn(async (k: string) => store.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => void store.set(k, v)),
    removeItem: jest.fn(async (k: string) => void store.delete(k)),
  },
}));

import { useSyncStore } from './useSyncStore';

const deferred = <T>() => {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

const ok = () => ({ ok: true, status: 200 }) as Response;
const err500 = () => ({ ok: false, status: 503 }) as Response;

const enqueue = (requestId: string) =>
  useSyncStore.getState().addToQueue({ url: 'https://store.test/api', method: 'POST', body: {}, requestId });

beforeEach(() => {
  store.clear();
  useSyncStore.setState({ queue: [], isProcessing: false });
  jest.restoreAllMocks();
});

describe('SHR-01 — single active drain', () => {
  it('a second processQueue during an in-flight drain does not refetch the entry', async () => {
    const gate = deferred<Response>();
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(() => gate.promise);

    useSyncStore.getState().addToQueue({ url: 'https://store.test/api', method: 'POST', body: {}, requestId: 'r1' });
    // Overlapping triggers (netinfo + app foreground + manual) while fetch hangs:
    const drain2 = useSyncStore.getState().processQueue();
    const drain3 = useSyncStore.getState().processQueue();

    gate.resolve(ok());
    await Promise.all([drain2, drain3]);
    await useSyncStore.getState().processQueue();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(useSyncStore.getState().queue).toHaveLength(0);
  });

  it('an entry enqueued mid-drain is still sent once by the same drain', async () => {
    const gate1 = deferred<Response>();
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementationOnce(() => gate1.promise)
      .mockResolvedValue(ok());

    enqueue('r1'); // kicks off the drain; first fetch is in flight
    enqueue('r2'); // enqueued while draining — must be picked up, not double-drained

    gate1.resolve(ok());
    // Let the in-flight drain finish picking up r2.
    await useSyncStore.getState().processQueue();
    await useSyncStore.getState().processQueue();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useSyncStore.getState().queue).toHaveLength(0);
  });

  it('a 5xx marks backoff, stops the drain, and the entry is retried once next time', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValueOnce(err500()).mockResolvedValue(ok());

    enqueue('r1');
    await useSyncStore.getState().processQueue();

    const afterFail = useSyncStore.getState().queue;
    expect(afterFail).toHaveLength(1);
    expect(afterFail[0].attempts).toBe(1);
    expect(afterFail[0].nextRetryAt).toBeDefined();

    await useSyncStore.getState().processQueue();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(useSyncStore.getState().queue).toHaveLength(0);
  });
});
