import React from 'react';
import { renderUi } from '../../tests/testUtils';
import { OptimizedImage, preloadImages, clearImageCache } from './OptimizedImage';

describe('OptimizedImage', () => {
  it('renders ExpoImage wrapper and supports cache helpers', async () => {
    const tree = await renderUi(<OptimizedImage source={{ uri: 'https://example.com/item.png' }} resizeMode="cover" />);
    expect(tree.toJSON()).not.toBeNull();
    preloadImages(['https://example.com/a.png']);
    await clearImageCache();
  });
});
