import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { SyncQueueBanner } from './SyncQueueBanner';

describe('SyncQueueBanner', () => {
  it('renders nothing when the queue is empty', async () => {
    const tree = await renderUi(<SyncQueueBanner pending={0} failed={0} />);
    expect(hasText(tree, 'in queue')).toBe(false);
  });

  it('shows the combined pending + failed count', async () => {
    const tree = await renderUi(<SyncQueueBanner pending={2} failed={1} />);
    expect(hasText(tree, '3 requests in queue')).toBe(true);
  });

  it('uses the singular form for one request', async () => {
    const tree = await renderUi(<SyncQueueBanner pending={1} failed={0} />);
    expect(hasText(tree, '1 request in queue')).toBe(true);
  });
});
