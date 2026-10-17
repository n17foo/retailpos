import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useInventory } from './useInventory';
import { ECommercePlatform } from '../../../shared/utils/platforms';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

const mockGetInventory = jest.fn();
const mockUpdateInventory = jest.fn();

jest.mock('../services/InventoryServiceFactory', () => ({
  InventoryServiceFactory: {
    getInstance: () => ({
      getService: () => ({
        getInventory: mockGetInventory,
        updateInventory: mockUpdateInventory,
      }),
    }),
  },
}));

function mountHook(platform = ECommercePlatform.SHOPIFY) {
  let latest: ReturnType<typeof useInventory> | null = null;
  function Harness() {
    latest = useInventory(platform);
    return null;
  }
  act(() => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useInventory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches inventory and sums variant quantities in getProductInventory', async () => {
    mockGetInventory.mockResolvedValue({
      items: [
        { productId: 'p1', variantId: 'v1', quantity: 4 },
        { productId: 'p1', variantId: 'v2', quantity: 6 },
      ],
    });

    const { get } = mountHook();

    let total = 0;
    await act(async () => {
      total = await get().getProductInventory('p1');
    });

    expect(total).toBe(10);
    expect(get().inventory?.items).toHaveLength(2);
    expect(get().error).toBeNull();
  });

  it('adjusts and sets inventory quantities via updateInventory', async () => {
    mockUpdateInventory.mockResolvedValue({ successful: 1, failed: 0, errors: [] });

    const { get } = mountHook();

    let adjusted = false;
    await act(async () => {
      adjusted = await get().adjustInventory('p1', -2, 'v1');
    });
    expect(adjusted).toBe(true);
    expect(mockUpdateInventory).toHaveBeenCalledWith([{ productId: 'p1', variantId: 'v1', quantity: -2, adjustment: true }]);

    let setOk = false;
    await act(async () => {
      setOk = await get().setInventoryQuantity('p1', 15, 'v1');
    });
    expect(setOk).toBe(true);
    expect(mockUpdateInventory).toHaveBeenCalledWith([{ productId: 'p1', variantId: 'v1', quantity: 15, adjustment: false }]);
  });
});
