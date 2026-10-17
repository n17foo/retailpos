import { taxProfileService } from './TaxProfileService';
import { posConfig } from '../config/POSConfigService';

/**
 * Tax rate for the OFFLINE catalogue only.
 *
 * Online platforms never use this: they own tax and the platform calculates it for the whole basket at checkout
 * (see PlatformOrderServiceInterface.createDraftOrder / quoteTax). Local tax setup applies to offline sales only.
 *
 * Order: the product's merchant-defined tax profile, else the merchant-defined default profile, else the store tax
 * rate configured in POS settings. Returns undefined when nothing is configured: no tax is invented.
 */
export const resolveOfflineTaxRate = async (taxProfileId?: string): Promise<number | undefined> => {
  if (taxProfileId) {
    const profile = await taxProfileService.getProfileById(taxProfileId);
    if (profile) return profile.rate;
  }

  const defaultProfile = await taxProfileService.getDefaultProfile();
  if (defaultProfile) return defaultProfile.rate;

  const storeRate = posConfig.values.taxRate;
  return typeof storeRate === 'number' && Number.isFinite(storeRate) && storeRate >= 0 ? storeRate : undefined;
};
