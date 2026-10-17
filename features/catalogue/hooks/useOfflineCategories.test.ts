import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useOfflineCategories } from './useOfflineCategories';
import { offlineCategoryService } from '../services/category/platforms/OfflineCategoryService';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

jest.mock('../services/category/platforms/OfflineCategoryService', () => ({
  offlineCategoryService: {
    getCategories: jest.fn(),
    addCategory: jest.fn(),
    updateCategory: jest.fn(),
    deleteCategory: jest.fn(),
    clearLocalCategories: jest.fn(),
    setCategories: jest.fn(),
  },
}));

async function mountHook() {
  let latest: ReturnType<typeof useOfflineCategories> | null = null;
  function Harness() {
    latest = useOfflineCategories();
    return null;
  }
  await act(async () => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useOfflineCategories', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (offlineCategoryService.getCategories as jest.Mock).mockResolvedValue([{ id: 'c1', name: 'Bakery' }]);
  });

  it('loads offline categories on mount and supports CRUD operations', async () => {
    (offlineCategoryService.addCategory as jest.Mock).mockResolvedValue({ id: 'c2', name: 'Dairy' });
    (offlineCategoryService.deleteCategory as jest.Mock).mockResolvedValue(true);

    const { get } = await mountHook();
    expect(get().categories).toEqual([{ id: 'c1', name: 'Bakery' }]);

    await act(async () => {
      const created = await get().createCategory({ name: 'Dairy' });
      expect(created.id).toBe('c2');
      const deleted = await get().deleteCategory('c1');
      expect(deleted).toBe(true);
    });

    expect(offlineCategoryService.addCategory).toHaveBeenCalledWith({ name: 'Dairy' });
    expect(offlineCategoryService.deleteCategory).toHaveBeenCalledWith('c1');
  });
});
