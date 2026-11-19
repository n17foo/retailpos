import type { FiscalTransmissionRow } from '../../repositories/FiscalRecordRepository';

/** Credentials an authority transport may need — loaded per-authority. */
export interface AuthorityCredentials {
  /** AEAT client certificate + key (PEM) — mTLS submission. */
  certificatePem?: string;
  keyPem?: string;
  /** fiskaly SIGN DE credentials. */
  apiKey?: string;
  apiSecret?: string;
  tssId?: string;
  /** Endpoint override (test/staging). */
  endpoint?: string;
}

/**
 * One submission attempt against a fiscal authority. Throw
 * `FiscalDeferralError` when prerequisites (credentials, endpoint) are
 * missing — the row stays 'pending' without burning a retry attempt.
 * Throw anything else to mark the row failed → retry → dead.
 */
export interface FiscalAuthorityTransport {
  readonly authority: string;
  submit(row: FiscalTransmissionRow, credentials: AuthorityCredentials | null): Promise<string | null>;
}

/** Missing prerequisites — retry would be pointless until configured. */
export class FiscalDeferralError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FiscalDeferralError';
  }
}
