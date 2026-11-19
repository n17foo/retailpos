import { ProtectedValueStore } from '../../platform-clients/services/config/ProtectedValueStore';
import type { AuthorityCredentials } from './transports/FiscalAuthorityTransport';

/**
 * Per-authority credential blobs (JSON) in the protected store — never
 * in POSConfig or plaintext settings. In multi-register deployments the
 * Store API holds the real credentials (server-side env); the register
 * path exists for standalone registers that must submit themselves.
 */
const stores: Record<string, ProtectedValueStore> = {
  aeat: new ProtectedValueStore({
    kvKey: 'fiscal.credentials.aeat',
    secretKey: 'fiscal-authority-aeat',
    storageModeKey: 'fiscal.credentials.aeat.mode',
    logContext: 'fiscal-aeat',
  }),
  tse: new ProtectedValueStore({
    kvKey: 'fiscal.credentials.tse',
    secretKey: 'fiscal-authority-tse',
    storageModeKey: 'fiscal.credentials.tse.mode',
    logContext: 'fiscal-tse',
  }),
};

export async function getFiscalAuthorityCredentials(authority: string): Promise<AuthorityCredentials | null> {
  const store = stores[authority];
  if (!store) {
    return null;
  }
  const raw = await store.load();
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthorityCredentials;
  } catch {
    return null;
  }
}

export async function setFiscalAuthorityCredentials(authority: string, credentials: AuthorityCredentials): Promise<void> {
  const store = stores[authority];
  if (!store) {
    throw new Error(`No credential slot for authority '${authority}'`);
  }
  await store.save(JSON.stringify(credentials));
}
