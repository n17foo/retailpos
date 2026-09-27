import { ECommercePlatform } from '../../../utils/platforms';
import { BaseTaxStrategy } from '../BaseTaxStrategy';
import { NormalisedTaxCode } from '../types';
import { LoggerFactory } from '../../logger/LoggerFactory';

const logger = LoggerFactory.getInstance().createLogger('CommercefullTaxStrategy');

/**
 * Commercefull Tax Strategy
 *
 * Supports inline rate parsing from tax code format: "code:type:rate"
 * Example: "standard:inclusive:20" → 20% inclusive tax
 * Spec: section 9.5, 9.7.4 - Inline rate parsing
 */
export class CommercefullTaxStrategy extends BaseTaxStrategy {
  constructor() {
    super(ECommercePlatform.COMMERCEFULL);
  }

  protected normaliseTaxCode(taxCode?: string): NormalisedTaxCode | null {
    if (!taxCode) return null;

    // Check for inline format: "code:type:rate"
    const parts = taxCode.split(':');

    if (parts.length === 3) {
      const [code, type] = parts;
      const canonical = code.toLowerCase().trim();

      // Validate type
      if (type !== 'inclusive' && type !== 'exclusive' && type !== 'exempt') {
        logger.warn({ message: 'Invalid tax type in Commercefull tax code', taxCode, type });
        return super.normaliseTaxCode(taxCode);
      }

      return {
        canonical,
        type: type as 'inclusive' | 'exclusive' | 'exempt',
        label: `${code} (${type})`,
      };
    }

    // Fallback to base normalisation
    return super.normaliseTaxCode(taxCode);
  }

  protected async fetchPlatformRate(taxCode: string): Promise<number | null> {
    // Parse inline rate from format: "code:type:rate"
    const parts = taxCode.split(':');

    if (parts.length === 3) {
      const rateStr = parts[2];
      const rate = parseFloat(rateStr);

      if (isNaN(rate)) {
        logger.warn({ message: 'Invalid rate in Commercefull tax code', taxCode, rateStr });
        return null;
      }

      // Convert percentage to decimal if needed (assume percentage if > 1)
      const normalizedRate = rate > 1 ? rate / 100 : rate;

      logger.debug({ message: 'Parsed inline Commercefull tax rate', taxCode, rate: normalizedRate });
      return normalizedRate;
    }

    return null;
  }
}
