import { KeyValueRepository } from '../../repositories/KeyValueRepository';
import { KdsOrder } from './KdsServiceInterface';

const STORAGE_KEY = 'kds:pendingTickets';

export interface PendingKdsTicket {
  ticket: KdsOrder;
  queuedAt: number;
}

/**
 * KV-backed store for KDS order tickets that failed to reach the display.
 * Drained by RetryingKdsService on the next successful send or reconnect.
 */
export class PendingKdsTicketStore {
  private kv = new KeyValueRepository();

  private async readAll(): Promise<PendingKdsTicket[]> {
    const raw = await this.kv.getItem(STORAGE_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as PendingKdsTicket[];
    } catch {
      return [];
    }
  }

  private async writeAll(entries: PendingKdsTicket[]): Promise<void> {
    await this.kv.setItem(STORAGE_KEY, entries);
  }

  /**
   * Queue a failed ticket. Entries coalesce per orderId — a re-dispatched
   * ticket for the same order replaces the stale queued copy.
   */
  async add(ticket: KdsOrder): Promise<void> {
    const all = (await this.readAll()).filter(e => e.ticket.orderId !== ticket.orderId);
    all.push({ ticket, queuedAt: Date.now() });
    await this.writeAll(all);
  }

  async list(): Promise<PendingKdsTicket[]> {
    return this.readAll();
  }

  async remove(entries: PendingKdsTicket[]): Promise<void> {
    const drop = new Set(entries.map(e => `${e.ticket.orderId}::${e.queuedAt}`));
    const remaining = (await this.readAll()).filter(e => !drop.has(`${e.ticket.orderId}::${e.queuedAt}`));
    await this.writeAll(remaining);
  }

  async count(): Promise<number> {
    return (await this.readAll()).length;
  }
}

export const pendingKdsTicketStore = new PendingKdsTicketStore();
