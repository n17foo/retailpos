const mockGetSecret = jest.fn();
const mockStoreSecret = jest.fn();
const mockDeleteSecret = jest.fn();
const mockGetItem = jest.fn();
const mockGetObject = jest.fn();
const mockSetItem = jest.fn();
const mockRemoveItem = jest.fn();

const mockIsAvailable = jest.fn();
const mockAllowsPlaintextFallback = jest.fn();

jest.mock('../secrets/SecretsService', () => ({
  secretsServiceFactory: {
    getService: () => ({
      getSecret: mockGetSecret,
      storeSecret: mockStoreSecret,
      deleteSecret: mockDeleteSecret,
      isAvailable: mockIsAvailable,
      allowsPlaintextFallback: mockAllowsPlaintextFallback,
    }),
  },
}));

jest.mock('../../repositories/KeyValueRepository', () => ({
  keyValueRepository: { getObject: mockGetObject, getItem: mockGetItem, setItem: mockSetItem, removeItem: mockRemoveItem },
}));

import { getPlatformCredentials } from './PlatformCredentialsResolver';
import { ECommercePlatform } from '../../utils/platforms';

const settingsJson = (settings: unknown) => JSON.stringify(settings);

describe('PlatformCredentialsResolver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSecret.mockImplementation(async (key: string) =>
      key === 'config:ecommerceSettings' ? settingsJson({ platform: 'shopify', shopify: {} }) : null
    );
    mockGetItem.mockResolvedValue(null);
    mockGetObject.mockResolvedValue(null);
    mockIsAvailable.mockResolvedValue(true);
    mockAllowsPlaintextFallback.mockReturnValue(false);
  });

  it('resolves Shopify credentials from stored settings', async () => {
    mockGetSecret.mockImplementation(async (key: string) =>
      key === 'config:ecommerceSettings'
        ? settingsJson({
            platform: 'shopify',
            apiKey: 'fallback-key',
            shopify: { apiKey: 'key', accessToken: 'shpat_abc', storeUrl: 'store.myshopify.com' },
          })
        : null
    );

    const credentials = await getPlatformCredentials(ECommercePlatform.SHOPIFY);

    expect(credentials).toMatchObject({
      storeUrl: 'store.myshopify.com',
      apiUrl: 'store.myshopify.com',
      apiKey: 'key',
      accessToken: 'shpat_abc',
    });
  });

  it('resolves Commercefull credentials including the api secret', async () => {
    mockGetSecret.mockImplementation(async (key: string) =>
      key === 'config:ecommerceSettings'
        ? settingsJson({
            platform: 'commercefull',
            commercefull: { apiKey: 'pos@store.com', apiSecret: 'pw', storeUrl: 'pos.example.com' },
          })
        : null
    );

    const credentials = await getPlatformCredentials(ECommercePlatform.COMMERCEFULL);

    expect(credentials).toMatchObject({
      storeUrl: 'pos.example.com',
      apiKey: 'pos@store.com',
      apiSecret: 'pw',
    });
  });

  it('lets legacy <platform>_api_credentials secrets override stored settings', async () => {
    mockGetSecret.mockImplementation(async (key: string) => {
      if (key === 'config:ecommerceSettings') {
        return settingsJson({ platform: 'shopify', shopify: { accessToken: 'settings-token', storeUrl: 's.myshopify.com' } });
      }
      if (key === 'shopify_api_credentials') {
        return JSON.stringify({ accessToken: 'provisioned-token', username: 'provisioner' });
      }
      return null;
    });

    const credentials = await getPlatformCredentials(ECommercePlatform.SHOPIFY);

    expect(credentials?.accessToken).toBe('provisioned-token');
    expect(credentials?.username).toBe('provisioner');
    expect(credentials?.storeUrl).toBe('s.myshopify.com');
  });

  it('returns null when no settings and no legacy secret exist', async () => {
    mockGetSecret.mockResolvedValue(null);

    await expect(getPlatformCredentials(ECommercePlatform.SHOPIFY)).resolves.toBeNull();
  });

  it('returns null for the offline platform', async () => {
    await expect(getPlatformCredentials(ECommercePlatform.OFFLINE)).resolves.toBeNull();
  });
});
