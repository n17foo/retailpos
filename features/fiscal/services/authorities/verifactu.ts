import { sha256Hex } from '../../../../shared/utils/crypto';
import type { FiscalRecord } from '../FiscalServiceInterface';

/**
 * Veri*factu (RRSIF, Orden HAC/1177/2024) record builders.
 *
 * The authority's `huella` is its OWN chain: SHA-256 over a fixed
 * pipe-joined field list, feeding `Huella` of the previous record —
 * deliberately separate from our internal prev_hash/hash chain.
 */

export interface VerifactuContext {
  /** Emisor NIF/VAT id — posConfig.fiscalBusinessTaxId. */
  nif: string;
  /** Issuer legal name — store name. */
  issuerName: string;
  /** Previous record's AEAT huella — empty string for the chain's first. */
  prevHuella: string;
  /** Previous record's invoice number + expedition date (encadenamiento block). */
  prevNumSerie?: string;
  prevFecha?: string;
}

export interface VerifactuAltaPayload {
  /** The RegistroFacturacionAlta XML fragment — wrapped in the SOAP envelope by the transport. */
  xml: string;
  /** This record's huella — stored so the next record's encadenamiento can cite it. */
  huella: string;
}

/** Record payload fields the builders need (order totals + timestamps). */
export interface VerifactuRecordContent {
  total: number;
  tax: number;
  subtotal: number;
  createdAt: number;
  /** Expedition date = order paid/creation date. */
  expeditionDate?: number;
  tipoFactura?: string; // F1 default
}

/** XML-escape text interpolated into fiscal documents/envelopes. */
export const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const esc = escapeXml;

const amount = (n: number): string => n.toFixed(2);

