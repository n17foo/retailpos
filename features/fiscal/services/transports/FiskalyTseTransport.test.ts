/**
 * F05 regression tests — a TSE signing transaction must reach FINISHED
 * with a signature. An ACTIVE-only response can never be treated as sent.
 */

import { FiskalyTseTransport } from './FiskalyTseTransport';
import type { FiscalTransmissionRow } from '../../repositories/FiscalRecordRepository';

function makeRow(payload: object = {}): FiscalTransmissionRow {
  return {
    id: 'tx-1',
    record_id: 'rec-1',
    authority: 'tse',
    status: 'pending',
    request: JSON.stringify({ order: { total: 12.5, paymentMethod: 'card' }, registerId: 'reg-1', ...payload }),
    response: null,
    attempts: 0,
    created_at: Date.now(),
    sent_at: null,
  };
}

const credentials = { apiKey: 'k', apiSecret: 's', tssId: 'tss-1', endpoint: 'https://fiskaly.test' };

function jsonOk(data: object) {
  return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) };
}

const AUTH_OK = jsonOk({ access_token: 'tok', access_token_expires_at: Date.now() / 1000 + 3600 });
const FINISHED_TX = jsonOk({ state: 'FINISHED', signature: { value: 'sig-base64', counter: 1 } });

describe('FiskalyTseTransport (F05)', () => {
  let transport: FiskalyTseTransport;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    transport = new FiskalyTseTransport();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('sends a FINISHED request after the ACTIVE transaction and returns the signature', async () => {
    fetchMock
      .mockResolvedValueOnce(AUTH_OK) // auth
      .mockResolvedValueOnce(jsonOk({ state: 'ACTIVE' })) // create
      .mockResolvedValueOnce(FINISHED_TX); // finish

    const result = await transport.submit(makeRow(), credentials);
    expect(result).toContain('sig-base64');

    const calls = fetchMock.mock.calls as Array<[string, RequestInit]>;
    const finishCall = calls.find(c => c[0].includes('/tx/') && JSON.parse(String(c[1].body)).state === 'FINISHED');
    expect(finishCall).toBeDefined();
    expect(JSON.parse(String(finishCall![1].body)).tx_revision).toBe(2);
  });

  it('uses NON_CASH payment type for a card sale', async () => {
    fetchMock
      .mockResolvedValueOnce(AUTH_OK)
      .mockResolvedValueOnce(jsonOk({ state: 'ACTIVE' }))
      .mockResolvedValueOnce(FINISHED_TX);
    await transport.submit(makeRow(), credentials);
    const createCall = (fetchMock.mock.calls as Array<[string, RequestInit]>).find(c => c[0].includes('/tx/'));
    expect(String(createCall![1].body)).toContain('"payment_type":"NON_CASH"');
  });

  it('fails when the transaction never reaches FINISHED — nothing is "sent"', async () => {
    fetchMock
      .mockResolvedValueOnce(AUTH_OK)
      .mockResolvedValueOnce(jsonOk({ state: 'ACTIVE' })) // create ok
      .mockResolvedValueOnce(jsonOk({ state: 'ACTIVE' })); // finish returns still-ACTIVE

    await expect(transport.submit(makeRow(), credentials)).rejects.toThrow(/did not reach FINISHED/);
  });

  it('recovers an already-finished transaction on retry (probe GET)', async () => {
    fetchMock
      .mockResolvedValueOnce(AUTH_OK)
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({}) }) // create — tx already exists
      .mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({}) }) // finish — already finished
      .mockResolvedValueOnce(FINISHED_TX); // probe GET

    const result = await transport.submit(makeRow(), credentials);
    expect(result).toContain('sig-base64');

    const probeCall = (fetchMock.mock.calls as Array<[string, RequestInit]>).find(c => c[0].includes('/tx/') && !c[1].body);
    expect(probeCall).toBeDefined();
  });

  it('fails when finish fails and the probe shows an unfinished transaction', async () => {
    fetchMock
      .mockResolvedValueOnce(AUTH_OK)
      .mockResolvedValueOnce(jsonOk({ state: 'ACTIVE' }))
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce(jsonOk({ state: 'ACTIVE' })); // probe — still open

    await expect(transport.submit(makeRow(), credentials)).rejects.toThrow(/finish failed/);
  });

  it('defers when credentials are missing', async () => {
    const { FiscalDeferralError } = jest.requireActual('./FiscalAuthorityTransport') as typeof import('./FiscalAuthorityTransport');
    await expect(transport.submit(makeRow(), null)).rejects.toBeInstanceOf(FiscalDeferralError);
  });
});
