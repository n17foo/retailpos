import { posConfig } from '../../../platform-clients/services/config/POSConfigService';
import { FiscalAuthorityTransport, AuthorityCredentials, FiscalDeferralError } from './FiscalAuthorityTransport';
import { escapeXml } from '../authorities/verifactu';
import type { FiscalTransmissionRow } from '../../repositories/FiscalRecordRepository';

const VERIFACTU_PREPROD_ENDPOINT = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP';
const VERIFACTU_ENDPOINT = 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP';

const SUM_NS = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd';
const SUMINFO_NS =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd';

function extractTag(xml: string, name: string): string | undefined {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${name}(?:\\s[^>]*)?>([^<]*)<`));
  return match?.[1]?.trim() || undefined;
}

/**
 * F06 — HTTP 2xx is NOT acceptance. AEAT returns business results inside
 * the SOAP body: EstadoEnvio (envelope-level) and RespuestaLinea per-record
 * EstadoRegistro. Only a confirmed 'Correcto' may be marked sent; faults and
 * rejections throw so the row stays retryable with the error persisted.
 */
function assertAccepted(text: string): void {
  if (/<\w*:?Fault[\s>]|faultcode/i.test(text)) {
    throw new Error(`AEAT SOAP fault: ${extractTag(text, 'faultstring') ?? text.slice(0, 200)}`);
  }
  const estadoEnvio = extractTag(text, 'EstadoEnvio');
  const codigo = extractTag(text, 'CodigoErrorRegistro') ?? extractTag(text, 'CodigoError');
  const descripcion = extractTag(text, 'DescripcionErrorRegistro') ?? extractTag(text, 'DescripcionError');
  const detail = [codigo ? `[${codigo}]` : '', descripcion ?? ''].filter(Boolean).join(' ');
  if (estadoEnvio !== 'Correcto') {
    throw new Error(`AEAT rejected submission (${estadoEnvio ?? 'no EstadoEnvio in response'})${detail ? `: ${detail}` : ''}`);
  }
  const estadoRegistro = extractTag(text, 'EstadoRegistro');
  if (estadoRegistro && estadoRegistro !== 'Correcto' && estadoRegistro !== 'AceptadoConErrores') {
    throw new Error(`AEAT rejected record (${estadoRegistro})${detail ? `: ${detail}` : ''}`);
  }
}

/**
 * AEAT Veri*factu submission — wraps the queued RegistroFacturacionAlta
 * fragment in the RegFacturacionAlta SOAP envelope and POSTs it.
 *
 * Production submission requires the merchant's client certificate
 * (mTLS). React Native's fetch cannot present client certificates — so
 * a standalone register either routes through a local TLS-terminating
 * proxy holding the cert, or the Store API's Go drainer submits (the
 * supported path for certified deployments). Without credentials the
 * row defers rather than burning retries.
 */
export class AeatVerifactuTransport implements FiscalAuthorityTransport {
  readonly authority = 'aeat';

  async submit(row: FiscalTransmissionRow, credentials: AuthorityCredentials | null): Promise<string | null> {
    const request = JSON.parse(row.request ?? '{}') as { xml?: string; op?: string };
    if (!request.xml) {
      throw new Error('AEAT transmission has no request XML');
    }
    const nif = posConfig.values.fiscalBusinessTaxId;
    const issuerName = posConfig.values.storeName ?? 'RetailPOS';
    if (!nif) {
      throw new FiscalDeferralError('fiscalBusinessTaxId (NIF) not configured');
    }
    if (!credentials?.certificatePem) {
      throw new FiscalDeferralError('AEAT client certificate not configured — see fiscal authority credentials');
    }

    const endpoint = credentials.endpoint ?? (__DEV__ ? VERIFACTU_PREPROD_ENDPOINT : VERIFACTU_ENDPOINT);
    const isAnulacion = request.op === 'anulacion';
    const operation = isAnulacion ? 'sum:RegFacturacionAnulacion' : 'sum:RegFacturacionAlta';
    const recordTag = isAnulacion ? 'sum:RegistroAnulacion' : 'sum:RegistroFactura';
    const body =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sum="${SUM_NS}" xmlns:sum1="${SUMINFO_NS}">` +
      `<soapenv:Header/>` +
      `<soapenv:Body><${operation}>` +
      `<sum:Cabecera><sum1:ObligadoEmision><sum1:NombreRazon>${escapeXml(issuerName)}</sum1:NombreRazon><sum1:NIF>${escapeXml(nif)}</sum1:NIF></sum1:ObligadoEmision></sum:Cabecera>` +
      `<${recordTag}>${request.xml}</${recordTag}>` +
      `</${operation}></soapenv:Body></soapenv:Envelope>`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        SOAPAction: '',
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`AEAT submission failed: HTTP ${response.status}`);
    }
    const text = await response.text();
    assertAccepted(text);
    return text;
  }
}
