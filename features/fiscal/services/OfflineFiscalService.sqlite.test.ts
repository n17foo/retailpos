/**
 * Real-SQLite tests for the offline fiscal chain — the expo-sqlite mock is
 * replaced by node:sqlite so sequence allocation, hash chaining, order
 * stamping and tamper detection run against the actual schema.
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

import { db } from '../../../shared/utils/db';
import { initializeSchema } from '../../../shared/utils/dbSchema';
import { offlineFiscalService } from './OfflineFiscalService';
import { orderRepository } from '../../orders-sync/repositories/OrderRepository';
import { posConfig } from '../../platform-clients/services/config/POSConfigService';
import type { CreateOrderInput } from '../../orders-sync/repositories/OrderRepository';

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

beforeEach(async () => {
  await initializeSchema(realDb);
  for (const table of ['fiscal_records', 'fiscal_chain_state', 'fiscal_transmissions', 'orders', 'order_items']) {
    await realDb.runAsync(`DELETE FROM ${table}`);
  }
  await posConfig.update('fiscalEnabled', true);
  await posConfig.update('fiscalJurisdiction', 'generic');
  await posConfig.update('fiscalInvoicePrefix', 'N17');
  await posConfig.update('fiscalSeries', 'A');
});

describe('OfflineFiscalService on real SQLite', () => {
  it('allocates a chained sale record and stamps the order atomically', async () => {
    await seedPaidOrder('o1');
    const rec = await offlineFiscalService.finalizeSale('o1');

    expect(rec.seq).toBe(1);
    expect(rec.number).toBe('N17-A-000001');
    expect(rec.prevHash).toBe('GENESIS');
    expect(rec.type).toBe('sale');

    const order = await orderRepository.findById('o1');
    expect(order?.fiscal_status).toBe('fiscalized');
    expect(order?.fiscal_number).toBe('N17-A-000001');
    expect(order?.fiscal_record_id).toBe(rec.id);
  });

  it('is idempotent — a retried finalize returns the same record', async () => {
    await seedPaidOrder('o1');
    const first = await offlineFiscalService.finalizeSale('o1');
    const second = await offlineFiscalService.finalizeSale('o1');
    expect(second.id).toBe(first.id);
    expect(second.seq).toBe(first.seq);
    expect(await offlineFiscalService.verifyChain()).toEqual({ ok: true, checked: 1 });
  });

  it('chains consecutive records and verifies end-to-end', async () => {
    await seedPaidOrder('o1');
    await seedPaidOrder('o2');
    const r1 = await offlineFiscalService.finalizeSale('o1');
    const r2 = await offlineFiscalService.finalizeSale('o2');

    expect(r2.seq).toBe(2);
    expect(r2.prevHash).toBe(r1.hash);
    expect(await offlineFiscalService.verifyChain()).toEqual({ ok: true, checked: 2 });
  });

  it('rejects finalize on an unpaid order — no record, no stamp', async () => {
    await orderRepository.create(makeInput('draft-1'));
    await expect(offlineFiscalService.finalizeSale('draft-1')).rejects.toThrow(/status/);
    const order = await orderRepository.findById('draft-1');
    expect(order?.fiscal_status ?? null).toBeNull();
  });

  it('voids a fiscalized order as a new chained record — never a delete', async () => {
    await seedPaidOrder('o1');
    const sale = await offlineFiscalService.finalizeSale('o1');
    const voidRec = await offlineFiscalService.voidOrder('o1', 'wrong item');

    expect(voidRec.type).toBe('void');
    expect(voidRec.seq).toBe(2);
    expect(voidRec.prevHash).toBe(sale.hash);

    const order = await orderRepository.findById('o1');
    expect(order?.fiscal_status).toBe('voided');
    // The original sale record is untouched — append-only ledger.
    const original = await offlineFiscalService.getRecord('o1');
    expect(original?.id).toBe(sale.id);
  });

  it('rejects voiding an unfiscalized order', async () => {
    await seedPaidOrder('o1');
    await expect(offlineFiscalService.voidOrder('o1', 'x')).rejects.toThrow(/not fiscalized/);
  });

  it('refuses to delete a fiscalized order', async () => {
    await seedPaidOrder('o1');
    await offlineFiscalService.finalizeSale('o1');
    await expect(orderRepository.delete('o1')).rejects.toThrow(/fiscal/);
    // Draft deletes still work — only fiscalized rows are protected.
    await orderRepository.create(makeInput('d1'));
    await expect(orderRepository.delete('d1')).resolves.toBeUndefined();
  });

  it('registers a return as a chained record linked to the original', async () => {
    await seedPaidOrder('o1');
    await offlineFiscalService.finalizeSale('o1');
    const ret = await offlineFiscalService.registerReturn('ret-1', 'o1');
    expect(ret.type).toBe('return');
    expect(ret.returnId).toBe('ret-1');
    expect(ret.orderId).toBe('o1');
  });

  it('detects tampering — mutating a stored payload breaks the chain', async () => {
    await seedPaidOrder('o1');
    await seedPaidOrder('o2');
    await offlineFiscalService.finalizeSale('o1');
    await offlineFiscalService.finalizeSale('o2');

    await realDb.runAsync(`UPDATE fiscal_records SET payload_json = '{"tampered":true}' WHERE seq = 1`);

    const v = await offlineFiscalService.verifyChain();
    expect(v.ok).toBe(false);
    expect(v.firstDivergenceSeq).toBeLessThanOrEqual(2);
  });

  it('chains a z_report record on shift close', async () => {
    const z = await offlineFiscalService.closeShift({ shiftId: 'shift-1', orderCount: 7, grossTotal: 840 });
    expect(z.type).toBe('z_report');
    expect(z.shiftId).toBe('shift-1');
    expect(z.seq).toBe(1);
  });
});
