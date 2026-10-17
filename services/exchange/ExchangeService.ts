import { generateUUID } from '../../utils/uuid';
import { BasketItem } from '../basket/basket';
import { PaymentLine } from '../order/order';
import { ReturnService } from '../refunds/RefundService';
import { CheckoutServiceInterface } from '../checkout/CheckoutServiceInterface';
import { LoggerFactory } from '../logger/LoggerFactory';
import { auditLogService } from '../audit/AuditLogService';
import { getReturnRepository } from '../../repositories/ReturnRepository';

export interface ReturnLineInput {
  orderItemId: string;
  productId: string;
  variantId?: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface ExchangeSession {
  id: string;
  originalOrderId: string;
  returnItems: ReturnLineInput[];
  returnCredit: number; // sum of returnItems price * qty
  newItems: BasketItem[];
  newItemsTotal: number; // sum of newItems price * qty
  netDue: number; // newItemsTotal - returnCredit (negative = store owes customer)
  payments: PaymentLine[];
  remainingDue: number; // netDue - sum of positive payment amounts
}

export interface ExchangeConfirmResult {
  success: boolean;
  newOrderId?: string;
  returnIds?: string[];
  error?: string;
}

function calcTotals(session: Omit<ExchangeSession, 'netDue' | 'remainingDue'>): Pick<ExchangeSession, 'netDue' | 'remainingDue'> {
  const netDue = Math.round((session.newItemsTotal - session.returnCredit) * 100) / 100;
  const collected = session.payments.filter(p => p.amount > 0).reduce((s, p) => s + p.amount, 0);
  const remainingDue = Math.round((netDue - collected) * 100) / 100;
  return { netDue, remainingDue };
}

export class ExchangeService {
  private static instance: ExchangeService;
  private logger = LoggerFactory.getInstance().createLogger('ExchangeService');

  private constructor(
    private returnService: ReturnService,
    private checkoutService: CheckoutServiceInterface
  ) {}

  static getInstance(returnService: ReturnService, checkoutService: CheckoutServiceInterface): ExchangeService {
    if (!ExchangeService.instance) {
      ExchangeService.instance = new ExchangeService(returnService, checkoutService);
    }
    return ExchangeService.instance;
  }

