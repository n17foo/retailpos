import { ECommercePlatform, isOnlinePlatform, PLATFORM_DISPLAY_NAMES } from '../../utils/platforms';
import { toPlatformProductId, toPlatformVariantId } from '../../utils/platformIds';
import { applyTaxQuote } from './taxQuote';
import { BasketItem } from '../basket/basket';
import { LocalOrder, LocalOrderStatus, CheckoutResult, PaymentLine } from '../order/order';
import { BasketServiceInterface } from '../basket/BasketServiceInterface';
import { CheckoutServiceInterface } from './CheckoutServiceInterface';
import { OrderRepository } from '../../repositories/OrderRepository';
import { OrderRow } from '../../repositories/OrderRepository';
import { OrderItemRepository } from '../../repositories/OrderItemRepository';
import { LoggerInterface } from '../logger/LoggerInterface';
import { posConfig } from '../config/POSConfigService';
import { generateUUID } from '../../utils/uuid';
import { auditLogService } from '../audit/AuditLogService';
import { OrderServiceFactory } from '../order/OrderServiceFactory';
import { getPlatformCapabilities, getBasketMode } from '../../utils/platformCapabilities';
import { loyaltyService } from '../loyalty/LoyaltyService';
import { localCustomerService } from '../customer/LocalCustomerService';
import { DiscountServiceFactory } from '../discount/DiscountServiceFactory';
import { procurementService } from '../procurement/ProcurementService';
import { InventoryServiceFactory } from '../inventory/InventoryServiceFactory';

/**
 * Handles checkout flow and order queries.
 * Depends on BasketService for reading/clearing the basket.
 */
export class CheckoutService implements CheckoutServiceInterface {
  constructor(
    private basketService: BasketServiceInterface,
    private orderRepo: OrderRepository,
    private orderItemRepo: OrderItemRepository,
    private logger: LoggerInterface
  ) {}

