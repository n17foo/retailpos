import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import EcommerceSettingsTab from './EcommerceSettingsTab';

const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

jest.mock('../../authentication/contexts/AuthProvider', () => ({
  useAuthContext: () => ({ user: { id: 'u1', username: 'Admin', role: 'admin' } }),
}));

jest.mock('../../../shared/services/audit/AuditLogService', () => ({
  auditLogService: { log: jest.fn() },
}));

jest.mock('../../platform-clients/hooks/useEcommerceSettings', () => ({
  useEcommerceSettings: () => ({
    ecommerceSettings: {
      enabled: true,
      platform: 'shopify',
      apiUrl: '',
      apiKey: '',
      syncInventory: true,
      shopify: { apiKey: 'k', accessToken: 'shpat_1', storeUrl: 'shop.myshopify.com' },
      woocommerce: { apiKey: '', apiSecret: '', storeUrl: '' },
      magento: { accessToken: '', storeUrl: '', apiVersion: '' },
      bigcommerce: { clientId: '', accessToken: '', storeHash: '' },
      sylius: { apiToken: '', storeUrl: '', apiVersion: '' },
      wix: { apiKey: '', siteId: '', accountId: '' },
      prestashop: { apiKey: '', storeUrl: '' },
      commercefull: { apiKey: '', apiSecret: '', storeUrl: '' },
      offline: { storeName: '' },
    },
    hasUnsavedChanges: false,
    isLoading: false,
    updateSettings: jest.fn(),
    saveSettings: jest.fn(),
    testConnection: jest.fn(),
    cancelChanges: jest.fn(),
  }),
}));

describe('EcommerceSettingsTab', () => {
  it('renders platform selector, Shopify credentials form, and capability summary panel', async () => {
    const tree = await renderUi(<EcommerceSettingsTab />);
    expect(hasText(tree, 'Shopify')).toBe(true);
    expect(hasText(tree, 'Platform capability summary')).toBe(true);
    expect(hasText(tree, 'Native draft')).toBe(true);
  });
});
