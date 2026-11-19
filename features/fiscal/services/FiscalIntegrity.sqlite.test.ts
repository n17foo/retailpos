/**
 * Real-SQLite regression tests for the fiscal review P1 findings:
 *
 *  F01 — verifyChain detects metadata tampering, gaps, and head drift
 *  F02 — returns/voids never overwrite the original sale's fiscal identity
 *  F03 — authority outbox work is atomic with the record and repaired on retry
 *  F04 — strict checkout refuses to complete without a fiscal record,
 *        and the reconciler retries paid-but-unfiscalized orders
 *  F07 — return records carry the actual refunded amounts
 *  F08 — voids serialize as anulación, z_reports are not submitted as sales
 */
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('expo-sqlite', () => {
  const { openDb } = require('../../../tests/helpers/nodeSqliteAdapter');
  const real = openDb();
  return {
    openDatabaseAsync: jest.fn(async () => real),
    openDatabaseSync: jest.fn(() => real),
  };
});

jest.mock('../../multi-register/services/InstoreApiConfig', () => ({
  instoreApiConfig: { isClient: false },
}));

import { db } from '../../../shared/utils/db';
import { initializeSchema } from '../../../shared/utils/dbSchema';
import { LoggerFactory } from '../../../shared/services/logger/LoggerFactory';
import { offlineFiscalService } from './OfflineFiscalService';
import { fiscalTransmissionDrainer } from './FiscalTransmissionDrainer';
import { fiscalRecordRepository } from '../repositories/FiscalRecordRepository';
import { orderRepository } from '../../orders-sync/repositories/OrderRepository';
import { orderItemRepository } from '../../orders-sync/repositories/OrderItemRepository';
import { returnRepository } from '../../returns/repositories/ReturnRepository';
import { keyValueRepository } from '../../../shared/repositories/KeyValueRepository';
import { CheckoutService } from '../../checkout/services/CheckoutService';
import { posConfig } from '../../platform-clients/services/config/POSConfigService';
import type { CreateOrderInput } from '../../orders-sync/repositories/OrderRepository';
import type { BasketServiceInterface } from '../../basket/services/BasketServiceInterface';

const realDb = db as unknown as SQLiteDatabase;

function makeInput(id: string): CreateOrderInput {
  return {
    id,
    platform: null,
    subtotal: 100,
    tax: 20,
    total: 120,
    discountAmount: null,
    discountCode: null,
    customerEmail: null,
    customerName: null,
    note: null,
    cashierId: 'u1',
    cashierName: 'Cashier',
  };
}

async function seedPaidOrder(id: string): Promise<void> {
  await orderRepository.create(makeInput(id));
  await orderRepository.updatePayment(id, 'cash', null);
}

async function seedReturn(returnId: string, orderId: string, refundAmount: number): Promise<void> {
  await returnRepository.create({
    orderId,
    productId: 'prod-1',
    productName: 'Widget',
    quantity: 1,
    refundAmount,
  });
  // create() generates the id — relabel to the requested test id.
  const rows = await returnRepository.findByOrderId(orderId);
  const row = rows[rows.length - 1];
  await realDb.runAsync('UPDATE returns SET id = ? WHERE id = ?', [returnId, row.id]);
}

const checkoutService = new CheckoutService(
  {
    getBasket: jest.fn(async () => ({ id: 'b', items: [], subtotal: 0, tax: 0, total: 0, discountAmount: 0 })),
    clearBasket: jest.fn(async () => undefined),
  } as unknown as BasketServiceInterface,
  orderRepository,
  orderItemRepository,
  LoggerFactory.getInstance().createLogger('test')
);