export function verifactuFecha(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

/** ISO-8601 with numeric offset — the spec's FechaHoraHusoGenRegistro format. */
export function verifactuFechaHora(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${sign}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

/**
 * Huella = uppercase SHA-256 hex of the pipe-joined field list defined
 * in the spec annex for the 'alta' operation.
 */
export function computeHuella(ctx: VerifactuContext, record: FiscalRecord, content: VerifactuRecordContent): string {
  const fechaHora = verifactuFechaHora(content.createdAt);
  const fields = [
    `IDEmisorFactura=${ctx.nif}`,
    `NumSerieFactura=${record.number}`,
    `FechaExpedicionFactura=${verifactuFecha(content.expeditionDate ?? content.createdAt)}`,
    `TipoFactura=${content.tipoFactura ?? 'F1'}`,
    `CuotaTotal=${amount(content.tax)}`,
    `ImporteTotal=${amount(content.total)}`,
    `Huella=${ctx.prevHuella}`,
    `FechaHoraHusoGenRegistro=${fechaHora}`,
  ];
  return sha256Hex(fields.join('&')).toUpperCase();
}

/** Build the RegistroFacturacionAlta XML for a sale/return/void record. */
export function buildAltaXml(ctx: VerifactuContext, record: FiscalRecord, content: VerifactuRecordContent): VerifactuAltaPayload {
  const huella = computeHuella(ctx, record, content);
  const fecha = verifactuFecha(content.expeditionDate ?? content.createdAt);
  const fechaHora = verifactuFechaHora(content.createdAt);
  const tipo = content.tipoFactura ?? 'F1';

  // First record in the AEAT chain declares itself instead of citing a
  // predecessor.
  const encadenamiento = ctx.prevNumSerie
    ? `<Encadenamiento><RegistroAnterior><IDEmisorFactura>${esc(ctx.nif)}</IDEmisorFactura><NumSerieFactura>${esc(ctx.prevNumSerie)}</NumSerieFactura><FechaExpedicionFactura>${esc(ctx.prevFecha ?? '')}</FechaExpedicionFactura><Huella>${esc(ctx.prevHuella)}</Huella></RegistroAnterior></Encadenamiento>`
    : `<Encadenamiento><PrimerRegistro>S</PrimerRegistro></Encadenamiento>`;

  const xml =
    `<RegistroFacturacionAlta xmlns="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd">` +
    `<IDVersion>1.0</IDVersion>` +
    `<IDFactura><IDEmisorFactura>${esc(ctx.nif)}</IDEmisorFactura><NumSerieFactura>${esc(record.number)}</NumSerieFactura><FechaExpedicionFactura>${esc(fecha)}</FechaExpedicionFactura></IDFactura>` +
    `<NombreRazonEmisor>${esc(ctx.issuerName)}</NombreRazonEmisor>` +
    `<TipoFactura>${tipo}</TipoFactura>` +
    `<DescripcionOperacion>${esc(`Venta ${record.number}`)}</DescripcionOperacion>` +
    `<ImporteTotal>${amount(content.total)}</ImporteTotal>` +
    `<CuotaTotal>${amount(content.tax)}</CuotaTotal>` +
    `<Desglose><DetalleDesglose><Impuesto>01</Impuesto><ClaveRegimen>01</ClaveRegimen><CalificacionOperacion>S1</CalificacionOperacion><BaseImponibleOimporteNoSujeto>${amount(content.subtotal)}</BaseImponibleOimporteNoSujeto><CuotaRepercutida>${amount(content.tax)}</CuotaRepercutida></DetalleDesglose></Desglose>` +
    encadenamiento +
    `<SistemaInformatico><NombreRazon>${esc(ctx.issuerName)}</NombreRazon><NIF>${esc(ctx.nif)}</NIF><NombreSistemaInformatico>RetailPOS</NombreSistemaInformatico><IdSistemaInformatico>RP1</IdSistemaInformatico><Version>1.0</Version><NumeroInstalacion>1</NumeroInstalacion><TipoUsoPosibleSoloVerifactu>S</TipoUsoPosibleSoloVerifactu><TipoUsoPosibleMultiOT>N</TipoUsoPosibleMultiOT><IndicadorMultiplesOT>N</IndicadorMultiplesOT></SistemaInformatico>` +
    `<FechaHoraHusoGenRegistro>${fechaHora}</FechaHoraHusoGenRegistro>` +
    `<TipoHuella>01</TipoHuella>` +
    `<Huella>${huella}</Huella>` +
    `</RegistroFacturacionAlta>`;

  return { xml, huella };
}

/**
 * Cancellation (anulación) record for a void — NOT an alta. It references
 * the original sale's invoice identity (`IDFacturaAnulada`) and uses the
 * anulación huella field names, per the spec's RegistroFacturacionAnulacion
 * schema (F08 — a void must never be submitted as an F1/AN invoice).
 */
export function buildAnulacionXml(
  ctx: VerifactuContext,
  record: FiscalRecord,
  sale: { number: string; createdAt: number }
): VerifactuAltaPayload {
  const fechaHora = verifactuFechaHora(record.createdAt);
  const saleFecha = verifactuFecha(sale.createdAt);
  const huellaFields = [
    `IDEmisorFacturaAnulada=${ctx.nif}`,
    `NumSerieFacturaAnulada=${sale.number}`,
    `FechaExpedicionFacturaAnulada=${saleFecha}`,
    `Huella=${ctx.prevHuella}`,
    `FechaHoraHusoGenRegistro=${fechaHora}`,
  ];
  const huella = sha256Hex(huellaFields.join('&')).toUpperCase();

  const encadenamiento = ctx.prevNumSerie
    ? `<Encadenamiento><RegistroAnterior><IDEmisorFactura>${esc(ctx.nif)}</IDEmisorFactura><NumSerieFactura>${esc(ctx.prevNumSerie)}</NumSerieFactura><FechaExpedicionFactura>${esc(ctx.prevFecha ?? '')}</FechaExpedicionFactura><Huella>${esc(ctx.prevHuella)}</Huella></RegistroAnterior></Encadenamiento>`
    : `<Encadenamiento><PrimerRegistro>S</PrimerRegistro></Encadenamiento>`;

  const xml =
    `<RegistroFacturacionAnulacion xmlns="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd">` +
    `<IDVersion>1.0</IDVersion>` +
    `<IDFactura><IDEmisorFacturaAnulada>${esc(ctx.nif)}</IDEmisorFacturaAnulada><NumSerieFacturaAnulada>${esc(sale.number)}</NumSerieFacturaAnulada><FechaExpedicionFacturaAnulada>${esc(saleFecha)}</FechaExpedicionFacturaAnulada></IDFactura>` +
    encadenamiento +
    `<SistemaInformatico><NombreRazon>${esc(ctx.issuerName)}</NombreRazon><NIF>${esc(ctx.nif)}</NIF><NombreSistemaInformatico>RetailPOS</NombreSistemaInformatico><IdSistemaInformatico>RP1</IdSistemaInformatico><Version>1.0</Version><NumeroInstalacion>1</NumeroInstalacion><TipoUsoPosibleSoloVerifactu>S</TipoUsoPosibleSoloVerifactu><TipoUsoPosibleMultiOT>N</TipoUsoPosibleMultiOT><IndicadorMultiplesOT>N</IndicadorMultiplesOT></SistemaInformatico>` +
    `<FechaHoraHusoGenRegistro>${fechaHora}</FechaHoraHusoGenRegistro>` +
    `<TipoHuella>01</TipoHuella>` +
    `<Huella>${huella}</Huella>` +
    `</RegistroFacturacionAnulacion>`;

  return { xml, huella };
}

/**
 * QR payload for `record` (non-Veri*factu) mode — every receipt must carry
 * this URL as a QR image. Preprod endpoint; swap host for production.
 */
export function buildVerifactuQrUrl(
  ctx: Pick<VerifactuContext, 'nif'>,
  record: FiscalRecord,
  content: VerifactuRecordContent,
  production = false
): string {
  const host = production ? 'https://www2.agenciatributaria.gob.es' : 'https://prewww2.aeat.es';
  const params = new URLSearchParams({
    nif: ctx.nif,
    numserie: record.number,
    fecha: verifactuFecha(content.expeditionDate ?? content.createdAt),
    importe: amount(content.total),
  });
  return `${host}/wlpl/TIKE-CONT/ValidarQR?${params.toString()}`;
}
