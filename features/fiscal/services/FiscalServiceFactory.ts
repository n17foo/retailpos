import { instoreApiConfig } from '../../multi-register/services/InstoreApiConfig';
import { offlineFiscalService } from './OfflineFiscalService';
import { InstoreApiFiscalService } from './InstoreApiFiscalService';
import type { FiscalService } from './FiscalServiceInterface';

/**
 * Mode selector — same contract as `getOrderRepository()`:
 * `client` mode delegates to the Store API (the store-wide chain),
 * `standalone` allocates locally in SQLite.
 */
export function getFiscalService(): FiscalService {
  if (instoreApiConfig.isClient) {
    return new InstoreApiFiscalService();
  }
  return offlineFiscalService;
}