beforeEach(async () => {
  jest.clearAllMocks();
  await initializeSchema(realDb);
  for (const table of ['fiscal_transmissions', 'fiscal_records', 'fiscal_chain_state', 'returns', 'order_items', 'orders']) {
    await realDb.runAsync(`DELETE FROM ${table}`);
  }
  await posConfig.update('fiscalEnabled', true);
  await posConfig.update('fiscalJurisdiction', 'generic');
  await posConfig.update('fiscalInvoicePrefix', 'N17');
  await posConfig.update('fiscalSeries', 'A');
  await posConfig.update('fiscalAuthorityMode', 'transmit');
  await posConfig.update('fiscalBusinessTaxId', 'B12345678');
  await posConfig.update('fiscalStrictMode', false);
});

describe('F01 — verifyChain detects tampering the hash alone missed', () => {
  it('rejects relational-column tampering that leaves the payload intact', async () => {
    await seedPaidOrder('o1');
    await offlineFiscalService.finalizeSale('o1');

    await realDb.runAsync(`UPDATE fiscal_records SET number = 'FORGED', order_id = 'other-order' WHERE seq = 1`);

    const v = await offlineFiscalService.verifyChain();
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/number|metadata/i);
  });

  it('rejects tail deletion — chain state disagrees with the newest record', async () => {
    await seedPaidOrder('o1');
    await seedPaidOrder('o2');
    await offlineFiscalService.finalizeSale('o1');
    await offlineFiscalService.finalizeSale('o2');

    await realDb.runAsync('DELETE FROM fiscal_records WHERE seq = 2');

    const v = await offlineFiscalService.verifyChain();
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/tail|head/i);
  });

  it('rejects a mid-chain gap', async () => {
    for (const id of ['g1', 'g2', 'g3']) {
      await seedPaidOrder(id);
      await offlineFiscalService.finalizeSale(id);
    }
    await realDb.runAsync('DELETE FROM fiscal_records WHERE seq = 2');

    const v = await offlineFiscalService.verifyChain();
    expect(v.ok).toBe(false);
  });

  it('rejects a tampered chain-state head', async () => {
    await seedPaidOrder('o1');
    await offlineFiscalService.finalizeSale('o1');
    await realDb.runAsync(`UPDATE fiscal_chain_state SET last_hash = 'deadbeef'`);

    const v = await offlineFiscalService.verifyChain();
    expect(v.ok).toBe(false);
  });

  it('rejects a wiped ledger whose head still claims records exist', async () => {
    await seedPaidOrder('o1');
    await offlineFiscalService.finalizeSale('o1');
    await realDb.runAsync('DELETE FROM fiscal_records');

    const v = await offlineFiscalService.verifyChain();
    expect(v.ok).toBe(false);
  });

  it('still verifies a clean chain end-to-end', async () => {
    await seedPaidOrder('o1');
    await seedPaidOrder('o2');
    await offlineFiscalService.finalizeSale('o1');
    await offlineFiscalService.finalizeSale('o2');
    expect(await offlineFiscalService.verifyChain()).toEqual({ ok: true, checked: 2 });
  });
});

describe('F02 — corrections never overwrite the original sale identity', () => {
  it('a return keeps the order stamped with the sale record', async () => {
    await seedPaidOrder('o1');
    const sale = await offlineFiscalService.finalizeSale('o1');
    await seedReturn('ret-1', 'o1', 40);

    const ret = await offlineFiscalService.registerReturn('ret-1', 'o1');
    expect(ret.type).toBe('return');

    const order = await orderRepository.findById('o1');
    expect(order?.fiscal_record_id).toBe(sale.id);
    expect(order?.fiscal_number).toBe(sale.number);
    expect(order?.fiscal_status).toBe('fiscalized');
  });

  it('a void updates status only — invoice identity stays with the sale', async () => {
    await seedPaidOrder('o1');
    const sale = await offlineFiscalService.finalizeSale('o1');
    await offlineFiscalService.voidOrder('o1', 'wrong item');

    const order = await orderRepository.findById('o1');
    expect(order?.fiscal_status).toBe('voided');
    expect(order?.fiscal_record_id).toBe(sale.id);
    expect(order?.fiscal_number).toBe(sale.number);
  });
});

