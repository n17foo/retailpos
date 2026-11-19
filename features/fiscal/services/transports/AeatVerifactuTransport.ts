import { posConfig } from '../../../platform-clients/services/config/POSConfigService';
import { FiscalAuthorityTransport, AuthorityCredentials, FiscalDeferralError } from './FiscalAuthorityTransport';
import type { FiscalTransmissionRow } from '../../repositories/FiscalRecordRepository';

const VERIFACTU_PREPROD_ENDPOINT = 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP';
const VERIFACTU_ENDPOINT = 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP';

const SUM_NS = 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd';
const SUMINFO_NS =
  'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd';

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
    const request = JSON.parse(row.request ?? '{}') as { xml?: string };
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
    const body =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sum="${SUM_NS}" xmlns:sum1="${SUMINFO_NS}">` +
      `<soapenv:Header/>` +
      `<soapenv:Body><sum:RegFacturacionAlta>` +
      `<sum:Cabecera><sum1:ObligadoEmision><sum1:NombreRazon>${issuerName}</sum1:NombreRazon><sum1:NIF>${nif}</sum1:NIF></sum1:ObligadoEmision></sum:Cabecera>` +
      `<sum:RegistroFactura>${request.xml}</sum:RegistroFactura>` +
      `</sum:RegFacturacionAlta></soapenv:Body></soapenv:Envelope>`;

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
    return response.text();
  }
}
