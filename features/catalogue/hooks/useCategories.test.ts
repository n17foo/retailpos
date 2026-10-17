import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useUnifiedCategories, useCategoryNavigation } from './useCategories';
import { ECommercePlatform } from '../../../shared/utils/platforms';

jest.mock('../../platform-clients/hooks/useActivePlatform', () => ({
  useActivePlatform: () => ({ platform: ECommercePlatform.OFFLINE, isResolved: true }),
}));

const mockGetCategories = jest.fn();

jest.mock('../services/category/CategoryServiceFactory', () => ({
  CategoryServiceFactory: {
    getInstance: () => ({
      getService: () => ({
        getCategories: mockGetCategories,
      }),
    }),
  },
}));

describe('useUnifiedCategories & useCategoryNavigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCategories.mockResolvedValue([
      { id: 'c1', name: 'Drinks' },
      { id: 'c2', name: 'Hot Drinks', parentId: 'c1' },
    ]);
  });

  it('fetches categories, builds tree, and supports category navigation', async () => {
    let latestCats: ReturnType<typeof useUnifiedCategories> | null = null;
    let latestNav: ReturnType<typeof useCategoryNavigation> | null = null;

    function Harness() {
      latestCats = useUnifiedCategories(ECommercePlatform.OFFLINE);
      latestNav = useCategoryNavigation(latestCats.categories);
      return null;
    }

    await act(async () => {
      createRoot().render(React.createElement(Harness));
    });

    expect(latestCats!.isLoading).toBe(false);
    expect(latestCats!.categories).toHaveLength(2);
    expect(latestCats!.getRootCategories()).toHaveLength(1);
    expect(latestCats!.getChildCategories('offline-c1')).toHaveLength(1);

    act(() => {
      latestNav!.navigateTo('offline-c1');
    });
    expect(latestNav!.currentCategoryId).toBe('offline-c1');
    expect(latestNav!.canNavigateUp).toBe(true);

    act(() => {
      latestNav!.navigateUp();
    });
    expect(latestNav!.currentCategoryId).toBeNull();
  });
});
