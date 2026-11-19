import { generateUUID } from '../../../../shared/utils/uuid';
import { BasketItem } from '../../../basket/services/basket';
import { PaymentLine } from '../../../orders-sync/services/order/order';
import { ReturnService } from '../refunds/RefundService';
import { CheckoutServiceInterface } from '../../../checkout/services/CheckoutServiceInterface';
import { permissionService } from '../../../authentication/services/permissions/PermissionService';
import { LoggerFactory } from '../../../../shared/services/logger/LoggerFactory';
import { auditLogService } from '../../../../shared/services/audit/AuditLogService';
import { getReturnRepository } from '../../repositories/ReturnRepository';
import { roundMoney, sumMoney, toCents, toDollars } from '../../../../shared/utils/money';

export interface ReturnLineInput {
  orderItemId: string;
  productId: string;
  variantId?: string;
  productName: string;
  quantity: number;
  price: number;
  /** Amount actually paid for this returned quantity — discount/tax allocated. Never exceeds the paid line share (RET-03). */
  refundAmount: number;
}

export interface ExchangeSession {
  id: string;
  originalOrderId: string;
  returnItems: ReturnLineInput[];
  returnCredit: number; // sum of returnItems refundAmount
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
  /** Store credit still owed to the customer when the return exceeds the new order (netDue < 0) */
  creditOwed?: number;
  error?: string;
}

/**
 * Authorization evidence for the exchange. A cashier without the
 * 'exchange:process' permission must supply the id of an approving user who
 * does hold it — the service re-verifies the approver's permission rather
 * than trusting a boolean from the UI (RET-02).
 */
export interface ExchangeAuthorization {
  approvedByUserId?: string;
}

function calcTotals(session: Omit<ExchangeSession, 'netDue' | 'remainingDue'>): Pick<ExchangeSession, 'netDue' | 'remainingDue'> {
  const netDue = roundMoney(session.newItemsTotal - session.returnCredit);
  const collected = sumMoney(session.payments.filter(p => p.amount > 0).map(p => p.amount));
  const remainingDue = roundMoney(netDue - collected);
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
    const returnCredit = roundMoney(sumMoney(returnItems.map(i => i.refundAmount)));
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
    const newItemsTotal = roundMoney(sumMoney(newItems.map(i => i.price * i.quantity)));
    const updated = { ...session, newItems, newItemsTotal };
    return { ...updated, ...calcTotals(updated) };
  }

  removeItem(session: ExchangeSession, itemId: string): ExchangeSession {
    const newItems = session.newItems.filter(i => i.id !== itemId);
    const newItemsTotal = roundMoney(sumMoney(newItems.map(i => i.price * i.quantity)));
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

  /**
   * The caller must hold 'exchange:process' or present the id of an approver
   * who does. Verified against the user database at the service boundary —
   * navigation/menu hiding is not an authorization control (RET-02).
   */
  private async authorize(cashierId: string | undefined, authorization?: ExchangeAuthorization): Promise<boolean> {
    if (cashierId && (await permissionService.can(cashierId, 'exchange:process'))) {
      return true;
    }
    const approver = authorization?.approvedByUserId;
    return !!approver && approver !== cashierId && (await permissionService.can(approver, 'exchange:process'));
  }

  async confirm(
    session: ExchangeSession,
    cashierId?: string,
    cashierName?: string,
    authorization?: ExchangeAuthorization
  ): Promise<ExchangeConfirmResult> {
    // Validate settlement — a positive remaining due means the customer
    // still owes; a negative remainder is store credit owed to them.
    if (session.remainingDue > 0.01) {
      return { success: false, error: 'Exchange not fully settled' };
    }

    if (!(await this.authorize(cashierId, authorization))) {
      return { success: false, error: 'Exchange requires a user with exchange permission or manager approval' };
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
          refundAmount: i.refundAmount,
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

      // 2. If new items exist, create a new order FROM THE SESSION ITEMS —
      // never from the live sale basket (RET-01). The order is settled by
      // the recorded top-up payments plus an explicit 'store_credit' tender
      // line for the return credit actually consumed — so a zero-tender
      // exchange can never mark an order paid without coverage (RET-02).
      let newOrderId: string | undefined;
      if (session.newItems.length > 0) {
        try {
          const newOrder = await this.checkoutService.createOrderFromItems(session.newItems, cashierId, cashierName);
          newOrderId = newOrder.id;

          const collected = sumMoney(session.payments.filter(p => p.amount > 0).map(p => p.amount));
          const creditApplied = toDollars(Math.max(0, toCents(newOrder.total) - toCents(collected)));

          const tenderLines: PaymentLine[] = [
            ...session.payments.filter(p => p.amount > 0),
            ...(toCents(creditApplied) > 0
              ? [
                  {
                    id: generateUUID(),
                    method: 'store_credit' as const,
                    amount: creditApplied,
                    transactionId: session.originalOrderId,
                    processedAt: Date.now(),
                  },
                ]
              : []),
          ];

          const primaryMethod = session.payments.find(p => p.amount > 0)?.method ?? 'store_credit';
          const primaryTxId = session.payments.find(p => p.amount > 0)?.transactionId ?? session.originalOrderId;
          const paymentResult = await this.checkoutService.completePayment(newOrderId, primaryMethod, primaryTxId, tenderLines, {
            preserveBasket: true,
          });
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
            // Optional — implemented by both Offline and InstoreApi repositories
            await repo.linkToExchange?.(returnId, newOrderId);
          }
        } catch (linkError) {
          this.logger.warn({
            message: `Exchange completed but return→order linking failed for ${newOrderId}: ${linkError instanceof Error ? linkError.message : String(linkError)}`,
          });
        }
      }

      const creditOwed = session.netDue < -0.005 ? roundMoney(-session.netDue) : 0;

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
          creditOwed,
          approvedByUserId: authorization?.approvedByUserId,
        },
      });

      return { success: true, newOrderId, returnIds: returnResult.returnIds, creditOwed };
    } catch (err) {
      this.logger.error({ message: 'Exchange confirmation failed' }, err instanceof Error ? err : new Error(String(err)));
      return { success: false, error: err instanceof Error ? err.message : 'Exchange failed' };
    }
  }
}
