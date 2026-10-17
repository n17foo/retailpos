import { EcommerceSettingsStorage } from './EcommerceSettingsStorage';

/**
 * ISO currency code of the store, as configured in settings.
 * Throws when none is configured so money is never moved in an assumed currency.
 */
export const getStoreCurrencyCode = async (): Promise<string> => {
  const settings = await EcommerceSettingsStorage.load<{ offline?: { currency?: string } }>();
  const code = settings?.offline?.currency;
  if (!code) throw new Error('Store currency is not configured');
  return code;
};