  async startCheckout(platform?: ECommercePlatform, cashierId?: string, cashierName?: string): Promise<LocalOrder> {
    const basket = await this.basketService.getBasket();

    if (basket.items.length === 0) {
      throw new Error('Cannot checkout with empty basket');
    }

    const now = Date.now();
    const orderId = generateUUID();

    // ── Tax comes from the platform ────────────────────────────────────
    // Online platforms own tax. The platform calculates it for the whole basket and the POS never assumes a rate:
    //   native_draft  → create a platform draft; its totals are authoritative (Shopify, Wix, Commercefull)
    //   remote_cart   → ask the platform to calculate tax on a cart/quote/checkout and discard it
    //                   (WooCommerce, Magento, BigCommerce, Sylius, PrestaShop); the order is created after payment
    //   local_only    → offline catalogue only: basket totals with the merchant's local tax setup
    // If an online platform cannot return the tax, checkout stops: charging without it would charge the customer wrongly.
    // See: docs/specs/platform/platform-tax.md and docs/specs/checkout/checkout.md §Checkout Capability Modes
    let subtotal = basket.subtotal;
    let tax = basket.tax;
    let total = basket.total;
    let platformOrderId: string | undefined;
    let status: LocalOrderStatus = 'pending';
    let platformTaxRates: (number | undefined)[] = basket.items.map(() => undefined);

    const isOnline = !!platform && isOnlinePlatform(platform);
    const basketMode = isOnline ? getBasketMode(getPlatformCapabilities(platform)) : 'local_only';

    if (isOnline && platform) {
      const orderService = OrderServiceFactory.getInstance().getService(platform);
      const platformOrder = {
        customerEmail: basket.customerEmail,
        customerName: basket.customerName,
        note: basket.note,
        lineItems: basket.items.map(item => ({
          productId: toPlatformProductId(platform, item),
          variantId: toPlatformVariantId(platform, item),
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          total: item.price * item.quantity,
        })),
        subtotal: basket.subtotal,
        tax: basket.tax,
        total: basket.total,
        discounts: basket.discountCode
          ? [{ code: basket.discountCode, amount: basket.discountAmount ?? 0, type: 'fixed_amount' as const }]
          : undefined,
      };

      try {
        if (basketMode === 'native_draft') {
          const draftOrder = await orderService.createDraftOrder(platformOrder);

          subtotal = draftOrder.subtotal;
          tax = draftOrder.tax;
          total = draftOrder.total;
          platformOrderId = draftOrder.platformOrderId ?? draftOrder.id;
          status = 'draft';

          // Capture platform tax rates by position for order_items persistence
          platformTaxRates = basket.items.map((_, i) => draftOrder.lineItems[i]?.taxRate);
        } else {
          const quote = await orderService.quoteTax(platformOrder);
          ({ subtotal, tax, total } = applyTaxQuote(basket.subtotal, basket.discountAmount ?? 0, quote));
        }
      } catch (err) {
        this.logger.error(
          { message: `Could not get tax from ${platform} (${basketMode}); checkout stopped` },
          err instanceof Error ? err : new Error(String(err))
        );
        throw new Error(
          `Could not get the tax calculation from ${PLATFORM_DISPLAY_NAMES[platform]}, so the sale cannot be completed. ` +
            `Check the connection and try again. (${err instanceof Error ? err.message : String(err)})`,
          { cause: err }
        );
      }
    }

    const localOrder: LocalOrder = {
      id: orderId,
      platformOrderId,
      platform,
      items: basket.items,
      subtotal,
      tax,
      total,
      discountAmount: basket.discountAmount,
      discountCode: basket.discountCode,
      customerEmail: basket.customerEmail,
      customerName: basket.customerName,
      note: basket.note,
      saleMode: basket.saleMode,
      cashierId,
      cashierName,
      registerId: basket.registerId,
      status,
      syncStatus: 'pending',
      createdAt: new Date(now),
      updatedAt: new Date(now),
    };

    const orderInput = {
      id: orderId,
      platform: platform ?? null,
      subtotal,
      tax,
      total,
      discountAmount: basket.discountAmount ?? null,
      discountCode: basket.discountCode ?? null,
      customerEmail: basket.customerEmail ?? null,
      customerName: basket.customerName ?? null,
      note: basket.note ?? null,
      saleMode: basket.saleMode ?? null,
      cashierId: cashierId ?? null,
      cashierName: cashierName ?? null,
      registerId: basket.registerId ?? null,
      platformOrderId: platformOrderId ?? null,
      status,
    };

    const itemInputs = basket.items.map((item, i) => ({
      orderId,
      productId: item.productId,
      variantId: item.variantId,
      sku: item.sku,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image,
      taxable: item.taxable ?? false,
      taxRate: platformTaxRates[i] ?? item.taxRate ?? null,
      isEcommerceProduct: item.isEcommerceProduct,
      originalId: item.originalId,
      properties: item.properties,
      optionSummary: item.optionSummary ?? null,
      taxCode: item.taxCode ?? null,
      taxProfileId: item.taxProfileId ?? null,
      inventoryPolicy: item.inventoryPolicy ?? null,
      catalogVersion: item.catalogVersion ?? null,
    }));

    await this.orderRepo.createWithItems(orderInput, itemInputs);

    auditLogService.log('order:created', {
      userId: cashierId,
      userName: cashierName,
      details: `Order ${orderId} created — ${basket.items.length} item(s), total ${total.toFixed(2)}`,
      metadata: { orderId, itemCount: basket.items.length, total },
    });

    return localOrder;
  }

  /**
   * Cancel a draft order — deletes the platform draft and the local row.
   * The basket is NOT cleared. The cashier can edit and start a new checkout.
   */
  async cancelDraftOrder(orderId: string, platform?: ECommercePlatform, platformOrderId?: string): Promise<void> {
    // Cancel on platform (best-effort — don't block if it fails)
    if (platform && isOnlinePlatform(platform) && platformOrderId) {
      try {
        const orderService = OrderServiceFactory.getInstance().getService(platform);
        await orderService.cancelDraftOrder(platformOrderId);
      } catch (err) {
        this.logger.warn(
          { message: `Failed to cancel platform draft ${platformOrderId} on ${platform}, removing local draft anyway` },
          err instanceof Error ? err : new Error(String(err))
        );
      }
    }

    // Always remove the local draft row
    await this.orderRepo.delete(orderId);
  }

