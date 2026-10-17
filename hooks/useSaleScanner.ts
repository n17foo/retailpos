/**
 * useSaleScanner — barcode scanning for the sale screen
 * (docs/specs/system/sales-screen-fast-path-ux.md §4.5).
 *
 *  - One shared, ref-counted HID connection for the lifetime of the sale screen
 *    (`ScannerServiceFactory.connectForSale`) — hardware scans land even while a
 *    sheet or checkout modal is open.
 *  - Per-code de-duplication (`sale.scanDedupMs`, default 700 ms) absorbs scanner
 *    double-reads; the same code scanned again after the window adds another unit.
 *  - Resolution order: loaded catalogue → local variant DB → platform barcode
 *    search. A scan always resolves the exact variant, never just the product.
 *  - Results surface as inline notices, never blocking dialogs.
 *  - The camera scanner runs continuously — no post-scan lockout.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { type BarcodeScanningResult } from 'expo-camera';
import { ScannerServiceFactory } from '../services/scanner/ScannerServiceFactory';
import { SearchServiceFactory } from '../services/search/SearchServiceFactory';
import { productVariantRepository } from '../repositories/ProductVariantRepository';
import { posConfig } from '../services/config/POSConfigService';
import { resolveDisplayProduct } from '../services/product/resolveProduct';
import type { DisplayProduct } from '../services/product/displayProduct';
import { ECommercePlatform } from '../utils/platforms';
import { useLogger } from './useLogger';

export type ScanNoticeKind = 'added' | 'not_found' | 'out_of_stock';

export interface ScanNotice {
  kind: ScanNoticeKind;
  code: string;
  name?: string;
  at: number;
}

/** How long a scan notice stays visible */
const NOTICE_MS = 2500;

const DEFAULT_DEDUP_MS = 700;

interface UseSaleScannerProps {
  /** Currently loaded catalogue page — the fastest resolution path */
  products: DisplayProduct[];
  catalogPlatform: ECommercePlatform | null;
  /** Adds a resolved product variant to the basket; resolves false when not sellable */
  addProduct: (product: DisplayProduct, variantId?: string) => Promise<boolean>;
}

export const useSaleScanner = ({ products, catalogPlatform, addProduct }: UseSaleScannerProps) => {
  const logger = useLogger('useSaleScanner');
  const [notice, setNotice] = useState<ScanNotice | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const dedupMs = posConfig.values.saleScanDedupMs ?? DEFAULT_DEDUP_MS;
  const lastReadRef = useRef<Map<string, number>>(new Map());
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest values for the long-lived scan callback
  const productsRef = useRef(products);
  productsRef.current = products;
  const platformRef = useRef(catalogPlatform);
  platformRef.current = catalogPlatform;
  const addRef = useRef(addProduct);
  addRef.current = addProduct;

  const showNotice = useCallback((n: Omit<ScanNotice, 'at'>) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice({ ...n, at: Date.now() });
    noticeTimerRef.current = setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  /** True when the same code was read inside the de-dup window (a scanner double-read) */
  const isDuplicateRead = useCallback(
    (code: string): boolean => {
      const now = Date.now();
      const last = lastReadRef.current.get(code);
      if (last !== undefined && now - last < dedupMs) return true;
      lastReadRef.current.set(code, now);
      // Keep the map bounded on long shifts
      if (lastReadRef.current.size > 200) {
        for (const [k, at] of lastReadRef.current) {
          if (now - at > dedupMs * 10) lastReadRef.current.delete(k);
        }
      }
      return false;
    },
    [dedupMs]
  );

  /**
   * Resolve a scanned code to { product, variantId }.
   * Order: loaded catalogue → local variant DB → platform barcode search.
   */
  const resolveCode = useCallback(
    async (code: string): Promise<{ product: DisplayProduct; variantId?: string } | null> => {
      // 1. Loaded catalogue (product barcode/SKU or any variant's) — instant
      const loaded = productsRef.current.find(
        p => p.id === code || p.barcode === code || p.sku === code || p.variants?.some(v => v.barcode === code || v.sku === code)
      );
      if (loaded) {
        const variant = loaded.variants?.find(v => v.barcode === code || v.sku === code);
        return { product: loaded, variantId: variant?.id };
      }

      // 2. Local variant DB — non-default variants not on the loaded page
      try {
        const row = (await productVariantRepository.findByBarcode(code)) || (await productVariantRepository.findBySku(code));
        if (row) {
          const platform = platformRef.current;
          const product = platform ? await resolveDisplayProduct(platform, row.product_id) : undefined;
          if (product) {
            const variant = product.variants?.find(v => v.id === row.id || v.barcode === code || v.sku === code);
            return { product, variantId: variant?.id ?? row.id };
          }
        }
      } catch (error) {
        logger.error({ message: 'Variant scan lookup failed' }, error instanceof Error ? error : new Error(String(error)));
      }

      // 3. Platform barcode endpoint — catalogue hit not stored locally
      try {
        const platform = platformRef.current;
        const searchService = SearchServiceFactory.getInstance().getService();
        if (platform && searchService.isInitialized()) {
          const result = await searchService.searchByBarcode(code);
          const hit = result.ecommerceResults[0] ?? result.localResults[0];
          if (hit) {
            const product = await resolveDisplayProduct(platform, hit.id);
            if (product) {
              const variant = product.variants?.find(
                v => v.barcode === code || v.sku === code || v.barcode === hit.barcode || v.sku === hit.sku
              );
              return { product, variantId: variant?.id };
            }
          }
        }
      } catch (error) {
        logger.error({ message: 'Barcode search failed' }, error instanceof Error ? error : new Error(String(error)));
      }

      return null;
    },
    [logger]
  );

  /** External-scanner entry point — every distinct scan is processed, never locked out */
  const handleScan = useCallback(
    async (code: string) => {
      if (!code || isDuplicateRead(code)) return;
      const resolved = await resolveCode(code);
      if (!resolved) {
        showNotice({ kind: 'not_found', code });
        return;
      }
      const added = await addRef.current(resolved.product, resolved.variantId);
      showNotice(
        added ? { kind: 'added', code, name: resolved.product.name } : { kind: 'out_of_stock', code, name: resolved.product.name }
      );
    },
    [isDuplicateRead, resolveCode, showNotice]
  );

  const handleScanRef = useRef(handleScan);
  handleScanRef.current = handleScan;

  /** Camera entry point — continuous scanning, no post-scan lockout */
  const handleBarCodeScanned = useCallback(({ data }: BarcodeScanningResult) => {
    void handleScanRef.current(data);
  }, []);

  // Shared ref-counted HID connection for the life of the sale screen
  useEffect(() => {
    let release: (() => void) | undefined;
    let cancelled = false;
    ScannerServiceFactory.getInstance()
      .connectForSale(code => void handleScanRef.current(code))
      .then(r => {
        if (cancelled) r();
        else release = r;
      })
      .catch(error => {
        logger.error({ message: 'Failed to connect sale scanner' }, error instanceof Error ? error : new Error(String(error)));
      });
    return () => {
      cancelled = true;
      release?.();
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, [logger]);

  const openCamera = useCallback(() => setIsCameraOpen(true), []);
  const closeCamera = useCallback(() => setIsCameraOpen(false), []);

  return {
    notice,
    dismissNotice: useCallback(() => setNotice(null), []),
    isCameraOpen,
    openCamera,
    closeCamera,
    handleBarCodeScanned,
    /** Simulated scan entry point (mock scanners, tests) */
    handleScan,
  };
};
