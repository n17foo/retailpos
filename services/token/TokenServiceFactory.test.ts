const mockGetSecret = jest.fn();
const mockStoreSecret = jest.fn();
const mockDeleteSecret = jest.fn();
const mockGetItem = jest.fn();
const mockGetObject = jest.fn();
const mockSetItem = jest.fn();
const mockRemoveItem = jest.fn();

const mockIsAvailable = jest.fn();
const mockAllowsPlaintextFallback = jest.fn();

const mockFetchAccessToken = jest.fn();
const mockFetchAdminToken = jest.fn();

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

jest.mock('../config/PlatformCredentialsResolver', () => ({
  getPlatformCredentials: jest.fn(),
}));

jest.mock('../clients/commercefull/CommercefullApiClient', () => ({
  CommercefullApiClient: { getInstance: () => ({ fetchAccessToken: mockFetchAccessToken }) },
}));

jest.mock('../clients/magento/MagentoApiClient', () => ({
  MagentoApiClient: { getInstance: () => ({ fetchAdminToken: mockFetchAdminToken }) },
}));

import { TokenServiceFactory } from './TokenServiceFactory';
import { getPlatformCredentials } from '../config/PlatformCredentialsResolver';
import { TokenType } from './TokenServiceInterface';
import { ECommercePlatform } from '../../utils/platforms';

const mockCredentials = getPlatformCredentials as jest.Mock;

describe('TokenServiceFactory', () => {
  const factory = TokenServiceFactory.getInstance();
  const service = factory.getService();

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCredentials.mockResolvedValue(null);
    mockGetSecret.mockResolvedValue(null);
    mockGetItem.mockResolvedValue(null);
    mockGetObject.mockResolvedValue(null);
    mockIsAvailable.mockResolvedValue(true);
    mockAllowsPlaintextFallback.mockReturnValue(false);
    mockStoreSecret.mockResolvedValue(true);
    mockDeleteSecret.mockResolvedValue(true);
    for (const platform of Object.values(ECommercePlatform)) {
      await service.clearPlatformTokens(platform);
    }
  });

  it('returns the stored Shopify access token rather than a fabricated one', async () => {
    mockCredentials.mockResolvedValue({ accessToken: 'shpat_real', storeUrl: 's.myshopify.com' });

    await factory.initializePlatformProvider(ECommercePlatform.SHOPIFY);
    const token = await service.getToken(ECommercePlatform.SHOPIFY, TokenType.ACCESS);

    expect(token).toBe('shpat_real');
    expect(mockStoreSecret).toHaveBeenCalledWith('token:shopify:access_token', expect.stringContaining('shpat_real'));
  });

  it('exchanges Commercefull apiKey/apiSecret for a bearer token', async () => {
    mockCredentials.mockResolvedValue({ apiKey: 'pos@store.com', apiSecret: 'pw', storeUrl: 'pos.example.com' });
    mockFetchAccessToken.mockResolvedValue({ token: 'cf-jwt', expiresIn: 1800 });

    await factory.initializePlatformProvider(ECommercePlatform.COMMERCEFULL);
    const token = await service.getToken(ECommercePlatform.COMMERCEFULL, TokenType.ACCESS);

    expect(mockFetchAccessToken).toHaveBeenCalledWith('pos.example.com', 'pos@store.com', 'pw');
    expect(token).toBe('cf-jwt');
  });

  it('treats a lone Commercefull apiKey as a static token', async () => {
    mockCredentials.mockResolvedValue({ apiKey: 'static-token', storeUrl: 'pos.example.com' });

    await factory.initializePlatformProvider(ECommercePlatform.COMMERCEFULL);
    await service.clearPlatformTokens(ECommercePlatform.COMMERCEFULL);
    const token = await service.getToken(ECommercePlatform.COMMERCEFULL, TokenType.ACCESS);

    expect(mockFetchAccessToken).not.toHaveBeenCalled();
    expect(token).toBe('static-token');
  });

  it('returns the configured Magento access token without an exchange', async () => {
    mockCredentials.mockResolvedValue({ accessToken: 'mage-integration-token', storeUrl: 'm.example.com' });

    await factory.initializePlatformProvider(ECommercePlatform.MAGENTO);
    const token = await service.getToken(ECommercePlatform.MAGENTO, TokenType.ACCESS);

    expect(mockFetchAdminToken).not.toHaveBeenCalled();
    expect(token).toBe('mage-integration-token');
  });

  it('exchanges Magento username/password for an admin token when no access token exists', async () => {
    mockCredentials.mockResolvedValue({ username: 'admin', password: 'pw', apiUrl: 'm.example.com' });
    mockFetchAdminToken.mockResolvedValue('mage-admin-token');

    await factory.initializePlatformProvider(ECommercePlatform.MAGENTO);
    const token = await service.getToken(ECommercePlatform.MAGENTO, TokenType.ACCESS);

    expect(mockFetchAdminToken).toHaveBeenCalledWith('m.example.com', 'admin', 'pw');
    expect(token).toBe('mage-admin-token');
  });

  it('serves PrestaShop and Squarespace API keys as tokens', async () => {
    mockCredentials.mockImplementation(async (platform: ECommercePlatform) =>
      platform === ECommercePlatform.PRESTASHOP ? { apiKey: 'ps-key' } : { apiKey: 'ss-key' }
    );

    await factory.initializePlatformProvider(ECommercePlatform.PRESTASHOP);
    await factory.initializePlatformProvider(ECommercePlatform.SQUARESPACE);

    await expect(service.getToken(ECommercePlatform.PRESTASHOP, TokenType.ACCESS)).resolves.toBe('ps-key');
    await expect(service.getToken(ECommercePlatform.SQUARESPACE, TokenType.ACCESS)).resolves.toBe('ss-key');
  });

  it('caches acquired tokens so repeat reads skip the provider', async () => {
    mockCredentials.mockResolvedValue({ accessToken: 'shpat_real' });

    await factory.initializePlatformProvider(ECommercePlatform.SHOPIFY);
    await service.getToken(ECommercePlatform.SHOPIFY, TokenType.ACCESS);
    await service.getToken(ECommercePlatform.SHOPIFY, TokenType.ACCESS);

    expect(mockCredentials).toHaveBeenCalledTimes(1);
  });

  it('returns null when no credentials are configured', async () => {
    mockCredentials.mockResolvedValue(null);

    await factory.initializePlatformProvider(ECommercePlatform.WIX);
    const token = await service.getToken(ECommercePlatform.WIX, TokenType.ACCESS);

    expect(token).toBeNull();
  });

  it('registers no provider for the offline platform', async () => {
    const initialized = await factory.initializePlatformProvider(ECommercePlatform.OFFLINE);

    expect(initialized).toBe(false);
  });
});
