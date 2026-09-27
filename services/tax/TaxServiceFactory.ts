import { ECommercePlatform } from '../../utils/platforms';
import { TaxServiceInterface } from './TaxServiceInterface';
import { TaxStrategyConfig } from './types';
import { OfflineTaxStrategy } from './platforms/OfflineTaxStrategy';
import { ShopifyTaxStrategy } from './platforms/ShopifyTaxStrategy';
import { WooCommerceTaxStrategy } from './platforms/WooCommerceTaxStrategy';
import { BigCommerceTaxStrategy } from './platforms/BigCommerceTaxStrategy';
import { MagentoTaxStrategy } from './platforms/MagentoTaxStrategy';
import { SyliusTaxStrategy } from './platforms/SyliusTaxStrategy';
import { WixTaxStrategy } from './platforms/WixTaxStrategy';
import { PrestaShopTaxStrategy } from './platforms/PrestaShopTaxStrategy';
import { SquarespaceTaxStrategy } from './platforms/SquarespaceTaxStrategy';
import { CommercefullTaxStrategy } from './platforms/CommercefullTaxStrategy';
import { LoggerFactory } from '../logger/LoggerFactory';

const logger = LoggerFactory.getInstance().createLogger('TaxServiceFactory');

/**
 * Tax Service Factory
 *
 * Singleton factory that manages platform-specific tax strategies.
 * Spec: docs/specs/catalog/products.md section 9.1
 */
export class TaxServiceFactory {
  private static instance: TaxServiceFactory;
  private strategies: Map<ECommercePlatform, TaxServiceInterface>;
  private fallbackStrategy: TaxServiceInterface;

  private constructor() {
    this.strategies = new Map();
    this.fallbackStrategy = new OfflineTaxStrategy();
    this.registerStrategies();
  }

  /**
   * Get singleton instance
   * Spec requirement 9.1.1
   */
  static getInstance(): TaxServiceFactory {
    if (!TaxServiceFactory.instance) {
      TaxServiceFactory.instance = new TaxServiceFactory();
    }
    return TaxServiceFactory.instance;
  }

  /**
   * Register all platform strategies
   * Spec requirement 9.1.1: One strategy per platform
   */
  private registerStrategies(): void {
    this.strategies.set(ECommercePlatform.OFFLINE, new OfflineTaxStrategy());
    this.strategies.set(ECommercePlatform.SHOPIFY, new ShopifyTaxStrategy());
    this.strategies.set(ECommercePlatform.WOOCOMMERCE, new WooCommerceTaxStrategy());
    this.strategies.set(ECommercePlatform.BIGCOMMERCE, new BigCommerceTaxStrategy());
    this.strategies.set(ECommercePlatform.MAGENTO, new MagentoTaxStrategy());
    this.strategies.set(ECommercePlatform.SYLIUS, new SyliusTaxStrategy());
    this.strategies.set(ECommercePlatform.WIX, new WixTaxStrategy());
    this.strategies.set(ECommercePlatform.PRESTASHOP, new PrestaShopTaxStrategy());
    this.strategies.set(ECommercePlatform.SQUARESPACE, new SquarespaceTaxStrategy());
    this.strategies.set(ECommercePlatform.COMMERCEFULL, new CommercefullTaxStrategy());

    logger.info({ message: 'Tax strategies registered', count: this.strategies.size });
  }

  /**
   * Get tax service for a platform
   * Spec requirement 9.1.2, 9.1.3
   *
   * @param platform - E-commerce platform
   * @returns Tax service interface
   */
  getService(platform: ECommercePlatform): TaxServiceInterface {
    const strategy = this.strategies.get(platform);

    if (!strategy) {
      logger.warn({ message: 'Tax strategy not found, using offline fallback', platform });
      return this.fallbackStrategy;
    }

    return strategy;
  }

  /**
   * Configure a platform strategy with credentials
   * Spec requirement 9.1.4
   *
   * @param platform - E-commerce platform
   * @param config - Platform configuration
   */
  configureService(platform: ECommercePlatform, config: TaxStrategyConfig): void {
    const strategy = this.strategies.get(platform);

    if (!strategy) {
      logger.warn({ message: 'Cannot configure unknown tax strategy', platform });
      return;
    }

    strategy.configure(config);
    logger.debug({ message: 'Tax strategy configured', platform });
  }

  /**
   * Get all registered platforms
   */
  getRegisteredPlatforms(): ECommercePlatform[] {
    return Array.from(this.strategies.keys());
  }
}
