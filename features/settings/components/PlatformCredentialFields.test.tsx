import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { PlatformCredentialFields } from './PlatformCredentialFields';
import type { ECommerceSettings } from '../../platform-clients/hooks/useEcommerceSettings';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

const makeSettings = (platform: string): ECommerceSettings => ({
  enabled: true,
  platform,
  apiUrl: '',
  apiKey: '',
  syncInventory: false,
  shopify: { apiKey: '', accessToken: '', storeUrl: '' },
  woocommerce: { apiKey: '', apiSecret: '', storeUrl: '' },
  magento: { accessToken: '', storeUrl: '', apiVersion: '' },
  bigcommerce: { clientId: '', accessToken: '', storeHash: '' },
  sylius: { apiToken: '', storeUrl: '', apiVersion: '' },
  wix: { apiKey: '', siteId: '', accountId: '' },
  prestashop: { apiKey: '', storeUrl: '' },
  commercefull: { apiKey: '', apiSecret: '', storeUrl: '' },
  offline: { storeName: '' },
});

describe('PlatformCredentialFields', () => {
  it('renders store URL and API key fields for shopify', async () => {
    const tree = await renderUi(<PlatformCredentialFields settings={makeSettings('shopify')} updateSettings={jest.fn()} />);
    expect(hasText(tree, 'settings.ecommerce.shopifyStoreUrl')).toBe(true);
    expect(hasText(tree, 'settings.ecommerce.adminApiToken')).toBe(true);
  });

  it('renders the consumer secret for woocommerce', async () => {
    const tree = await renderUi(<PlatformCredentialFields settings={makeSettings('woocommerce')} updateSettings={jest.fn()} />);
    expect(hasText(tree, 'settings.ecommerce.consumerSecret')).toBe(true);
  });

  it('renders store hash and client id for bigcommerce', async () => {
    const tree = await renderUi(<PlatformCredentialFields settings={makeSettings('bigcommerce')} updateSettings={jest.fn()} />);
    expect(hasText(tree, 'settings.ecommerce.storeHash')).toBe(true);
    expect(hasText(tree, 'settings.ecommerce.clientId')).toBe(true);
  });

  it('renders site/account fields for wix and no store URL', async () => {
    const tree = await renderUi(<PlatformCredentialFields settings={makeSettings('wix')} updateSettings={jest.fn()} />);
    expect(hasText(tree, 'settings.ecommerce.siteId')).toBe(true);
    expect(hasText(tree, 'settings.ecommerce.storeUrl')).toBe(false);
  });

  it('renders local-mode info and store name for offline', async () => {
    const tree = await renderUi(<PlatformCredentialFields settings={makeSettings('offline')} updateSettings={jest.fn()} />);
    expect(hasText(tree, 'settings.ecommerce.localOnlyMode')).toBe(true);
    expect(hasText(tree, 'settings.ecommerce.storeName')).toBe(true);
    expect(hasText(tree, 'settings.ecommerce.storeUrl')).toBe(false);
  });

  it('calls updateSettings with the nested platform payload', async () => {
    const updateSettings = jest.fn();
    const tree = await renderUi(<PlatformCredentialFields settings={makeSettings('woocommerce')} updateSettings={updateSettings} />);
    const secretInput = tree.root.findAll(n => n.type === 'TextInput').slice(-1)[0];
    secretInput.props.onChangeText('secret');
    expect(updateSettings).toHaveBeenCalledWith({ woocommerce: { apiKey: '', apiSecret: 'secret', storeUrl: '' } });
  });
});