  createSession(originalOrderId: string, returnItems: ReturnLineInput[]): ExchangeSession {
    const returnCredit = Math.round(returnItems.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;
    const base = {
      id: generateUUID(),
      originalOrderId,
      returnItems,
      returnCredit,
      newItems: [],
      newItemsTotal: 0,
      payments: [],
    };
    return { ...base, ...calcTotals(base) };
  }

  addItem(session: ExchangeSession, item: BasketItem): ExchangeSession {
    const newItems = [...session.newItems, item];
    const newItemsTotal = Math.round(newItems.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;
    const updated = { ...session, newItems, newItemsTotal };
    return { ...updated, ...calcTotals(updated) };
  }

  removeItem(session: ExchangeSession, itemId: string): ExchangeSession {
    const newItems = session.newItems.filter(i => i.id !== itemId);
    const newItemsTotal = Math.round(newItems.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;
    const updated = { ...session, newItems, newItemsTotal };
    return { ...updated, ...calcTotals(updated) };
  }

  addPayment(session: ExchangeSession, payment: Omit<PaymentLine, 'id' | 'processedAt'>): ExchangeSession {
    const line: PaymentLine = { ...payment, id: generateUUID(), processedAt: Date.now() };
    const payments = [...session.payments, line];
    const updated = { ...session, payments };
    return { ...updated, ...calcTotals(updated) };
  }

  removePayment(session: ExchangeSession, paymentId: string): ExchangeSession {
    const payments = session.payments.filter(p => p.id !== paymentId);
    const updated = { ...session, payments };
    return { ...updated, ...calcTotals(updated) };
  }

  async confirm(session: ExchangeSession, cashierId?: string, cashierName?: string): Promise<ExchangeConfirmResult> {
    // Validate settlement
    if (Math.abs(session.remainingDue) > 0.01) {
      return { success: false, error: 'Exchange not fully settled' };
    }

    // Compensation log — populated as writes succeed so a later failure can
    // undo them (return records are deleted; the link step is cosmetic).
    const createdReturnIds: string[] = [];

    const compensateReturns = async (): Promise<void> => {
      const repo = getReturnRepository();
      for (const returnId of createdReturnIds) {
        try {
          await repo.delete(returnId);
        } catch (err) {
          this.logger.error(
            { message: `Compensation failed: could not delete return ${returnId} after aborted exchange` },
            err instanceof Error ? err : new Error(String(err))
          );
        }
      }
      if (createdReturnIds.length > 0) {
        this.logger.warn({
          message: `Exchange aborted — ${createdReturnIds.length} return record(s) compensated for order ${session.originalOrderId}`,
        });
      }
    };

    try {
      // 1. Create return records
      const returnResult = await this.returnService.processReturn({
        orderId: session.originalOrderId,
        items: session.returnItems.map(i => ({
          orderItemId: i.orderItemId,
          productId: i.productId,
          variantId: i.variantId,
          productName: i.productName,
          quantity: i.quantity,
          refundAmount: i.price * i.quantity,
          restock: true,
          issueRefund: false,
        })),
        processedBy: cashierId,
        issueRefund: false,
      });

      if (!returnResult.success) {
        return { success: false, error: returnResult.error ?? 'Failed to process return leg' };
      }
      createdReturnIds.push(...returnResult.returnIds);

      // 2. If new items exist, create a new order — on failure, undo the
      // return leg so the original order isn't left half-exchanged
      let newOrderId: string | undefined;
      if (session.newItems.length > 0) {
        try {
          const newOrder = await this.checkoutService.startCheckout(undefined, cashierId, cashierName);
          newOrderId = newOrder.id;

          const primaryMethod = session.payments.find(p => p.amount > 0)?.method ?? 'other';
          const primaryTxId = session.payments.find(p => p.amount > 0)?.transactionId;
          const paymentResult = await this.checkoutService.completePayment(newOrderId, primaryMethod, primaryTxId, session.payments);
          if (!paymentResult.success) {
            throw new Error(paymentResult.error ?? 'Payment completion failed');
          }
        } catch (orderError) {
          await compensateReturns();
          throw orderError;
        }
      }

      // 3. Link return records to exchange order — cosmetic; a failure here
      // must not fail an otherwise-complete exchange
      if (newOrderId && returnResult.returnIds.length > 0) {
        try {
          const repo = getReturnRepository();
          for (const returnId of returnResult.returnIds) {
            // linkToExchange is available on OfflineReturnRepository
            await (repo as unknown as { linkToExchange?: (id: string, orderId: string) => Promise<void> }).linkToExchange?.(
              returnId,
              newOrderId
            );
          }
        } catch (linkError) {
          this.logger.warn({
            message: `Exchange completed but return→order linking failed for ${newOrderId}: ${linkError instanceof Error ? linkError.message : String(linkError)}`,
          });
        }
      }

      await auditLogService.log('exchange:completed', {
        userId: cashierId,
        userName: cashierName,
        details: `Exchange completed: original order ${session.originalOrderId}, new order ${newOrderId ?? 'none'}`,
        metadata: {
          originalOrderId: session.originalOrderId,
          newOrderId,
          returnIds: returnResult.returnIds,
          returnCredit: session.returnCredit,
          newItemsTotal: session.newItemsTotal,
          netDue: session.netDue,
        },
      });

      return { success: true, newOrderId, returnIds: returnResult.returnIds };
    } catch (err) {
      this.logger.error({ message: 'Exchange confirmation failed' }, err instanceof Error ? err : new Error(String(err)));
      return { success: false, error: err instanceof Error ? err.message : 'Exchange failed' };
    }
  }
}
