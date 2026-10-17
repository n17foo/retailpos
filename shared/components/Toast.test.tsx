import React from 'react';
import { renderUi, hasText } from '../../tests/testUtils';
import Toast from './Toast';

describe('Toast', () => {
  it('returns null when notification is null and renders title/message when present', async () => {
    const emptyTree = await renderUi(<Toast notification={null} onDismiss={jest.fn()} />);
    expect(emptyTree.toJSON()).toBeNull();

    const tree = await renderUi(
      <Toast
        notification={{
          id: 't1',
          title: 'Order Synced',
          message: 'Order #101 pushed',
          severity: 'success',
          read: false,
          timestamp: new Date(),
        }}
        onDismiss={jest.fn()}
      />
    );
    expect(hasText(tree, 'Order Synced')).toBe(true);
    expect(hasText(tree, 'Order #101 pushed')).toBe(true);
  });
});
