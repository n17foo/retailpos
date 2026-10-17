import { useState, useEffect, useCallback } from 'react';
import { returnService, RefundData, RefundResult, RefundRecord } from '../services/refunds/RefundService';
import { useLogger } from '../../../shared/hooks/useLogger';
import { ECommercePlatform } from '../../../shared/utils/platforms';
import { useManagerApproval } from '../../authentication/hooks/useManagerApproval';

/**
 * Hook for return and refund operations in the POS system.
 * Uses the unified ReturnService which handles both returns and refunds.
 */
export function useRefund(platform?: ECommercePlatform) {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const logger = useLogger('useRefund');
  const { requestApproval } = useManagerApproval();

  // Initialize the refund subsystem within ReturnService
  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        setError(null);

        const initialized = await returnService.initializeRefundService();

        setIsInitialized(initialized);
        if (!initialized) {
          setError('Failed to initialize returns service');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize returns service';
        logger.error({ message: 'Failed to initialize returns service' }, err instanceof Error ? err : new Error(errorMessage));
        setError(errorMessage);
        setIsInitialized(false);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [logger]);

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
          throw new Error('Returns service not initialized');
        }

        // Request manager approval for all refunds
        logger.info(`Requesting manager approval for refund on order: ${orderId}`);
        const approved = await requestApproval('refund:process');
        if (!approved) {
          logger.warn(`Manager approval denied for refund on order: ${orderId}`);
          setError('Manager approval required to process refunds');
          return {
            success: false,
            error: 'Manager approval required to process refunds',
            timestamp: new Date(),
          };
        }

        logger.info(`Processing e-commerce refund for order: ${orderId}`);

        const result = await returnService.processRefund(orderId, refundData, platform);

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
    [isInitialized, platform, logger, requestApproval]
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
          throw new Error('Returns service not initialized');
        }

        // Request manager approval for all refunds
        logger.info(`Requesting manager approval for payment refund on transaction: ${transactionId}`);
        const approved = await requestApproval('refund:process');
        if (!approved) {
          logger.warn(`Manager approval denied for payment refund on transaction: ${transactionId}`);
          setError('Manager approval required to process refunds');
          return {
            success: false,
            error: 'Manager approval required to process refunds',
            timestamp: new Date(),
          };
        }

        logger.info(`Processing payment refund for transaction: ${transactionId}`);

        const result = await returnService.processPaymentRefund(transactionId, amount, reason);

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
    [isInitialized, logger, requestApproval]
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
          throw new Error('Returns service not initialized');
        }

        logger.info(`Retrieving refund history for order: ${orderId}`);

        return await returnService.getRefundHistory(orderId, platform);
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
    [isInitialized, platform, logger]
  );

  /**
   * Process a return with optional refund
   */
  const processReturn = useCallback(
    async (input: {
      orderId: string;
      items: {
        orderItemId?: string;
        productId: string;
        variantId?: string;
        productName: string;
        quantity: number;
        refundAmount: number;
        reason?: string;
        restock?: boolean;
      }[];
      processedBy?: string;
      issueRefund?: boolean;
      platform?: ECommercePlatform;
    }): Promise<{ success: boolean; returnIds: string[]; totalRefund: number; refundId?: string; error?: string }> => {
      try {
        setIsLoading(true);
        setError(null);

        if (!isInitialized) {
          logger.warn('Attempting to process return with uninitialized service');
          throw new Error('Returns service not initialized');
        }

        // Request manager approval if issuing a refund
        if (input.issueRefund) {
          logger.info(`Requesting manager approval for return with refund on order: ${input.orderId}`);
          const approved = await requestApproval('refund:process');
          if (!approved) {
            logger.warn(`Manager approval denied for return with refund on order: ${input.orderId}`);
            setError('Manager approval required to process refunds');
            return {
              success: false,
              returnIds: [],
              totalRefund: 0,
              error: 'Manager approval required to process refunds',
            };
          }
        }

        logger.info(`Processing return for order: ${input.orderId}`);

        const result = await returnService.processReturn(input);

        if (!result.success) {
          const errorMessage = result.error || 'Failed to process return';
          logger.error({ message: `Return processing failed: ${errorMessage}` });
          setError(errorMessage);
        } else {
          logger.info(`Successfully processed return for order: ${input.orderId}`);
        }

        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to process return';
        logger.error(
          { message: `Error processing return for order: ${input.orderId}` },
          err instanceof Error ? err : new Error(errorMessage)
        );
        setError(errorMessage);
        return {
          success: false,
          returnIds: [],
          totalRefund: 0,
          error: errorMessage,
        };
      } finally {
        setIsLoading(false);
      }
    },
    [isInitialized, logger, requestApproval]
  );

  /**
   * Get returnable items for an order
   */
  const getReturnableItems = useCallback(
    async (orderId: string) => {
      try {
        setError(null);

        if (!isInitialized) {
          logger.warn('Attempting to get returnable items with uninitialized service');
          throw new Error('Returns service not initialized');
        }

        logger.info(`Retrieving returnable items for order: ${orderId}`);

        return await returnService.getReturnableItems(orderId);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get returnable items';
        logger.error(
          { message: `Error retrieving returnable items for order: ${orderId}` },
          err instanceof Error ? err : new Error(errorMessage)
        );
        setError(errorMessage);
        return [];
      }
    },
    [isInitialized, logger]
  );

  /**
   * Get returns for an order
   */
  const getReturnsByOrder = useCallback(
    async (orderId: string) => {
      try {
        setError(null);

        if (!isInitialized) {
          logger.warn('Attempting to get returns with uninitialized service');
          throw new Error('Returns service not initialized');
        }

        logger.info(`Retrieving returns for order: ${orderId}`);

        return await returnService.getReturnsByOrder(orderId);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get returns';
        logger.error({ message: `Error retrieving returns for order: ${orderId}` }, err instanceof Error ? err : new Error(errorMessage));
        setError(errorMessage);
        return [];
      }
    },
    [isInitialized, logger]
  );

  return {
    isInitialized,
    isLoading,
    error,
    processEcommerceRefund,
    processPaymentRefund,
    processReturn,
    getRefundHistory,
    getReturnableItems,
    getReturnsByOrder,
  };
}
