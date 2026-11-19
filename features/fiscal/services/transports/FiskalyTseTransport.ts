import { FiscalAuthorityTransport, AuthorityCredentials, FiscalDeferralError } from './FiscalAuthorityTransport';
import type { FiscalTransmissionRow } from '../../repositories/FiscalRecordRepository';

const FISKALY_BASE = 'https://sign.api.fiskaly.com/api/v2';

interface FiskalyToken {
  access_token: string;
  access_token_expires_at: number;
}

/**
 * fiskaly SIGN DE — certified cloud-TSE REST client. Each queued record
 * becomes a TSS transaction (`RECEIPT`); the returned signature object
 * (value, counter, serial, process_data) is stored as the transmission
 * response — the receipt QR is built from it.
 *
 * Swappable boundary: any certified-TSE vendor client implementing this
 * submit() can replace it (fiskaltrust, Swissbit).
 */
export class FiskalyTseTransport implements FiscalAuthorityTransport {
  readonly authority = 'tse';
  private token: { value: string; expiresAt: number } | null = null;

  async submit(row: FiscalTransmissionRow, credentials: AuthorityCredentials | null): Promise<string | null> {
    if (!credentials?.apiKey || !credentials.apiSecret || !credentials.tssId) {
      throw new FiscalDeferralError('fiskaly credentials (apiKey/apiSecret/tssId) not configured');
    }
    const payload = JSON.parse(row.request ?? '{}') as { order?: { total?: number }; registerId?: string };
    const total = payload.order?.total ?? 0;
    const base = credentials.endpoint ?? FISKALY_BASE;

    const token = await this.authenticate(base, credentials);
    const txId = row.record_id;
    const response = await fetch(`${base}/tss/${credentials.tssId}/tx/${txId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        state: 'ACTIVE',
        client_id: payload.registerId ?? 'register-1',
        tx_data: {
          receipt_type: 'RECEIPT',
          amounts_per_vat_rate: [{ vat_rate: 'NORMAL', amount: total.toFixed(2) }],
          payment_type: 'CASH',
          amounts_per_payment_type: [{ payment_type: 'CASH', amount: total.toFixed(2) }],
        },
      }),
    });
    if (!response.ok) {
      throw new Error(`fiskaly TSE signing failed: HTTP ${response.status}`);
    }
    return response.text();
  }

  private async authenticate(base: string, credentials: AuthorityCredentials): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() / 1000 + 60) {
      return this.token.value;
    }
    const response = await fetch(`${base}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: credentials.apiKey, api_secret: credentials.apiSecret }),
    });
    if (!response.ok) {
      throw new Error(`fiskaly auth failed: HTTP ${response.status}`);
    }
    const data = (await response.json()) as FiskalyToken;
    this.token = { value: data.access_token, expiresAt: data.access_token_expires_at };
    return data.access_token;
  }
}
