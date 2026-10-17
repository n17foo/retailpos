/**
 * The data shown on the customer-facing display.
 */
export interface CustomerDisplayState {
  /** Items currently in the basket */
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  /** Currency code for formatting (e.g. 'GBP') */
  currencyCode: string;
  /** Screen to show — idle when basket is empty, basket during sale, payment during checkout */
  screen: 'idle' | 'basket' | 'payment' | 'thankyou';
  /** Optional message shown on the idle or thank-you screen */
  message?: string;
}

/**
 * Interface for customer-facing display integrations.
 *
 * Implementations:
 *  - `WebSocketDisplayService` — push to a browser-based display on a second device
 *  - `NoOpDisplayService`      — does nothing (when no display is configured)
 */
export interface CustomerDisplayServiceInterface {
  /** Which driver is backing this instance. */
  readonly driverType: DisplayDriverType;

  /**
   * Push the current basket state to the display.
   * Called on every basket change.
   */
  update(state: CustomerDisplayState): Promise<void>;

  /**
   * Show the idle/welcome screen (called when basket is cleared).
   */
  showIdle(message?: string): Promise<void>;

  /**
   * Show the payment-in-progress screen.
   */
  showPayment(total: number, currencyCode: string): Promise<void>;

  /**
   * Show the thank-you screen after payment completes.
   */
  showThankYou(message?: string): Promise<void>;

  /**
   * Check whether the display is connected.
   */
  isConnected(): boolean;

  /**
   * Connect to the display device.
   */
  connect(config: DisplayConnectionConfig): Promise<boolean>;

  /**
   * Disconnect from the display.
   */
  disconnect(): Promise<void>;
}

export type DisplayDriverType = 'websocket' | 'none';

export interface DisplayConnectionConfig {
  /** WebSocket URL of the display endpoint */
  endpoint?: string;
  /** Connection timeout in milliseconds (default 5000) */
  connectionTimeoutMs?: number;
}

// ── Helper ────────────────────────────────────────────────────────────────

/** Build a CustomerDisplayState from basket data */
export function buildDisplayState(
  items: Array<{ name: string; quantity: number; price: number }>,
  subtotal: number,
  tax: number,
  total: number,
  currencyCode: string,
  screen: CustomerDisplayState['screen'] = 'basket'
): CustomerDisplayState {
  return {
    items: items.map(i => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      total: i.price * i.quantity,
    })),
    subtotal,
    tax,
    total,
    currencyCode,
    screen,
  };
}
