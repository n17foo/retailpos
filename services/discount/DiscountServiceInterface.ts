/**
 * Discount Service Interface
 * Validates discount codes and calculates discount amounts
 */

export interface DiscountValidationResult {
  valid: boolean;
  discountAmount: number; // in cents
  discountType: 'fixed' | 'percentage';
  discountValue: number; // original value (cents for fixed, 0-100 for percentage)
  code: string;
  description?: string;
  error?: string;
  minimumPurchase?: number; // in cents
  maximumDiscount?: number; // in cents (for percentage discounts)
  expiresAt?: Date;
  usageLimit?: number;
  usageCount?: number;
}

export interface DiscountCode {
  code: string;
  type: 'fixed' | 'percentage';
  value: number; // cents for fixed, 0-100 for percentage
  description?: string;
  minimumPurchase?: number; // in cents
  maximumDiscount?: number; // in cents
  startsAt?: Date;
  expiresAt?: Date;
  usageLimit?: number;
  usageCount?: number;
  active: boolean;
}

export interface DiscountServiceInterface {
  /**
   * Initialize the discount service
   */
  initialize(): Promise<void>;

  /**
   * Validate a discount code and calculate the discount amount
   * @param code The discount code to validate
   * @param subtotal The basket subtotal in cents
   * @returns Validation result with discount amount
   */
  validateDiscount(code: string, subtotal: number): Promise<DiscountValidationResult>;

  /**
   * Record that a code was actually used — called once the order is paid.
   * Validation must NOT consume usage (codes can be applied and removed).
   * Optional: platform-backed services count usage on the platform side.
   */
  recordUsage?(code: string): Promise<void>;

  /**
   * Get all available discount codes (for admin/manager view)
   * @returns List of discount codes
   */
  getDiscountCodes?(): Promise<DiscountCode[]>;

  /**
   * Create a new discount code (for admin/manager)
   * @param discount The discount code to create
   * @returns The created discount code
   */
  createDiscountCode?(discount: Omit<DiscountCode, 'usageCount'>): Promise<DiscountCode>;

  /**
   * Update a discount code (for admin/manager)
   * @param code The discount code to update
   * @param updates The fields to update
   * @returns The updated discount code
   */
  updateDiscountCode?(code: string, updates: Partial<DiscountCode>): Promise<DiscountCode>;

  /**
   * Delete a discount code (for admin/manager)
   * @param code The discount code to delete
   */
  deleteDiscountCode?(code: string): Promise<void>;
}