describe('F03 — authority work is atomic with the record', () => {
  it('an adapter failure rolls back the record — the order stays unfinalized and retryable', async () => {
    await posConfig.update('fiscalJurisdiction', 'es');
    await posConfig.update('fiscalBusinessTaxId', ''); // adapter throws inside the allocation txn
    await seedPaidOrder('o-f03');

    await expect(offlineFiscalService.finalizeSale('o-f03')).rejects.toThrow(/NIF/);
    const order = await orderRepository.findById('o-f03');
    expect(order?.fiscal_status).not.toBe('fiscalized');
    expect(await fiscalRecordRepository.findByOrderId('o-f03')).toBeNull();

    // Retry once configured — the whole thing commits now.
    await posConfig.update('fiscalBusinessTaxId', 'B12345678');
    const record = await offlineFiscalService.finalizeSale('o-f03');
    expect(record.type).toBe('sale');
    const pending = await fiscalRecordRepository.listPendingTransmissions(5);
    expect(pending).toHaveLength(1);
    expect(pending[0].record_id).toBe(record.id);
  });

  it('re-running finalization repairs a record whose outbox row was lost', async () => {
    await posConfig.update('fiscalJurisdiction', 'es');
    await seedPaidOrder('o-repair');
    const record = await offlineFiscalService.finalizeSale('o-repair');
    await realDb.runAsync('DELETE FROM fiscal_transmissions'); // simulate the pre-fix loss

    const again = await offlineFiscalService.finalizeSale('o-repair');
    expect(again.id).toBe(record.id);
    const pending = await fiscalRecordRepository.listPendingTransmissions(5);
    expect(pending).toHaveLength(1);
    expect(pending[0].record_id).toBe(record.id);
  });

  it('does not duplicate outbox rows when re-run on healthy data', async () => {
    await posConfig.update('fiscalJurisdiction', 'es');
    await seedPaidOrder('o-dup');
    await offlineFiscalService.finalizeSale('o-dup');
    await offlineFiscalService.finalizeSale('o-dup');
    expect(await fiscalRecordRepository.listPendingTransmissions(5)).toHaveLength(1);
  });
});

describe('F04 — strict checkout and durable recovery', () => {
  it('strict preflight refuses tender for an unsupported jurisdiction', async () => {
    await posConfig.update('fiscalStrictMode', true);
    await posConfig.update('fiscalJurisdiction', 'it');
    await seedPaidOrder('o-it');

    await expect(checkoutService.markPaymentProcessing('o-it')).rejects.toThrow(/'it'/);
    const order = await orderRepository.findById('o-it');
    expect(order?.status).toBe('paid'); // preflight ran before the status flip
  });

  it('strict mode returns failure — payment stays recorded, order stays paid+unfinalized', async () => {
    await posConfig.update('fiscalStrictMode', true);
    await posConfig.update('fiscalJurisdiction', 'es');
    await posConfig.update('fiscalBusinessTaxId', ''); // force finalization failure
    await seedPaidOrder('o-strict');
    await checkoutService.markPaymentProcessing('o-strict');

    const result = await checkoutService.completePayment('o-strict', 'cash');
    expect(result.success).toBe(false);
    expect(result.paymentRecorded).toBe(true);

    const order = await orderRepository.findById('o-strict');
    expect(order?.status).toBe('paid');
    expect(order?.fiscal_status).toBe('unfinalized');
  });

  it('revertToDraft never resurrects a paid order', async () => {
    await seedPaidOrder('o-paid');
    const order = await checkoutService.revertToDraft('o-paid');
    expect(order.status).toBe('paid');
    const row = await orderRepository.findById('o-paid');
    expect(row?.status).toBe('paid');
  });

  it('the reconciler finalizes orders left paid-but-unfiscalized', async () => {
    await seedPaidOrder('o-stranded');
    await orderRepository.markFiscalUnfinalized('o-stranded');

    const count = await offlineFiscalService.reconcileUnfinalizedOrders();
    expect(count).toBe(1);
    const order = await orderRepository.findById('o-stranded');
    expect(order?.fiscal_status).toBe('fiscalized');
    expect(await fiscalRecordRepository.findByOrderId('o-stranded')).not.toBeNull();
  });

  it('drainOnce runs the reconciler before submitting transmissions', async () => {
    await seedPaidOrder('o-drain');
    await orderRepository.markFiscalUnfinalized('o-drain');

    await fiscalTransmissionDrainer.drainOnce();
    const order = await orderRepository.findById('o-drain');
    expect(order?.fiscal_status).toBe('fiscalized');
  });
});

