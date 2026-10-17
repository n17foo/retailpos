/**
 * Drawer connection type.
 */
export type DrawerDriverType = 'printer' | 'usb' | 'bluetooth' | 'network' | 'none';

/**
 * Interface for cash drawer operations.
 *
 * The cash drawer is a *standalone* peripheral. The UI/checkout flow
 * decides **when** to open it (e.g. after a cash payment is completed).
 *
 * Implementations:
 *  - `PrinterDrawerDriver`  — sends ESC/POS drawer-kick via the receipt printer
 *  - Future: standalone USB/Bluetooth/network drawer drivers
 *  - `NoOpDrawerDriver`     — does nothing (when no drawer is configured)
 */
export interface CashDrawerServiceInterface {
  /** Which driver is backing this instance. */
  readonly driverType: DrawerDriverType;

  /**
   * Open the cash drawer.
   * @returns true if the command was sent successfully
   */
  open(): Promise<boolean>;

  /**
   * Check whether the drawer is currently open (if hardware supports it).
   * Returns `undefined` when the status cannot be determined.
   */
  isOpen(): Promise<boolean | undefined>;
}
