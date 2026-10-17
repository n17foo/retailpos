import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useActivePlatform } from './useActivePlatform';
import { keyValueRepository } from '../../../shared/repositories/KeyValueRepository';
import { ECommercePlatform } from '../../../shared/utils/platforms';

jest.mock('../../../shared/repositories/KeyValueRepository', () => ({
  keyValueRepository: {
    getItem: jest.fn(),
  },
}));

async function mountHook(explicit?: ECommercePlatform | null, refreshKey?: unknown) {
  let latest: ReturnType<typeof useActivePlatform> | null = null;
  function Harness() {
    latest = useActivePlatform(explicit, refreshKey);
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useActivePlatform', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns explicit platform immediately without querying storage', async () => {
    const { get } = await mountHook(ECommercePlatform.SHOPIFY);
    expect(get()).toEqual({ platform: ECommercePlatform.SHOPIFY, isResolved: true });
    expect(keyValueRepository.getItem).not.toHaveBeenCalled();
  });

  it('returns unresolved when explicit is null', async () => {
    const { get } = await mountHook(null);
    expect(get()).toEqual({ platform: undefined, isResolved: false });
    expect(keyValueRepository.getItem).not.toHaveBeenCalled();
  });

  it('resolves stored valid platform from KeyValueRepository', async () => {
    (keyValueRepository.getItem as jest.Mock).mockResolvedValue('woocommerce');
    const { get } = await mountHook(undefined);
    expect(get()).toEqual({ platform: ECommercePlatform.WOOCOMMERCE, isResolved: true });
  });

  it('ignores unsupported stored platform values', async () => {
    (keyValueRepository.getItem as jest.Mock).mockResolvedValue('unsupported_platform');
    const { get } = await mountHook(undefined);
    expect(get()).toEqual({ platform: undefined, isResolved: true });
  });
});
