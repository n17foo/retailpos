import { withKeyedLock } from './keyedLock';

describe('withKeyedLock', () => {
  it('serialises work sharing a key in arrival order', async () => {
    const events: string[] = [];
    const task = (id: string, delay: number) =>
      withKeyedLock('k', async () => {
        events.push(`start:${id}`);
        await new Promise(r => setTimeout(r, delay));
        events.push(`end:${id}`);
      });

    await Promise.all([task('a', 20), task('b', 0)]);

    // b arrives second and must not start until a fully finishes
    expect(events).toEqual(['start:a', 'end:a', 'start:b', 'end:b']);
  });

  it('runs different keys concurrently', async () => {
    const events: string[] = [];
    const task = (key: string, id: string, delay: number) =>
      withKeyedLock(key, async () => {
        events.push(`start:${id}`);
        await new Promise(r => setTimeout(r, delay));
        events.push(`end:${id}`);
      });

    await Promise.all([task('k1', 'a', 20), task('k2', 'b', 0)]);

    expect(events.indexOf('start:b')).toBeLessThan(events.indexOf('end:a'));
  });

  it('releases the key when the work throws', async () => {
    await expect(withKeyedLock('k', async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');

    const order: string[] = [];
    await withKeyedLock('k', async () => {
      order.push('ran');
    });
    expect(order).toEqual(['ran']);
  });
});
