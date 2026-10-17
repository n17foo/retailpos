import {
  CustomerDisplayServiceInterface,
  CustomerDisplayState,
  DisplayConnectionConfig,
  DisplayDriverType,
} from './CustomerDisplayServiceInterface';

/**
 * No-op display service — used when no customer display is configured.
 */
export class NoOpDisplayService implements CustomerDisplayServiceInterface {
  readonly driverType: DisplayDriverType = 'none';

  async update(_state: CustomerDisplayState): Promise<void> {}
  async showIdle(_message?: string): Promise<void> {}
  async showPayment(_total: number, _currencyCode: string): Promise<void> {}
  async showThankYou(_message?: string): Promise<void> {}
  isConnected(): boolean {
    return false;
  }
  async connect(_config: DisplayConnectionConfig): Promise<boolean> {
    return true;
  }
  async disconnect(): Promise<void> {}
}
