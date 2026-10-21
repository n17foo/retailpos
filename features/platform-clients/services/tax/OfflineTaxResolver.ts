import { taxProfileService } from './TaxProfileService';
import { posConfig } from '../config/POSConfigService';
import { instoreApiConfig } from '../../../multi-register/services/InstoreApiConfig';
import { instoreApiClient } from '../clients/instoreapi/InstoreApiClient';
import { serverDataCache } from '../../../multi-register/services/offline/ServerDataCache';
import { isStoreApiUnavailable } from '../../../multi-register/services/offline/isStoreApiUnavailable';
import type { TaxProfileRow } from '../../repositories/TaxProfileRepository';

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
  if (instoreApiConfig.isClient) {
    // Multi-register: tax profiles are shared on the Store API so every
    // register charges the same rate. LAN outage → last-known cached profiles.
    let profiles: TaxProfileRow[];
    try {
      profiles = await instoreApiClient.getTaxProfiles();
      await serverDataCache.mergeTaxProfiles(profiles);
    } catch (error) {
      if (!isStoreApiUnavailable(error)) throw error;
      profiles = (await serverDataCache.getTaxProfiles<TaxProfileRow>()) ?? [];
    }
    if (taxProfileId) {
      const profile = profiles.find(p => p.id === taxProfileId && p.is_active);
      if (profile) return profile.rate;
    }
    const defaultProfile = profiles.find(p => p.is_default && p.is_active);
    if (defaultProfile) return defaultProfile.rate;
  } else {
    if (taxProfileId) {
      const profile = await taxProfileService.getProfileById(taxProfileId);
      if (profile) return profile.rate;
    }

    const defaultProfile = await taxProfileService.getDefaultProfile();
    if (defaultProfile) return defaultProfile.rate;
  }

  const storeRate = posConfig.values.taxRate;
  return typeof storeRate === 'number' && Number.isFinite(storeRate) && storeRate >= 0 ? storeRate : undefined;
};
