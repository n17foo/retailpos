import { buildAltaXml, buildAnulacionXml, buildVerifactuQrUrl, computeHuella, verifactuFecha, VerifactuContext } from './verifactu';
import type { FiscalRecord } from '../FiscalServiceInterface';

const ctx: VerifactuContext = {
  nif: 'B12345678',
  issuerName: 'Test Store SL',
  prevHuella: '',
};

const record: FiscalRecord = {
  id: 'frec-1',
  chainId: 'store',
  seq: 1,
  number: 'N17-A-000001',
  type: 'sale',
  orderId: 'ord-1',
  returnId: null,
  shiftId: null,
  registerId: null,
  payloadJson: '{}',
  prevHash: 'GENESIS',
  hash: 'abc',
  createdAt: Date.UTC(2025, 0, 15, 10, 30, 0), // 15-01-2025
};

const content = { total: 121, tax: 21, subtotal: 100, createdAt: record.createdAt };

describe('verifactu builders', () => {
  it('formats the expedition date dd-mm-yyyy', () => {
    expect(verifactuFecha(record.createdAt)).toBe('15-01-2025');
  });

  it('computes a deterministic uppercase-hex huella', () => {
    const h1 = computeHuella(ctx, record, content);
    const h2 = computeHuella(ctx, record, content);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[0-9A-F]{64}$/);
  });

  it('changes the huella when the previous huella changes (encadenamiento)', () => {
    const chained = computeHuella({ ...ctx, prevHuella: 'DEADBEEF' }, record, content);
    expect(chained).not.toBe(computeHuella(ctx, record, content));
  });

  it('declares PrimerRegistro for the chain head', () => {
    const { xml } = buildAltaXml(ctx, record, content);
    expect(xml).toContain('<PrimerRegistro>S</PrimerRegistro>');
    expect(xml).not.toContain('RegistroAnterior');
  });

  it('cites the previous record in RegistroAnterior when chained', () => {
    const { xml } = buildAltaXml({ ...ctx, prevHuella: 'AABB', prevNumSerie: 'N17-A-000000', prevFecha: '14-01-2025' }, record, content);
    expect(xml).toContain('<RegistroAnterior>');
    expect(xml).toContain('<NumSerieFactura>N17-A-000000</NumSerieFactura>');
    expect(xml).toContain('<Huella>AABB</Huella>');
  });

  it('embeds the computed huella and the emisor in the XML', () => {
    const { xml, huella } = buildAltaXml(ctx, record, content);
    expect(xml).toContain(`<Huella>${huella}</Huella>`);
    expect(xml).toContain('<IDEmisorFactura>B12345678</IDEmisorFactura>');
    expect(xml).toContain('<NumSerieFactura>N17-A-000001</NumSerieFactura>');
    expect(xml).toContain('<ImporteTotal>121.00</ImporteTotal>');
    expect(xml).toContain('<CuotaTotal>21.00</CuotaTotal>');
    expect(xml).toContain('<TipoFactura>F1</TipoFactura>');
  });

  it('escapes XML-unsafe characters in issuer data', () => {
    const { xml } = buildAltaXml({ ...ctx, issuerName: 'A & B <Sons>' }, record, content);
    expect(xml).toContain('A &amp; B &lt;Sons&gt;');
  });

  it('builds the ValidarQR URL with the invoice identity', () => {
    const url = buildVerifactuQrUrl(ctx, record, content);
    expect(url).toContain('prewww2.aeat.es');
    expect(url).toContain(encodeURIComponent('B12345678'));
    expect(url).toContain('N17-A-000001');
    expect(url).toContain('121');
  });

  it('uses the production AEAT host when production is selected (F11)', () => {
    const url = buildVerifactuQrUrl(ctx, record, content, true);
    expect(url).toContain('www2.agenciatributaria.gob.es');
    expect(url).not.toContain('prewww2');
  });

  it('serializes a void as an anulación referencing the original invoice (F08)', () => {
    const { xml, huella } = buildAnulacionXml(ctx, record, { number: 'N17-A-000001', createdAt: record.createdAt });
    expect(xml).toContain('RegistroFacturacionAnulacion');
    expect(xml).toContain('<NumSerieFacturaAnulada>N17-A-000001</NumSerieFacturaAnulada>');
    expect(xml).not.toContain('TipoFactura');
    expect(huella).toMatch(/^[0-9A-F]{64}$/);
  });
});
