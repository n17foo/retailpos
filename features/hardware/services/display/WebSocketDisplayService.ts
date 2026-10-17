import {
  CustomerDisplayServiceInterface,
  CustomerDisplayState,
  DisplayConnectionConfig,
  DisplayDriverType,
} from './CustomerDisplayServiceInterface';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';

/**
 * WebSocket-based customer display.
 * Pushes basket state to a browser running on a second device (tablet, monitor).
 * The display browser connects to this WebSocket server and renders the state.
 *
 * On Electron, the main process hosts the WebSocket server.
 * On mobile/tablet, a lightweight WebSocket server can be run via a native module.
 */
export class WebSocketDisplayService implements CustomerDisplayServiceInterface {
  readonly driverType: DisplayDriverType = 'websocket';
  private logger = LoggerFactory.getInstance().createLogger('WebSocketDisplayService');
  private ws: WebSocket | null = null;
  private config: DisplayConnectionConfig | null = null;

  async connect(config: DisplayConnectionConfig): Promise<boolean> {
    try {
      this.config = config;
      this.ws = new WebSocket(config.endpoint!);

      const timeoutMs = config.connectionTimeoutMs ?? 5000;

      return await new Promise<boolean>(resolve => {
        const timeout = setTimeout(() => {
          this.logger.warn({ message: `WebSocket display connection timed out after ${timeoutMs}ms` });
          resolve(false);
        }, timeoutMs);

        this.ws!.onopen = () => {
          clearTimeout(timeout);
          this.logger.info(`Customer display connected via WebSocket: ${config.endpoint}`);
          resolve(true);
        };

        this.ws!.onerror = () => {
          clearTimeout(timeout);
          resolve(false);
        };
      });
    } catch (error) {
      this.logger.error({ message: 'Failed to connect customer display' }, error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.ws?.close();
    this.ws = null;
    this.logger.info('Customer display disconnected');
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  async update(state: CustomerDisplayState): Promise<void> {
    this.send({ type: 'update', payload: state });
  }

  async showIdle(message?: string): Promise<void> {
    this.send({ type: 'idle', payload: { message } });
  }

  async showPayment(total: number, currencyCode: string): Promise<void> {
    this.send({ type: 'payment', payload: { total, currencyCode } });
  }

  async showThankYou(message?: string): Promise<void> {
    this.send({ type: 'thankyou', payload: { message } });
  }

  private send(message: unknown): void {
    if (!this.isConnected()) return;
    try {
      this.ws!.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error({ message: 'Failed to send to customer display' }, error instanceof Error ? error : new Error(String(error)));
    }
  }
}
