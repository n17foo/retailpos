import { useState, useCallback, useEffect } from 'react';
import { receiptConfigService, ReceiptConfig } from '../services/printer/ReceiptConfigService';

interface UseReceiptConfigReturn {
  config: ReceiptConfig;
  isLoading: boolean;
  error: string | null;
  updateHeader: (header: Partial<ReceiptConfig['header']>) => Promise<void>;
  updateFooter: (footer: Partial<ReceiptConfig['footer']>) => Promise<void>;
  updateOptions: (options: Partial<ReceiptConfig['options']>) => Promise<void>;
  setPrinterModel: (model: 'snbc_orient' | 'epson' | 'star' | 'citizen' | 'generic') => Promise<void>;
  reload: () => Promise<void>;
}

export const useReceiptConfig = (): UseReceiptConfigReturn => {
  const [config, setConfig] = useState<ReceiptConfig>(receiptConfigService.getConfig());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await receiptConfigService.initialize();
      setConfig(receiptConfigService.getConfig());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load receipt config');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateHeader = useCallback(async (header: Partial<ReceiptConfig['header']>) => {
    try {
      await receiptConfigService.updateHeader(header);
      setConfig(receiptConfigService.getConfig());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update header');
      throw err;
    }
  }, []);

  const updateFooter = useCallback(async (footer: Partial<ReceiptConfig['footer']>) => {
    try {
      await receiptConfigService.updateFooter(footer);
      setConfig(receiptConfigService.getConfig());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update footer');
      throw err;
    }
  }, []);

  const updateOptions = useCallback(async (options: Partial<ReceiptConfig['options']>) => {
    try {
      await receiptConfigService.updateOptions(options);
      setConfig(receiptConfigService.getConfig());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update options');
      throw err;
    }
  }, []);

  const setPrinterModel = useCallback(async (model: 'snbc_orient' | 'epson' | 'star' | 'citizen' | 'generic') => {
    try {
      await receiptConfigService.setPrinterModel(model);
      setConfig(receiptConfigService.getConfig());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set printer model');
      throw err;
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    config,
    isLoading,
    error,
    updateHeader,
    updateFooter,
    updateOptions,
    setPrinterModel,
    reload,
  };
};

export type { ReceiptConfig };
