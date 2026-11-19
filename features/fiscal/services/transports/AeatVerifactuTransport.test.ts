/**
 * F06 regression tests — the AEAT transport must parse the SOAP business
 * result, not just the HTTP status: rejections stay retryable, only a
 * confirmed 'Correcto' may be marked sent. Also covers XML escaping in the
 * envelope header and the anulación operation dispatch (F08/F10-adjacent).
 */

jest.mock('../../../platform-clients/services/config/POSConfigService', () => ({
  posConfig: { values: { fiscalBusinessTaxId: 'B12345678', storeName: 'A & B Store' }, load: jest.fn() },
}));

import { AeatVerifactuTransport } from './AeatVerifactuTransport';
import type { FiscalTransmissionRow } from '../../repositories/FiscalRecordRepository';

function makeRow(request: object): FiscalTransmissionRow {
  return {
    id: 'tx-1',
    record_id: 'rec-1',
    authority: 'aeat',
    status: 'pending',
    request: JSON.stringify(request),
    response: null,
    attempts: 0,
    created_at: Date.now(),
    sent_at: null,
  };
}

const credentials = { certificatePem: 'CERT', keyPem: 'KEY', endpoint: 'https://aeat.test/soap' };

function httpOk(body: string) {
  return { ok: true, status: 200, text: async () => body };
}

describe('AeatVerifactuTransport (F06)', () => {
  let transport: AeatVerifactuTransport;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    transport = new AeatVerifactuTransport();
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('rejects a 200 response whose EstadoEnvio is Incorrecto', async () => {
    fetchMock.mockResolvedValue(
      httpOk(`<soap:Body><RespuestaRegFacturacionAlta><EstadoEnvio>Incorrecto</EstadoEnvio>
        <RespuestaLinea><CodigoErrorRegistro>4102</CodigoErrorRegistro>
        <DescripcionErrorRegistro>El XML no cumple el esquema</DescripcionErrorRegistro></RespuestaLinea>
        </RespuestaRegFacturacionAlta></soap:Body>`)
    );

    await expect(transport.submit(makeRow({ xml: '<RegistroFacturacionAlta/>', op: 'alta' }), credentials)).rejects.toThrow(
      /Incorrecto.*4102|4102.*esquema/
    );
  });

  it('rejects a SOAP fault', async () => {
    fetchMock.mockResolvedValue(
      httpOk(
        `<soapenv:Envelope><soapenv:Body><soapenv:Fault><faultcode>soapenv:Server</faultcode><faultstring>internal error</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>`
      )
    );

    await expect(transport.submit(makeRow({ xml: '<x/>' }), credentials)).rejects.toThrow(/SOAP fault.*internal error/);
  });

  it('rejects a 200 response with no business status at all', async () => {
    fetchMock.mockResolvedValue(httpOk('<html><body>proxy login page</body></html>'));
    await expect(transport.submit(makeRow({ xml: '<x/>' }), credentials)).rejects.toThrow(/no EstadoEnvio/);
  });

  it('rejects a per-record rejection even when the envelope is accepted', async () => {
    fetchMock.mockResolvedValue(
      httpOk(`<RespuestaRegFacturacionAlta><EstadoEnvio>Correcto</EstadoEnvio>
        <RespuestaLinea><EstadoRegistro>Rechazado</EstadoRegistro>
        <CodigoErrorRegistro>5000</CodigoErrorRegistro></RespuestaLinea></RespuestaRegFacturacionAlta>`)
    );

    await expect(transport.submit(makeRow({ xml: '<x/>' }), credentials)).rejects.toThrow(/Rechazado/);
  });

  it('returns the response only when EstadoEnvio is Correcto', async () => {
    const body = `<RespuestaRegFacturacionAlta><EstadoEnvio>Correcto</EstadoEnvio><CSV>ABC123</CSV></RespuestaRegFacturacionAlta>`;
    fetchMock.mockResolvedValue(httpOk(body));
    await expect(transport.submit(makeRow({ xml: '<x/>' }), credentials)).resolves.toBe(body);
  });

  it('escapes the merchant name and NIF in the envelope header', async () => {
    fetchMock.mockResolvedValue(httpOk('<RespuestaRegFacturacionAlta><EstadoEnvio>Correcto</EstadoEnvio></RespuestaRegFacturacionAlta>'));
    await transport.submit(makeRow({ xml: '<x/>' }), credentials);
    const sentBody = fetchMock.mock.calls[0][1].body as string;
    expect(sentBody).toContain('<sum1:NombreRazon>A &amp; B Store</sum1:NombreRazon>');
    expect(sentBody).not.toContain('A & B');
  });

  it('wraps anulación payloads in RegFacturacionAnulacion (F08)', async () => {
    fetchMock.mockResolvedValue(
      httpOk('<RespuestaRegFacturacionAnulacion><EstadoEnvio>Correcto</EstadoEnvio></RespuestaRegFacturacionAnulacion>')
    );
    await transport.submit(makeRow({ xml: '<RegistroFacturacionAnulacion/>', op: 'anulacion' }), credentials);
    const sentBody = fetchMock.mock.calls[0][1].body as string;
    expect(sentBody).toContain('<sum:RegFacturacionAnulacion>');
    expect(sentBody).toContain('<sum:RegistroAnulacion>');
    expect(sentBody).not.toContain('sum:RegFacturacionAlta');
  });

  it('defers (not fails) when the certificate is not configured', async () => {
    const { FiscalDeferralError } = jest.requireActual('./FiscalAuthorityTransport') as typeof import('./FiscalAuthorityTransport');
    await expect(transport.submit(makeRow({ xml: '<x/>' }), null)).rejects.toBeInstanceOf(FiscalDeferralError);
  });
});
