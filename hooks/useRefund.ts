import { useState, useEffect, useCallback } from 'react';
import { RefundServiceFactory } from '../services/refund/refundServiceFactory';
import { PlatformServiceRegistry } from '../services/platform/PlatformServiceRegistry';
import { RefundData, RefundResult, RefundRecord } from '../services/refund/refundServiceInterface';
import { useLogger } from '../hooks/useLogger';
import { ECommercePlatform } from '../utils/platforms';

/**
 * Hook for refund operations in the POS system
 * Provides methods for processing refunds and accessing refund history
 */
export function useRefund(platform?: ECommercePlatform) {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const logger = useLogger('useRefund');

  // Initialize the refund service
  useEffect(() => {
    async function initRefundService() {
      try {
        setIsLoading(true);
        setError(null);

        const factory = RefundServiceFactory.getInstance();
        const initialized = await factory.initialize();

        setIsInitialized(initialized);
        if (!initialized) {
          setError('Failed to initialize refund service');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize refund service';
        logger.error({ message: 'Failed to initialize refund service' }, err instanceof Error ? err : new Error(errorMessage));
        setError(errorMessage);
        setIsInitialized(false);
      } finally {
        setIsLoading(false);
      }
    }

    initRefundService();
  }, []);

  /**
   * Process a refund for an e-commerce order
   */
  const processEcommerceRefund = useCallback(
    async (orderId: string, refundData: RefundData): Promise<RefundResult> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!isInitialized) {
          logger.warn('Attempting to process e-commerce refund with uninitialized service');
          throw new Error('Refund service not initialized');
        }

        logger.info(`Processing e-commerce refund for order: ${orderId}`);

        const registry = PlatformServiceRegistry.getInstance();
        const refundService = registry.getRefundService(platform || ECommercePlatform.OFFLINE);
        const result = await refundService.processEcommerceRefund(orderId, refundData);

        if (!result.success) {
          const errorMessage = result.error || 'Failed to process e-commerce refund';
          logger.error({ message: `E-commerce refund failed: ${errorMessage}` });
          setError(errorMessage);
        } else {
          logger.info(`Successfully processed e-commerce refund for order: ${orderId}`);
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to process e-commerce refund';
        logger.error(
          { message: `Error processing e-commerce refund for order: ${orderId}` },
          err instanceof Error ? err : new Error(errorMessage)
        );
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          timestamp: new Date(),
        };
      } finally {
        setIsLoading(false);
      }
    },
    [isInitialized]
  );

  /**
   * Process a refund for a payment transaction
   */
  const processPaymentRefund = useCallback(
    async (transactionId: string, amount: number, reason?: string): Promise<RefundResult> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!isInitialized) {
          logger.warn('Attempting to process payment refund with uninitialized service');
          throw new Error('Refund service not initialized');
        }

        logger.info(`Processing payment refund for transaction: ${transactionId}`);

        const registry = PlatformServiceRegistry.getInstance();
        const refundService = registry.getRefundService(platform || ECommercePlatform.OFFLINE);
        const result = await refundService.processPaymentRefund(transactionId, amount, reason);

        if (!result.success) {
          const errorMessage = result.error || 'Failed to process payment refund';
          logger.error({ message: `Payment refund failed: ${errorMessage}` });
          setError(errorMessage);
        } else {
          logger.info(`Successfully processed payment refund for transaction: ${transactionId}`);
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to process payment refund';
        logger.error(
          { message: `Error processing payment refund for transaction: ${transactionId}` },
          err instanceof Error ? err : new Error(errorMessage)
        );
        setError(errorMessage);
        return {
          success: false,
          error: errorMessage,
          timestamp: new Date(),
        };
      } finally {
        setIsLoading(false);
      }
    },
    [isInitialized]
  );

  /**
   * Get refund history for an order
   */
  const getRefundHistory = useCallback(
    async (orderId: string): Promise<RefundRecord[]> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!isInitialized) {
          logger.warn('Attempting to get refund history with uninitialized service');
          throw new Error('Refund service not initialized');
        }

        logger.info(`Retrieving refund history for order: ${orderId}`);

        const registry = PlatformServiceRegistry.getInstance();
        const refundService = registry.getRefundService(platform || ECommercePlatform.OFFLINE);
        return await refundService.getRefundHistory(orderId);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get refund history';
        logger.error(
          { message: `Error retrieving refund history for order: ${orderId}` },
          err instanceof Error ? err : new Error(errorMessage)
        );
        setError(errorMessage);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [isInitialized]
  );

  return {
    isInitialized,
    isLoading,
    error,
    processEcommerceRefund,
    processPaymentRefund,
    getRefundHistory,
  };
}
