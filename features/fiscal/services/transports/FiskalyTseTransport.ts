import { FiscalAuthorityTransport, AuthorityCredentials, FiscalDeferralError } from './FiscalAuthorityTransport';
import type { FiscalTransmissionRow } from '../../repositories/FiscalRecordRepository';

const FISKALY_BASE = 'https://sign.api.fiskaly.com/api/v2';

interface FiskalyToken {
  access_token: string;
  access_token_expires_at: number;
}

interface FiskalyTransaction {
  state?: string;
  signature?: { value?: string };
}

/**
 * fiskaly SIGN DE — certified cloud-TSE REST client. Each queued record
 * becomes a TSS transaction (`RECEIPT`); the returned signature object
 * (value, counter, serial, process_data) is stored as the transmission
 * response — the receipt QR is built from it.
 *
 * Transaction lifecycle (F05): a transaction only signs when it reaches
 * `FINISHED`. We therefore (1) PUT the ACTIVE transaction with the receipt
 * data, then (2) PUT the same transaction `FINISHED` (tx_revision bumped)
 * and require a FINISHED state + signature in the response. On retry the
 * create/finish PUT may fail because a previous attempt already advanced
 * the transaction — a GET probe then recovers the completed signature.
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
    const payload = JSON.parse(row.request ?? '{}') as {
      order?: { total?: number; paymentMethod?: string | null };
      registerId?: string;
    };
    const total = payload.order?.total ?? 0;
    const base = credentials.endpoint ?? FISKALY_BASE;
    const clientId = payload.registerId ?? 'register-1';
    const paymentType = payload.order?.paymentMethod === 'cash' ? 'CASH' : 'NON_CASH';

    const token = await this.authenticate(base, credentials);
    const txId = row.record_id;

    // Phase 1 — open the signing transaction with the receipt data.
    // A retry may find it already exists; only a transport-level (5xx)
    // failure aborts before we attempt the finish/probe path.
    const created = await fetch(`${base}/tss/${credentials.tssId}/tx/${txId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        state: 'ACTIVE',
        client_id: clientId,
        tx_data: {
          receipt_type: 'RECEIPT',
          amounts_per_vat_rate: [{ vat_rate: 'NORMAL', amount: total.toFixed(2) }],
          payment_type: paymentType,
          amounts_per_payment_type: [{ payment_type: paymentType, amount: total.toFixed(2) }],
        },
      }),
    });
    if (!created.ok && created.status >= 500) {
      throw new Error(`fiskaly TSE signing failed: HTTP ${created.status}`);
    }

    // Phase 2 — complete the transaction. Only a FINISHED response with a
    // signature proves the TSE actually signed (F05).
    const finished = await fetch(`${base}/tss/${credentials.tssId}/tx/${txId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ state: 'FINISHED', client_id: clientId, tx_revision: 2 }),
    });
    if (finished.ok) {
      const data = (await finished.json()) as FiskalyTransaction;
      if (data.state === 'FINISHED' && data.signature?.value) {
        return JSON.stringify(data);
      }
      throw new Error(`fiskaly transaction ${txId} did not reach FINISHED state (got '${data.state ?? 'unknown'}')`);
    }

    // Finish failed — a previous attempt may already have completed the
    // transaction; probe its state before burning a retry (idempotent).
    const probe = await fetch(`${base}/tss/${credentials.tssId}/tx/${txId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (probe.ok) {
      const data = (await probe.json()) as FiskalyTransaction;
      if (data.state === 'FINISHED' && data.signature?.value) {
        return JSON.stringify(data);
      }
    }
    throw new Error(`fiskaly TSE finish failed: HTTP ${finished.status}`);
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
