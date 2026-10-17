/**
 * LoyaltyExpiryJob
 *
 * Expires old loyalty points based on the configured expiry period.
 *
 * Mobile apps are suspended by the OS when backgrounded — there is no cron,
 * and setInterval stops firing. This job therefore uses the AppState pattern:
 *   - start() subscribes to AppState changes
 *   - On every foreground transition, runIfDue() checks a persisted KV timestamp
 *   - If more than `minIntervalMs` has elapsed since the last run, it executes
 *
 * Usage:
 *   loyaltyExpiryJob.start();   // called once at app startup (App.tsx)
 *   loyaltyExpiryJob.stop();    // called on logout / teardown
 *   await loyaltyExpiryJob.run(); // manual trigger from Settings screen
 */

import { AppState, AppStateStatus } from 'react-native';
import { loyaltyService } from './LoyaltyService';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import { notificationService } from '../../../../shared/services/notifications/NotificationService';
import { KeyValueRepository } from '../../../../shared/repositories/KeyValueRepository';

const LAST_RUN_KEY = 'loyalty:lastExpiryRun';
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class LoyaltyExpiryJob {
  private static instance: LoyaltyExpiryJob;
  private logger = LoggerFactory.getInstance().createLogger('LoyaltyExpiryJob');
  private kv = new KeyValueRepository();
  private appStateSubscription: { remove(): void } | null = null;
  private executing = false;
  private started = false;

  private constructor() {}

  static getInstance(): LoyaltyExpiryJob {
    if (!LoyaltyExpiryJob.instance) {
      LoyaltyExpiryJob.instance = new LoyaltyExpiryJob();
    }
    return LoyaltyExpiryJob.instance;
  }

  /**
   * Start listening for app-foreground events.
   * Checks whether the job is due on every foreground transition.
   * Call once at app startup.
   *
   * @param minIntervalMs Minimum time between runs (default: 24 hours)
   */
  start(minIntervalMs: number = DEFAULT_INTERVAL_MS): void {
    if (this.started) return;
    this.started = true;

    this.appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        this.runIfDue(minIntervalMs).catch(err => {
          this.logger.error({ message: 'runIfDue failed on foreground' }, err instanceof Error ? err : new Error(String(err)));
        });
      }
    });

    this.runIfDue(minIntervalMs).catch(err => {
      this.logger.error({ message: 'Initial runIfDue failed' }, err instanceof Error ? err : new Error(String(err)));
    });
  }

  /**
   * Stop listening for foreground events.
   */
  stop(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    this.started = false;
  }

  /**
   * Run only if the minimum interval has elapsed since the last successful run.
   */
  async runIfDue(minIntervalMs: number = DEFAULT_INTERVAL_MS): Promise<void> {
    const raw = await this.kv.getItem(LAST_RUN_KEY);
    const lastRun = raw ? parseInt(raw, 10) : 0;
    if (Date.now() - lastRun < minIntervalMs) return;
    await this.run();
  }

  /**
   * Run unconditionally. Safe to call multiple times — skips if already executing.
   */
  async run(): Promise<{ customersProcessed: number; pointsExpired: number }> {
    if (this.executing) {
      this.logger.warn('Loyalty expiry job already executing, skipping');
      return { customersProcessed: 0, pointsExpired: 0 };
    }

    this.executing = true;
    this.logger.info('Starting loyalty points expiry job');

    try {
      const result = await loyaltyService.expireOldPoints();

      await this.kv.setItem(LAST_RUN_KEY, Date.now().toString());

      if (result.customersProcessed > 0) {
        this.logger.info(`Loyalty expiry completed: ${result.customersProcessed} customers, ${result.pointsExpired} points expired`);
        if (result.pointsExpired > 100) {
          notificationService.notify(
            'Loyalty Points Expired',
            `${result.pointsExpired} points expired for ${result.customersProcessed} customers`,
            'info'
          );
        }
      } else {
        this.logger.info('Loyalty expiry completed: no points to expire');
      }

      return result;
    } catch (err) {
      this.logger.error({ message: 'Loyalty expiry job failed' }, err instanceof Error ? err : new Error(String(err)));
      notificationService.notify('Loyalty Expiry Failed', 'Failed to expire loyalty points. Check logs for details.', 'error');
      return { customersProcessed: 0, pointsExpired: 0 };
    } finally {
      this.executing = false;
    }
  }

  getStatus(): { executing: boolean; started: boolean } {
    return { executing: this.executing, started: this.started };
  }
}

export const loyaltyExpiryJob = LoyaltyExpiryJob.getInstance();
