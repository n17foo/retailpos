/**
 * A single item on a KDS order ticket.
 */
export interface KdsOrderItem {
  id: string;
  name: string;
  quantity: number;
  modifiers?: string[];
  notes?: string;
}

/**
 * An order ticket sent to the kitchen display.
 */
export interface KdsOrder {
  orderId: string;
  /** Short display reference shown on the KDS (e.g. last 4 chars of orderId) */
  orderRef: string;
  items: KdsOrderItem[];
  /** Unix ms timestamp when the order was placed */
  placedAt: number;
  /** Optional table or register label */
  label?: string;
}

/**
 * Status update sent back from the KDS to the POS.
 */
export type KdsOrderStatus = 'received' | 'preparing' | 'ready' | 'recalled';

export interface KdsStatusUpdate {
  orderId: string;
  status: KdsOrderStatus;
  updatedAt: number;
}

/**
 * Interface for Kitchen Display System integrations.
 *
 * Implementations:
 *  - `HttpKdsService`      — sends tickets to a KDS over HTTP (e.g. Square KDS, custom)
 *  - `NoOpKdsService`      — does nothing (when no KDS is configured)
 * Planned (selectable in settings as "coming soon", not yet shipped):
 *  - `WebSocketKdsService` — real-time push via WebSocket
 *  - `ElectronKdsService`  — IPC to a second Electron window acting as the KDS
 */
export interface KdsServiceInterface {
  /** Which driver is backing this instance. */
  readonly driverType: KdsDriverType;

  /**
   * Send a new order ticket to the KDS.
   * @returns true if the ticket was accepted
   */
  sendOrder(order: KdsOrder): Promise<boolean>;

  /**
   * Recall (re-display) an existing order on the KDS.
   */
  recallOrder(orderId: string): Promise<boolean>;

  /**
   * Cancel / remove an order from the KDS display.
   */
  cancelOrder(orderId: string): Promise<boolean>;

  /**
   * Register a callback to receive status updates from the KDS
   * (e.g. kitchen marks an order as ready).
   * @returns Subscription ID for unsubscribing
   */
  onStatusUpdate(callback: (update: KdsStatusUpdate) => void): string;

  /**
   * Unregister a status update callback.
   */
  offStatusUpdate(subscriptionId: string): void;

  /**
   * Check whether the KDS connection is active.
   */
  isConnected(): boolean;

  /**
   * Connect to the KDS endpoint.
   */
  connect(config: KdsConnectionConfig): Promise<boolean>;

  /**
   * Disconnect from the KDS.
   */
  disconnect(): Promise<void>;
}

export type KdsDriverType = 'http' | 'websocket' | 'electron' | 'none';

export interface KdsConnectionConfig {
  /** Base URL for HTTP/WebSocket KDS (e.g. 'http://192.168.1.50:8080') */
  endpoint?: string;
  /** Shared secret / API key for authentication */
  apiKey?: string;
  /** Reconnect automatically on disconnect */
  autoReconnect?: boolean;
  /** Polling interval in milliseconds (for HTTP KDS) */
  pollIntervalMs?: number;
  /** Vendor-specific preset configuration */
  vendorPreset?: import('./KdsVendorPresets').KdsVendorPreset;
  /** Merchant ID (for multi-tenant KDS like Clover) */
  merchantId?: string;
}