describe('F07 — return records carry the actual refunded amounts', () => {
  it('snapshots refund_amount, quantity and product into the payload', async () => {
    await seedPaidOrder('o1');
    await offlineFiscalService.finalizeSale('o1');
    await seedReturn('ret-amt', 'o1', 40);

    const record = await offlineFiscalService.registerReturn('ret-amt', 'o1');
    const payload = JSON.parse(record.payloadJson) as {
      order?: { total?: number };
      returnDetails?: { refundAmount?: number; quantity?: number; productName?: string };
    };
    expect(payload.order?.total).toBe(40);
    expect(payload.returnDetails?.refundAmount).toBe(40);
    expect(payload.returnDetails?.quantity).toBe(1);
    expect(payload.returnDetails?.productName).toBe('Widget');
  });

  it('rejects an arbitrary return id', async () => {
    await seedPaidOrder('o1');
    await offlineFiscalService.finalizeSale('o1');
    await expect(offlineFiscalService.registerReturn('no-such-return', 'o1')).rejects.toThrow(/no such return/);
  });

  it('rejects a return belonging to a different order', async () => {
    await seedPaidOrder('o1');
    await seedPaidOrder('o2');
    await offlineFiscalService.finalizeSale('o1');
    await offlineFiscalService.finalizeSale('o2');
    await seedReturn('ret-other', 'o2', 10);

    await expect(offlineFiscalService.registerReturn('ret-other', 'o1')).rejects.toThrow(/belongs to order o2/);
  });

  it('is idempotent per return id', async () => {
    await seedPaidOrder('o1');
    await offlineFiscalService.finalizeSale('o1');
    await seedReturn('ret-idem', 'o1', 15);

    const first = await offlineFiscalService.registerReturn('ret-idem', 'o1');
    const second = await offlineFiscalService.registerReturn('ret-idem', 'o1');
    expect(second.id).toBe(first.id);
    const rows = await realDb.getAllAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM fiscal_records WHERE return_id = 'ret-idem'`);
    expect(rows[0].n).toBe(1);
  });
});

describe('F08 — ES serialization dispatches on record type', () => {
  beforeEach(async () => {
    await posConfig.update('fiscalJurisdiction', 'es');
  });

  it('a void enqueues an anulación, not an alta invoice', async () => {
    await seedPaidOrder('o-esv');
    await offlineFiscalService.finalizeSale('o-esv');
    await offlineFiscalService.voidOrder('o-esv', 'mistake');

    const pending = await fiscalRecordRepository.listPendingTransmissions(5);
    expect(pending).toHaveLength(2); // sale alta + anulación
    const anulacion = JSON.parse(pending[1].request ?? '{}') as { op?: string; xml?: string };
    expect(anulacion.op).toBe('anulacion');
    expect(anulacion.xml).toContain('RegistroFacturacionAnulacion');
    expect(anulacion.xml).toContain('NumSerieFacturaAnulada>N17-A-000001<');
    expect(anulacion.xml).not.toContain('TipoFactura');
  });

  it('a z_report is NOT submitted as a sales invoice', async () => {
    await seedPaidOrder('o-esz');
    await offlineFiscalService.finalizeSale('o-esz');
    const z = await offlineFiscalService.closeShift({ shiftId: 'shift-es', orderCount: 1, grossTotal: 120 });
    expect(z.type).toBe('z_report');

    const pending = await fiscalRecordRepository.listPendingTransmissions(5);
    expect(pending).toHaveLength(1); // only the sale's alta
    expect(pending[0].record_id).not.toBe(z.id);
  });
});

describe('F09 — a voided sale can never be re-finalized', () => {
  it('rejects finalize after void and keeps the voided status', async () => {
    await seedPaidOrder('o-v');
    await offlineFiscalService.finalizeSale('o-v');
    await offlineFiscalService.voidOrder('o-v', 'mistake');

    await expect(offlineFiscalService.finalizeSale('o-v')).rejects.toThrow(/voided/);
    const order = await orderRepository.findById('o-v');
    expect(order?.fiscal_status).toBe('voided');
    const rows = await realDb.getAllAsync<{ n: number }>(`SELECT COUNT(*) AS n FROM fiscal_records WHERE order_id = 'o-v'`);
    expect(rows[0].n).toBe(2); // sale + void — no third record
  });

  it('rejects a second invoice when a sale record exists but the status drifted', async () => {
    await seedPaidOrder('o-drift');
    await offlineFiscalService.finalizeSale('o-drift');
    await realDb.runAsync(`UPDATE orders SET fiscal_status = 'unfinalized' WHERE id = 'o-drift'`);

    await expect(offlineFiscalService.finalizeSale('o-drift')).rejects.toThrow(/already has a sale record/);
  });
});

describe('F11 — receipt QR environment and replay', () => {
  it('idempotent re-finalize still returns the record-mode QR', async () => {
    await posConfig.update('fiscalJurisdiction', 'es');
    await posConfig.update('fiscalAuthorityMode', 'record');
    await seedPaidOrder('o-qr');
    const first = await offlineFiscalService.finalizeSale('o-qr');
    const second = await offlineFiscalService.finalizeSale('o-qr');
    expect(first.authorityQr).toContain('ValidarQR');
    expect(second.authorityQr).toBe(first.authorityQr);
  });
});

describe('F12 — z_report snapshot and period lock', () => {
  it('the z_report payload carries the period bounds it closes', async () => {
    await seedPaidOrder('o-p1');
    await seedPaidOrder('o-p2');
    await offlineFiscalService.finalizeSale('o-p1');
    await offlineFiscalService.finalizeSale('o-p2');

    const z = await offlineFiscalService.closeShift({ shiftId: 'sh-1', orderCount: 2, grossTotal: 240 });
    const payload = JSON.parse(z.payloadJson) as {
      period?: { firstSeq: number; lastSeq: number };
      shift?: { orderCount?: number; grossTotal?: number };
    };
    expect(payload.period).toEqual({ firstSeq: 1, lastSeq: 2 });
    expect(payload.shift?.orderCount).toBe(2);
    expect(payload.shift?.grossTotal).toBe(240);
  });

  it('is idempotent per shift', async () => {
    const first = await offlineFiscalService.closeShift({ shiftId: 'sh-idem', orderCount: 0, grossTotal: 0 });
    const second = await offlineFiscalService.closeShift({ shiftId: 'sh-idem', orderCount: 99, grossTotal: 999 });
    expect(second.id).toBe(first.id);
    const rows = await realDb.getAllAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM fiscal_records WHERE type = 'z_report' AND shift_id = 'sh-idem'`
    );
    expect(rows[0].n).toBe(1);
  });

  it('locks a closed shift against new sales records', async () => {
    await keyValueRepository.setObject('current_shift', { id: 'sh-lock', status: 'open' });
    await seedPaidOrder('o-l1');
    const sale = await offlineFiscalService.finalizeSale('o-l1');
    expect(sale.shiftId).toBe('sh-lock');

    await offlineFiscalService.closeShift({ shiftId: 'sh-lock', orderCount: 1, grossTotal: 120 });

    // Shift still open in key-value — the same shift cannot take another sale.
    await seedPaidOrder('o-l2');
    await expect(offlineFiscalService.finalizeSale('o-l2')).rejects.toThrow(/locked/);
    await keyValueRepository.removeItem('current_shift');
  });
});
