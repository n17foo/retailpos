import { resolveStoreUrl, resolveApiKey, buildApiKeyUpdate, buildStoreUrlUpdate, buildNestedUpdate } from './ecommerceSettingsFields';
import type { ECommerceSettings } from '../../platform-clients/hooks/useEcommerceSettings';

const makeSettings = (platform: string, overrides: Partial<ECommerceSettings> = {}): ECommerceSettings => ({
  enabled: true,
  platform,
  apiUrl: 'https://flat.example',
  apiKey: 'flat-key',
  syncInventory: false,
  shopify: { apiKey: 'shop-apikey', accessToken: 'shop-token', storeUrl: 'https://shop.example' },
  woocommerce: { apiKey: 'woo-key', apiSecret: 'woo-secret', storeUrl: 'https://woo.example' },
  magento: { accessToken: 'mag-token', storeUrl: 'https://mag.example', apiVersion: '' },
  bigcommerce: { clientId: 'bc-client', accessToken: 'bc-token', storeHash: 'bc-hash' },
  sylius: { apiToken: 'syl-token', storeUrl: 'https://syl.example', apiVersion: '' },
  wix: { apiKey: 'wix-key', siteId: 'wix-site', accountId: 'wix-acct' },
  prestashop: { apiKey: 'pre-key', storeUrl: 'https://pre.example' },
  commercefull: { apiKey: 'cf-key', apiSecret: 'cf-secret', storeUrl: 'https://cf.example' },
  offline: { storeName: 'My Store' },
  ...overrides,
});

describe('resolveStoreUrl', () => {
  it('reads the nested storeUrl for store-url platforms', () => {
    expect(resolveStoreUrl(makeSettings('shopify'))).toBe('https://shop.example');
    expect(resolveStoreUrl(makeSettings('woocommerce'))).toBe('https://woo.example');
  });

  it('falls back to flat apiUrl for platforms without a nested storeUrl', () => {
    expect(resolveStoreUrl(makeSettings('bigcommerce'))).toBe('https://flat.example');
    expect(resolveStoreUrl(makeSettings('wix'))).toBe('https://flat.example');
  });
});

describe('resolveApiKey', () => {
  it('reads the platform-specific nested credential', () => {
    expect(resolveApiKey(makeSettings('shopify'))).toBe('shop-token');
    expect(resolveApiKey(makeSettings('sylius'))).toBe('syl-token');
  });

  it('falls back to nested apiKey then flat apiKey', () => {
    const settings = makeSettings('shopify');
    settings.shopify.accessToken = '';
    expect(resolveApiKey(settings)).toBe('shop-apikey');
    settings.shopify.apiKey = '';
    expect(resolveApiKey(settings)).toBe('flat-key');
  });
});

describe('buildApiKeyUpdate', () => {
  it('writes the platform-specific field and keeps flat apiKey in sync', () => {
    const update = buildApiKeyUpdate(makeSettings('sylius'), 'new-token');
    expect(update.apiKey).toBe('new-token');
    expect(update.sylius?.apiToken).toBe('new-token');
  });

  it('mirrors apiKey inside the shopify object', () => {
    const update = buildApiKeyUpdate(makeSettings('shopify'), 'new-token');
    expect(update.shopify?.accessToken).toBe('new-token');
    expect(update.shopify?.apiKey).toBe('new-token');
  });

  it('writes flat apiKey for a non-platform key', () => {
    expect(buildApiKeyUpdate(makeSettings('offline'), 'x')).toEqual({ apiKey: 'x' });
  });
});

describe('buildStoreUrlUpdate', () => {
  it('writes nested storeUrl for store-url platforms', () => {
    const update = buildStoreUrlUpdate(makeSettings('prestashop'), 'https://new.example');
    expect(update.prestashop?.storeUrl).toBe('https://new.example');
    expect(update.apiUrl).toBeUndefined();
  });

  it('writes flat apiUrl otherwise', () => {
    expect(buildStoreUrlUpdate(makeSettings('wix'), 'https://new.example')).toEqual({ apiUrl: 'https://new.example' });
  });
});

describe('buildNestedUpdate', () => {
  it('merges the patch into the platform object', () => {
    const update = buildNestedUpdate(makeSettings('wix'), 'wix', { siteId: 'new-site' });
    expect(update.wix).toEqual({ apiKey: 'wix-key', siteId: 'new-site', accountId: 'wix-acct' });
  });
});
