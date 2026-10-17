import { KdsServiceInterface, KdsOrder, KdsConnectionConfig, KdsDriverType, KdsStatusUpdate } from './KdsServiceInterface';

/**
 * No-op KDS service — used when no KDS is configured.
 * All operations succeed silently so the checkout flow is never blocked.
 */
export class NoOpKdsService implements KdsServiceInterface {
  readonly driverType: KdsDriverType = 'none';

  async sendOrder(_order: KdsOrder): Promise<boolean> {
    return true;
  }
  async recallOrder(_orderId: string): Promise<boolean> {
    return true;
  }
  async cancelOrder(_orderId: string): Promise<boolean> {
    return true;
  }
  onStatusUpdate(_callback: (update: KdsStatusUpdate) => void): string {
    return '';
  }
  offStatusUpdate(_subscriptionId: string): void {}
  isConnected(): boolean {
    return false;
  }
  async connect(_config: KdsConnectionConfig): Promise<boolean> {
    return true;
  }
  async disconnect(): Promise<void> {}
}
