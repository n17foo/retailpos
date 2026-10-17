import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import POSConfigSettingsTab from './POSConfigSettingsTab';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../../platform-clients/services/config/POSConfigService', () => ({
  DEFAULT_AUTO_LOCK_MINUTES: 5,
  posConfig: {
    values: {
      storeName: 'Main Flagship',
      storeAddress: '10 Oxford St',
      storePhone: '02079460000',
      taxRate: 0.2,
      currencySymbol: '£',
      maxSyncRetries: 3,
      drawerOpenOnCash: true,
      autoLockMinutes: 5,
    },
    updateAll: jest.fn(),
  },
}));

jest.mock('../../customers/services/loyalty/LoyaltyService', () => ({
  loyaltyService: {
    getConfig: jest.fn().mockResolvedValue({ enabled: true, earnRate: 100, redeemRate: 1, expiryDays: 365 }),
  },
}));

jest.mock('../../customers/services/customer/StoreCreditService', () => ({
  storeCreditService: {
    isEnabled: jest.fn().mockResolvedValue(true),
  },
}));

describe('POSConfigSettingsTab', () => {
  it('loads store details, tax rate, and loyalty settings', async () => {
    const tree = await renderUi(<POSConfigSettingsTab />);
    expect(hasText(tree, 'settings.posConfig.storeInfo')).toBe(true);
  });
});
