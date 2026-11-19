/**
 * Real-SQLite tests for the certified-tier authority path:
 * ES enqueue/QR, DE TSE enqueue, strict IT fail-closed, and the
 * transmission drainer's sent/failed/dead transitions.
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

const aeatSubmit = jest.fn();
jest.mock('./transports/AeatVerifactuTransport', () => ({
  AeatVerifactuTransport: jest.fn().mockImplementation(() => ({ authority: 'aeat', submit: aeatSubmit })),
}));

jest.mock('./authorityCredentials', () => ({
  getFiscalAuthorityCredentials: jest.fn(async () => ({ endpoint: 'https://aeat.test', cert: 'x' })),
}));

import { db } from '../../../shared/utils/db';
import { initializeSchema } from '../../../shared/utils/dbSchema';
import { getFiscalService } from './FiscalServiceFactory';
import { fiscalTransmissionDrainer } from './FiscalTransmissionDrainer';
import { fiscalRecordRepository } from '../repositories/FiscalRecordRepository';
import { orderRepository } from '../../orders-sync/repositories/OrderRepository';
import { posConfig } from '../../platform-clients/services/config/POSConfigService';
import type { CreateOrderInput } from '../../orders-sync/repositories/OrderRepository';

const realDb = db as unknown as SQLiteDatabase;

async function seedPaidOrder(id: string): Promise<void> {
  const input: CreateOrderInput = {
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
  await orderRepository.create(input);
  await orderRepository.updatePayment(id, 'cash', null);
}

beforeEach(async () => {
  jest.clearAllMocks();
  await initializeSchema(realDb);
  for (const table of ['fiscal_transmissions', 'fiscal_records', 'fiscal_chain_state', 'order_items', 'orders']) {
    await realDb.runAsync(`DELETE FROM ${table}`);
  }
  await posConfig.update('fiscalEnabled', true);
  await posConfig.update('fiscalInvoicePrefix', 'N17');
  await posConfig.update('fiscalSeries', 'A');
  await posConfig.update('fiscalAuthorityMode', 'transmit');
  await posConfig.update('fiscalBusinessTaxId', 'B12345678');
  await posConfig.update('fiscalJurisdiction', 'generic');
});

describe('ES Veri*factu adapter', () => {
  beforeEach(async () => {
    await posConfig.update('fiscalJurisdiction', 'es');
  });

  it('transmit mode enqueues an aeat transmission with the alta XML', async () => {
    await seedPaidOrder('o-es-1');
    const record = await getFiscalService().finalizeSale('o-es-1');

    const pending = await fiscalRecordRepository.listPendingTransmissions(5);
    expect(pending).toHaveLength(1);
    expect(pending[0].authority).toBe('aeat');
    expect(pending[0].record_id).toBe(record.id);
    const request = JSON.parse(pending[0].request ?? '{}') as { xml?: string; huella?: string };
    expect(request.xml).toContain('RegistroFacturacionAlta');
    expect(request.huella).toMatch(/^[0-9A-F]{64}$/);
  });

  it('chains the second record to the first huella', async () => {
    await seedPaidOrder('o-es-a');
    await seedPaidOrder('o-es-b');
    await getFiscalService().finalizeSale('o-es-a');
    await getFiscalService().finalizeSale('o-es-b');

    const pending = await fiscalRecordRepository.listPendingTransmissions(5);
    expect(pending).toHaveLength(2);
    const second = JSON.parse(pending[1].request ?? '{}') as { xml?: string };
    expect(second.xml).toContain('RegistroAnterior');
  });

  it('record mode returns the ValidarQR URL instead of transmitting', async () => {
    await posConfig.update('fiscalAuthorityMode', 'record');
    await seedPaidOrder('o-es-2');
    const record = await getFiscalService().finalizeSale('o-es-2');

    expect(record.authorityQr).toContain('ValidarQR');
    expect(record.authorityQr).toContain('N17-A-000001');
    expect(await fiscalRecordRepository.listPendingTransmissions(5)).toHaveLength(0);
  });
});

describe('DE TSE adapter', () => {
  it('enqueues a tse signing request per record', async () => {
    await posConfig.update('fiscalJurisdiction', 'de');
    await seedPaidOrder('o-de-1');
    const record = await getFiscalService().finalizeSale('o-de-1');

    const pending = await fiscalRecordRepository.listPendingTransmissions(5);
    expect(pending).toHaveLength(1);
    expect(pending[0].authority).toBe('tse');
    expect(pending[0].record_id).toBe(record.id);
  });
});

describe('strict jurisdiction ordering', () => {
  it('IT fails before the record commits — order stays unfinalized', async () => {
    await posConfig.update('fiscalJurisdiction', 'it');
    await seedPaidOrder('o-it-1');
    await expect(getFiscalService().finalizeSale('o-it-1')).rejects.toThrow(/'it'/);

    const order = await orderRepository.findById('o-it-1');
    expect(order?.fiscal_status).toBeNull(); // never stamped — stays unfinalized
    expect(order?.fiscal_record_id).toBeNull();
    expect(await fiscalRecordRepository.findByOrderId('o-it-1')).toBeNull();
  });
});

describe('FiscalTransmissionDrainer', () => {
  it('marks a successful submission sent with the authority response', async () => {
    await posConfig.update('fiscalJurisdiction', 'es');
    await seedPaidOrder('o-drain-1');
    await getFiscalService().finalizeSale('o-drain-1');

    aeatSubmit.mockResolvedValue('{"EstadoEnvio":"Correcto"}');
    await fiscalTransmissionDrainer.drainOnce();

    const pending = await fiscalRecordRepository.listPendingTransmissions(5);
    expect(pending).toHaveLength(0);
    const row = await realDb.getFirstAsync<{ status: string; response: string | null; attempts: number }>(
      'SELECT status, response, attempts FROM fiscal_transmissions'
    );
    expect(row?.status).toBe('sent');
    expect(row?.attempts).toBe(1);
    expect(row?.response).toContain('Correcto');
  });

  it('retries failures and dead-letters after the attempt cap', async () => {
    await posConfig.update('fiscalJurisdiction', 'es');
    await seedPaidOrder('o-drain-2');
    await getFiscalService().finalizeSale('o-drain-2');

    aeatSubmit.mockRejectedValue(new Error('aeat 503'));
    await fiscalTransmissionDrainer.drainOnce();
    let row = await realDb.getFirstAsync<{ status: string; attempts: number }>('SELECT status, attempts FROM fiscal_transmissions');
    expect(row?.status).toBe('failed');
    expect(row?.attempts).toBe(1);

    // maxSyncRetries default is 5 — burn through them.
    for (let i = 0; i < 5; i++) {
      await fiscalTransmissionDrainer.drainOnce();
    }
    row = await realDb.getFirstAsync<{ status: string; attempts: number }>('SELECT status, attempts FROM fiscal_transmissions');
    expect(row?.status).toBe('dead');
  });

  it('leaves rows pending when credentials are missing (deferral)', async () => {
    const creds = jest.requireMock('./authorityCredentials') as {
      getFiscalAuthorityCredentials: jest.Mock;
    };
    creds.getFiscalAuthorityCredentials.mockRejectedValueOnce(
      new (
        jest.requireActual('./transports/FiscalAuthorityTransport') as typeof import('./transports/FiscalAuthorityTransport')
      ).FiscalDeferralError('no cert')
    );
    await posConfig.update('fiscalJurisdiction', 'es');
    await seedPaidOrder('o-drain-3');
    await getFiscalService().finalizeSale('o-drain-3');

    await fiscalTransmissionDrainer.drainOnce();
    const row = await realDb.getFirstAsync<{ status: string; attempts: number }>('SELECT status, attempts FROM fiscal_transmissions');
    expect(row?.status).toBe('pending');
    expect(row?.attempts).toBe(0);
  });
});
