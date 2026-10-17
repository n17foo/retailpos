import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import CustomerSearchModal from './CustomerSearchModal';
import { useCustomerSearch } from '../hooks/useCustomerSearch';
import { ECommercePlatform } from '../../../shared/utils/platforms';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../hooks/useCustomerSearch', () => ({
  useCustomerSearch: jest.fn(),
}));

describe('CustomerSearchModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders customer search results and calls onSelect when a customer is tapped', async () => {
    const sampleCustomer = {
      id: 'c1',
      platformId: 'c1',
      platform: ECommercePlatform.SHOPIFY,
      email: 'bob@example.com',
      firstName: 'Bob',
      lastName: 'Jones',
    };
    (useCustomerSearch as jest.Mock).mockReturnValue({
      customers: [sampleCustomer],
      isSearching: false,
      error: null,
      hasMore: false,
      search: jest.fn(),
      loadMore: jest.fn(),
      clear: jest.fn(),
      isAvailable: true,
    });

    const onSelect = jest.fn();
    const tree = await renderUi(
      <CustomerSearchModal visible platform={ECommercePlatform.SHOPIFY} onSelect={onSelect} onClose={jest.fn()} />
    );
    expect(hasText(tree, 'Bob Jones')).toBe(true);

    await pressByText(tree, 'Bob Jones');
    expect(onSelect).toHaveBeenCalledWith(sampleCustomer);
  });
});
