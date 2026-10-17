const locks = new Map<string, Promise<unknown>>();

/**
 * Serialises async work per key — callers holding the same key run one at a
 * time, in arrival order. Used to make validate-then-write sequences atomic
 * against concurrent callers in the same process (e.g. returns on one order).
 */
export async function withKeyedLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous: Promise<unknown> = locks.get(key) ?? Promise.resolve();

  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  const tail = previous.then(() => gate);
  locks.set(key, tail);

  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === tail) {
      locks.delete(key);
    }
  }
}
