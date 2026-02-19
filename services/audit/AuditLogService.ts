import { keyValueRepository } from '../../repositories/KeyValueRepository';
import { LoggerFactory } from '../logger/loggerFactory';

export type AuditAction =
  | 'order:created'
  | 'order:paid'
  | 'order:synced'
  | 'order:cancelled'
  | 'order:discarded'
  | 'refund:processed'
  | 'return:created'
  | 'return:completed'
  | 'product:created'
  | 'product:updated'
  | 'product:deleted'
  | 'inventory:adjusted'
  | 'user:created'
  | 'user:updated'
  | 'user:deleted'
  | 'auth:login'
  | 'auth:logout'
  | 'auth:failed'
  | 'settings:changed'
  | 'shift:opened'
  | 'shift:closed'
  | 'drawer:opened'
  | 'sync:started'
  | 'sync:completed'
  | 'sync:failed';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  userId?: string;
  userName?: string;
  registerId?: string;
  details?: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

const KV_KEY = 'audit.log';
const MAX_ENTRIES = 2000;

/**
 * Lightweight audit log stored in key-value store as a JSON array.
 * For a production system this would be a dedicated table, but for
 * the current scope this keeps things simple and avoids another migration.
 */
export class AuditLogService {
  private static instance: AuditLogService;
  private logger = LoggerFactory.getInstance().createLogger('AuditLogService');
  private entries: AuditEntry[] = [];
  private loaded = false;

  private constructor() {}

  static getInstance(): AuditLogService {
    if (!AuditLogService.instance) {
      AuditLogService.instance = new AuditLogService();
    }
    return AuditLogService.instance;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await keyValueRepository.getItem(KV_KEY);
      if (raw) {
        this.entries = JSON.parse(raw);
      }
    } catch (error) {
      this.logger.error({ message: 'Failed to load audit log' }, error instanceof Error ? error : new Error(String(error)));
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    try {
      await keyValueRepository.setItem(KV_KEY, JSON.stringify(this.entries));
    } catch (error) {
      this.logger.error({ message: 'Failed to persist audit log' }, error instanceof Error ? error : new Error(String(error)));
    }
  }

  /** Record an audit event */
  async log(
    action: AuditAction,
    options?: {
      userId?: string;
      userName?: string;
      registerId?: string;
      details?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    await this.ensureLoaded();

    const entry: AuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      action,
      userId: options?.userId,
      userName: options?.userName,
      registerId: options?.registerId,
      details: options?.details,
      metadata: options?.metadata,
      timestamp: Date.now(),
    };

    this.entries.unshift(entry);

    // Cap the list
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(0, MAX_ENTRIES);
    }

    await this.persist();
  }

  /** Get all entries (newest first) */
  async getAll(): Promise<AuditEntry[]> {
    await this.ensureLoaded();
    return [...this.entries];
  }

  /** Get entries filtered by action type */
  async getByAction(action: AuditAction): Promise<AuditEntry[]> {
    await this.ensureLoaded();
    return this.entries.filter(e => e.action === action);
  }

  /** Get entries for a specific user */
  async getByUser(userId: string): Promise<AuditEntry[]> {
    await this.ensureLoaded();
    return this.entries.filter(e => e.userId === userId);
  }

  /** Get entries within a date range */
  async getByDateRange(from: number, to: number): Promise<AuditEntry[]> {
    await this.ensureLoaded();
    return this.entries.filter(e => e.timestamp >= from && e.timestamp < to);
  }

  /** Clear all entries */
  async clear(): Promise<void> {
    this.entries = [];
    await this.persist();
  }

  /** Export as CSV string */
  async exportCsv(): Promise<string> {
    await this.ensureLoaded();
    const header = 'ID,Action,User ID,User Name,Register ID,Details,Timestamp\n';
    const rows = this.entries.map(e => {
      const ts = new Date(e.timestamp).toISOString();
      return [e.id, e.action, e.userId || '', e.userName || '', e.registerId || '', (e.details || '').replace(/,/g, ';'), ts].join(',');
    });
    return header + rows.join('\n');
  }
}

export const auditLogService = AuditLogService.getInstance();