  async markPaymentProcessing(orderId: string): Promise<LocalOrder> {
    await this.orderRepo.updateStatus(orderId, 'processing');

    const order = await this.getLocalOrder(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    return order;
  }

  /**
   * Return a 'processing' order to 'draft' after a failed payment attempt so the
   * cashier can retry or pick another tender method without losing the order.
   */
  async revertToDraft(orderId: string): Promise<LocalOrder> {
    await this.orderRepo.updateStatus(orderId, 'draft');
    const order = await this.getLocalOrder(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    return order;
  }

  async completePayment(orderId: string, paymentMethod: string, transactionId?: string, payments?: PaymentLine[]): Promise<CheckoutResult> {
    try {
      // Validate split tender total matches order total (spec §6.1)
      if (payments && payments.length > 0) {
        const orderRow = await this.orderRepo.findById(orderId);
        if (orderRow) {
          const paymentSum = Math.round(payments.reduce((s, p) => s + p.amount, 0) * 100);
          const orderTotal = Math.round(orderRow.total * 100);
          if (Math.abs(paymentSum - orderTotal) > 1) {
            throw new Error('Payment total mismatch');
          }
        }
        await this.orderRepo.updatePaymentLines(orderId, paymentMethod, transactionId ?? null, JSON.stringify(payments));
      } else {
        await this.orderRepo.updatePayment(orderId, paymentMethod, transactionId ?? null);
      }

      // If this order has a platform draft, mark it as paid on the platform.
      // Only attempt completeOrder() for native_draft platforms — remote_cart and
      // local_only platforms never create a platformOrderId at checkout time.
      const orderRow = await this.orderRepo.findById(orderId);
      if (orderRow?.platform_order_id && orderRow.platform) {
        const platform = orderRow.platform as ECommercePlatform;
        const mode = isOnlinePlatform(platform) ? getBasketMode(getPlatformCapabilities(platform)) : 'local_only';
        if (mode === 'native_draft') {
          try {
            const orderService = OrderServiceFactory.getInstance().getService(platform);
            await orderService.completeOrder(orderRow.platform_order_id, paymentMethod, transactionId);
          } catch (err) {
            // Non-blocking — local payment is already recorded
            this.logger.warn(
              { message: `Failed to complete platform order ${orderRow.platform_order_id} on ${platform}` },
              err instanceof Error ? err : new Error(String(err))
            );
          }
        }
      }

      // Only clear basket after the order is successfully recorded
      await this.basketService.clearBasket();

      // Post-payment hooks — non-blocking, must not affect checkout result
      // orderRow was already fetched above; reuse it
      if (orderRow?.discount_code) {
        // Usage counts only on completed sales — validation never burns usage
        DiscountServiceFactory.getInstance()
          .getService((orderRow.platform as ECommercePlatform) ?? undefined)
          .recordUsage?.(orderRow.discount_code)
          .catch(() => {});
      }

      if (orderRow?.customer_email) {
        const email = orderRow.customer_email;
        const total = orderRow.total;
        loyaltyService.earnPoints(email, orderId, total).catch(() => {});
        localCustomerService.recordOrder(email, total).catch(() => {});
      }

      // Check reorder points for sold items (non-blocking)
      this.checkReorderPointsAfterSale(orderId).catch(() => {});

      const isCash = paymentMethod.toLowerCase() === 'cash';
      const openDrawer = isCash && posConfig.values.drawerOpenOnCash;

      auditLogService.log('order:paid', {
        details: `Order ${orderId} paid via ${paymentMethod}`,
        metadata: { orderId, paymentMethod, transactionId },
      });

      return { success: true, orderId, openDrawer };
    } catch (error) {
      this.logger.error({ message: `Failed to complete payment for order ${orderId}` }, error as Error);
      await this.orderRepo.updateStatus(orderId, 'failed');
      return { success: false, orderId, error: (error as Error).message };
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.orderRepo.updateStatus(orderId, 'cancelled');
    auditLogService.log('order:cancelled', {
      details: `Order ${orderId} cancelled`,
      metadata: { orderId },
    });
  }

  // ── Order queries ───────────────────────────────────────────────────

  async getLocalOrders(status?: LocalOrderStatus): Promise<LocalOrder[]> {
    const rows = await this.orderRepo.findAll(status);
    return Promise.all(rows.map(row => this.mapOrderRowToLocalOrder(row)));
  }

  async getUnsyncedOrders(): Promise<LocalOrder[]> {
    const rows = await this.orderRepo.findUnsynced();
    return Promise.all(rows.map(row => this.mapOrderRowToLocalOrder(row)));
  }

  async getLocalOrder(orderId: string): Promise<LocalOrder | null> {
    const row = await this.orderRepo.findById(orderId);
    if (!row) return null;
    return this.mapOrderRowToLocalOrder(row);
  }

  // ── Mapping ─────────────────────────────────────────────────────────

  private async mapOrderRowToLocalOrder(row: OrderRow): Promise<LocalOrder> {
    const itemRows = await this.orderItemRepo.findByOrderId(row.id);
    const items: BasketItem[] = itemRows.map(ir => ({
      id: ir.id,
      productId: ir.product_id,
      variantId: ir.variant_id ?? undefined,
      sku: ir.sku ?? undefined,
      name: ir.name,
      price: ir.price,
      quantity: ir.quantity,
      image: ir.image ?? undefined,
      taxable: ir.taxable === 1,
      taxRate: ir.tax_rate ?? undefined,
      isEcommerceProduct: ir.is_ecommerce_product === 1,
      originalId: ir.original_id ?? undefined,
      properties: ir.properties ? JSON.parse(ir.properties) : undefined,
    }));

    return {
      id: row.id,
      platformOrderId: row.platform_order_id ?? undefined,
      platform: row.platform as ECommercePlatform | undefined,
      items,
      subtotal: row.subtotal,
      tax: row.tax,
      total: row.total,
      discountAmount: row.discount_amount ?? undefined,
      discountCode: row.discount_code ?? undefined,
      cashierId: row.cashier_id ?? undefined,
      cashierName: row.cashier_name ?? undefined,
      customerEmail: row.customer_email ?? undefined,
      customerName: row.customer_name ?? undefined,
      note: row.note ?? undefined,
      saleMode: row.sale_mode ?? undefined,
      paymentMethod: row.payment_method ?? undefined,
      paymentTransactionId: row.payment_transaction_id ?? undefined,
      payments: row.payments_json ? (JSON.parse(row.payments_json) as PaymentLine[]) : undefined,
      registerId: row.register_id ?? undefined,
      status: row.status as LocalOrderStatus,
      syncStatus: row.sync_status as 'pending' | 'synced' | 'failed',
      syncError: row.sync_error ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      paidAt: row.paid_at ? new Date(row.paid_at) : undefined,
      syncedAt: row.synced_at ? new Date(row.synced_at) : undefined,
    };
  }

  // ── Reorder Point Integration ──────────────────────────────────────────

  /**
   * Check reorder points for items sold in an order.
   * Called after successful payment completion.
   */
  private async checkReorderPointsAfterSale(orderId: string): Promise<void> {
    try {
      const orderItems = await this.orderItemRepo.findByOrderId(orderId);
      const inventoryService = InventoryServiceFactory.getInstance().getService();

      for (const item of orderItems) {
        // Get current inventory after the sale
        const inventoryResult = await inventoryService.getInventory([item.product_id]);
        if (inventoryResult && inventoryResult.items.length > 0) {
          const inventoryItem = inventoryResult.items.find(
            inv => inv.productId === item.product_id && (inv.variantId || null) === (item.variant_id || null)
          );

          if (inventoryItem) {
            await procurementService.checkReorderPoint(item.product_id, item.variant_id, inventoryItem.quantity, item.name);
          }
        }
      }
    } catch (err) {
      this.logger.warn(
        { message: `Failed to check reorder points for order ${orderId}` },
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }
}
