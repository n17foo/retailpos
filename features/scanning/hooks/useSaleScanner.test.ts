import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useSaleScanner } from './useSaleScanner';
import { ECommercePlatform } from '../../../shared/utils/platforms';
import type { DisplayProduct } from '../../catalogue/services/product/displayProduct';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../../shared/hooks/useLogger', () => ({
  useLogger: () => mockLogger,
}));

const mockRelease = jest.fn();
const mockConnectForSale = jest.fn(async () => mockRelease);

jest.mock('../../hardware/services/scanner/ScannerServiceFactory', () => ({
  ScannerServiceFactory: {
    getInstance: () => ({
      connectForSale: mockConnectForSale,
    }),
  },
}));

jest.mock('../../../shared/services/search/SearchServiceFactory', () => ({
  SearchServiceFactory: {
    getInstance: () => ({
      getService: () => ({
        isInitialized: () => false,
      }),
    }),
  },
}));

jest.mock('../../catalogue/repositories/ProductVariantRepository', () => ({
  productVariantRepository: {
    findByBarcode: jest.fn().mockResolvedValue(null),
    findBySku: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../../platform-clients/services/config/POSConfigService', () => ({
  posConfig: { values: { saleScanDedupMs: 500 } },
}));

describe('useSaleScanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves scanned barcode from loaded catalogue, adds product, and deduplicates rapid repeat scans', async () => {
    const sampleProduct: DisplayProduct = {
      id: 'p1',
      name: 'Flat White',
      price: 3.8,
      image: null,
      isEcommerceProduct: false,
      sellable: true,
      barcode: '12345678',
    };
    const addProduct = jest.fn().mockResolvedValue(true);

    let latest: ReturnType<typeof useSaleScanner> | null = null;
    function Harness() {
      latest = useSaleScanner({
        products: [sampleProduct],
        catalogPlatform: ECommercePlatform.OFFLINE,
        addProduct,
      });
      return null;
    }

    await act(async () => {
      createRoot().render(React.createElement(Harness));
    });

    expect(mockConnectForSale).toHaveBeenCalledTimes(1);

    await act(async () => {
      await latest!.handleScan('12345678');
      // Immediate duplicate within 500ms dedup window should be ignored
      await latest!.handleScan('12345678');
    });

    expect(addProduct).toHaveBeenCalledTimes(1);
    expect(latest!.notice?.kind).toBe('added');

    await act(async () => {
      await latest!.handleScan('UNKNOWN-CODE');
    });
    expect(latest!.notice?.kind).toBe('not_found');
  });
});
