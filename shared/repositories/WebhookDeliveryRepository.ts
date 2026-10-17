import { type SQLiteDatabase } from 'expo-sqlite';
import { db } from '../utils/db';

export type WebhookDeliveryClaim = 'claimed' | 'duplicate' | 'processing';

export interface WebhookDeliveryStore {
  claim(provider: string, deliveryKey: string): Promise<WebhookDeliveryClaim>;
  markCompleted(provider: string, deliveryKey: string, retentionMs: number): Promise<void>;
  markFailed(provider: string, deliveryKey: string, retentionMs: number): Promise<void>;
  purgeExpired(now?: number): Promise<void>;
}

interface WebhookDeliveryRow {
  status: 'processing' | 'completed' | 'failed';
  expires_at: number;
}

const CLAIM_TIMEOUT_MS = 15 * 60_000;

/**
 * Durable webhook delivery/idempotency records.
 *
 * The unique key and the state transition are performed inside a transaction
 * so duplicate deliveries cannot race one another. A completed delivery remains
 * acknowledged; a failed or abandoned delivery can be claimed again.
 */
export class WebhookDeliveryRepository implements WebhookDeliveryStore {
  constructor(private readonly database: SQLiteDatabase = db) {}

  async claim(provider: string, deliveryKey: string): Promise<WebhookDeliveryClaim> {
    const now = Date.now();
    let claim: WebhookDeliveryClaim = 'processing';

    await this.database.withTransactionAsync(async () => {
      const inserted = await this.database.runAsync(
        `INSERT OR IGNORE INTO webhook_deliveries
           (provider, delivery_id, status, first_received_at, last_received_at, attempt_count, expires_at)
         VALUES (?, ?, 'processing', ?, ?, 1, ?)`,
        [provider, deliveryKey, now, now, now + CLAIM_TIMEOUT_MS]
      );

      if (inserted.changes === 1) {
        claim = 'claimed';
        return;
      }

      const existing = await this.database.getFirstAsync<WebhookDeliveryRow>(
        `SELECT status, expires_at
           FROM webhook_deliveries
          WHERE provider = ? AND delivery_id = ?`,
        [provider, deliveryKey]
      );

      if (!existing) {
        return;
      }

      if (existing.status === 'completed') {
        claim = 'duplicate';
        return;
      }

      const reclaimed = await this.database.runAsync(
        `UPDATE webhook_deliveries
            SET status = 'processing',
                last_received_at = ?,
                attempt_count = attempt_count + 1,
                expires_at = ?
          WHERE provider = ?
            AND delivery_id = ?
            AND (status = 'failed' OR expires_at <= ?)`,
        [now, now + CLAIM_TIMEOUT_MS, provider, deliveryKey, now]
      );

      claim = reclaimed.changes === 1 ? 'claimed' : 'processing';
    });

    return claim;
  }

  async markCompleted(provider: string, deliveryKey: string, retentionMs: number): Promise<void> {
    const now = Date.now();
    await this.database.runAsync(
      `UPDATE webhook_deliveries
          SET status = 'completed', last_received_at = ?, completed_at = ?, expires_at = ?
        WHERE provider = ? AND delivery_id = ?`,
      [now, now, now + retentionMs, provider, deliveryKey]
    );
  }

  async markFailed(provider: string, deliveryKey: string, retentionMs: number): Promise<void> {
    const now = Date.now();
    await this.database.runAsync(
      `UPDATE webhook_deliveries
          SET status = 'failed', last_received_at = ?, expires_at = ?
        WHERE provider = ? AND delivery_id = ?`,
      [now, now + retentionMs, provider, deliveryKey]
    );
  }

  async purgeExpired(now: number = Date.now()): Promise<void> {
    await this.database.runAsync('DELETE FROM webhook_deliveries WHERE expires_at <= ?', [now]);
  }
}
