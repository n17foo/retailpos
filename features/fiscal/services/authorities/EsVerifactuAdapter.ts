import { fiscalRecordRepository } from '../../repositories/FiscalRecordRepository';
import { generateUUID } from '../../../../shared/utils/uuid';
import { posConfig } from '../../../platform-clients/services/config/POSConfigService';
import type { FiscalAuthorityAdapter, FiscalAuthorityOutcome } from './FiscalAuthorityAdapter';
import type { FiscalJurisdiction, FiscalRecord } from '../FiscalServiceInterface';
import { buildAltaXml, buildAnulacionXml, buildVerifactuQrUrl, VerifactuContext, VerifactuRecordContent } from './verifactu';

/**
 * Spain — Veri*factu (RRSIF). Two legal modes selected by
 * `fiscalAuthorityMode`:
 *  - 'transmit' (default): each record's RegistroFacturacionAlta XML is
 *    enqueued to the AEAT outbox (`fiscal_transmissions`, authority
 *    'aeat') — the drainer submits it; offline selling keeps the record
 *    and retransmits later.
 *  - 'record': nothing is transmitted; every receipt must carry the
 *    ValidarQR URL (`receiptQrData` supplies the payload).
 */
export class EsVerifactuAdapter implements FiscalAuthorityAdapter {
  readonly jurisdiction: FiscalJurisdiction = 'es';
  private repo = fiscalRecordRepository;

  async onRecord(record: FiscalRecord): Promise<FiscalAuthorityOutcome | undefined> {
    if ((posConfig.values.fiscalAuthorityMode ?? 'transmit') !== 'transmit') {
      return this.receiptOutcome(record); // record-only mode — QR on the receipt is the obligation
    }
    const ctx = await this.context(record);
    switch (record.type) {
      case 'sale':
      case 'return': {
        const alta = buildAltaXml(ctx, record, this.content(record));
        await this.repo.enqueueTransmission(generateUUID(), record.id, 'aeat', JSON.stringify({ ...alta, op: 'alta' }));
        return undefined;
      }
      case 'void':
        return this.enqueueAnulacion(ctx, record);
      case 'z_report':
        // Internal closure event — not an invoice. Submitting it as an F1
        // alta would report phantom zero-total sales to AEAT (F08).
        return undefined;
    }
  }

  /**
   * A void is a RegistroFacturacionAnulacion referencing the ORIGINAL sale
   * invoice — never an alta with TipoFactura=AN (F08).
   */
  private async enqueueAnulacion(ctx: VerifactuContext, record: FiscalRecord): Promise<undefined> {
    const sale = record.orderId ? await this.repo.findByOrderId(record.orderId) : null;
    if (!sale) {
      throw new Error(`Cannot submit anulación for record ${record.number} — the original sale record is missing`);
    }
    const saleCreatedAt = this.contentFromPayload(sale.payload_json).createdAt ?? sale.created_at;
    const anulacion = buildAnulacionXml(ctx, record, { number: sale.number, createdAt: saleCreatedAt });
    await this.repo.enqueueTransmission(generateUUID(), record.id, 'aeat', JSON.stringify({ ...anulacion, op: 'anulacion' }));
    return undefined;
  }

  /**
   * Receipt artifact — side-effect-free, so client-mode registers can
   * call it too (authority submission is server-owned there).
   */
  receiptOutcome(record: FiscalRecord): FiscalAuthorityOutcome | undefined {
    if ((posConfig.values.fiscalAuthorityMode ?? 'transmit') !== 'record') {
      return undefined;
    }
    const nif = posConfig.values.fiscalBusinessTaxId;
    if (!nif) {
      throw new Error('fiscalBusinessTaxId (NIF) is required for Veri*factu receipts');
    }
    return { receiptQrUrl: buildVerifactuQrUrl({ nif }, record, this.content(record)) };
  }

  private async context(record: FiscalRecord): Promise<VerifactuContext> {
    const nif = posConfig.values.fiscalBusinessTaxId;
    if (!nif) {
      throw new Error('fiscalBusinessTaxId (NIF) is required for Veri*factu transmission');
    }

    // AEAT encadenamiento cites the previous record's huella — kept in the
    // previous transmission's request payload (built at enqueue time).
    const prevTx = await this.repo.latestChainTransmission(record.chainId, 'aeat');
    if (prevTx?.request) {
      const prev = JSON.parse(prevTx.request) as { huella?: string };
      const prevRecord = await this.repo.findById(prevTx.record_id);
      if (prev.huella && prevRecord) {
        const prevContent = this.contentFromPayload(prevRecord.payload_json);
        return {
          nif,
          issuerName: posConfig.values.storeName ?? 'RetailPOS',
          prevHuella: prev.huella,
          prevNumSerie: prevRecord.number,
          prevFecha: this.fecha(prevContent.createdAt ?? prevRecord.created_at),
        };
      }
    }
    return { nif, issuerName: posConfig.values.storeName ?? 'RetailPOS', prevHuella: '' };
  }

  private fecha(ts: number): string {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  }

  private content(record: FiscalRecord): VerifactuRecordContent {
    const payload = this.contentFromPayload(record.payloadJson);
    return {
      total: payload.order?.total ?? 0,
      tax: payload.order?.tax ?? 0,
      subtotal: payload.order?.subtotal ?? 0,
      createdAt: payload.createdAt ?? record.createdAt,
      tipoFactura: record.type === 'return' ? 'R1' : record.type === 'void' ? 'AN' : 'F1',
    };
  }

  private contentFromPayload(payloadJson: string): { createdAt?: number; order?: { total: number; tax: number; subtotal: number } } {
    try {
      return JSON.parse(payloadJson) as { createdAt?: number; order?: { total: number; tax: number; subtotal: number } };
    } catch {
      return {};
    }
  }
}
