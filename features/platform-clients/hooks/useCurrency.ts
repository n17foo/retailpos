import { useMemo } from 'react';
import { useEcommerceSettings } from './useEcommerceSettings';
import { getCurrencyInfo } from '../../../shared/utils/currency';

/**
 * Hook that returns currency information for the currently configured currency.
 * Returns an object with symbol, code, and full currency info.
 * Falls back to GBP if no currency is configured.
 */
export const useCurrency = () => {
  const { ecommerceSettings } = useEcommerceSettings();

  const currencyData = useMemo(() => {
    const code = ecommerceSettings?.offline?.currency || 'GBP';
    const info = getCurrencyInfo(code);
    const symbol = info?.symbol || '£';

    return {
      code,
      symbol,
      info,
    };
  }, [ecommerceSettings?.offline?.currency]);

  return currencyData;
};
