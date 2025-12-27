import { useCallback } from 'react';
import { Alert } from 'react-native';
import { usePayment } from './usePayment';
import { OrderServiceFactory } from '../services/order/orderServiceFactory';
import { Order, OrderLineItem } from '../services/order/OrderServiceInterface';
import { PaymentRequest } from '../services/payment/paymentServiceInterface';

interface UseOrderProps {
  onOrderComplete?: (orderTotal: number, items: any[]) => void;
  setIsRightPanelOpen: (isOpen: boolean) => void;
  loadEcommerceProducts?: (page: number, category?: string) => void;
  selectedCategory?: string;
  cartProducts: any[];
  orderTotal: number;
  clearCart: () => void;
  updateCartItem: (id: string, quantity: number) => void;
}

interface OrderServiceReturn {
  completeOrder: (orderTotal: number, cartProducts: any[]) => void;
  handleCheckout: () => Promise<void>;
  createEcommerceOrder: () => Promise<void>;
  handlePaymentTerminal: (amount: number, items: any[]) => Promise<void>;
  handlePrintReceipt: () => void;
}

export const useOrder = (props: UseOrderProps): OrderServiceReturn => {
  const {
    onOrderComplete,
    setIsRightPanelOpen,
    loadEcommerceProducts,
    selectedCategory,
    cartProducts,
    orderTotal,
    clearCart,
    updateCartItem,
  } = props;

  // Get hooks for related services
  const { connectToTerminal, processPayment: processPaymentHook, disconnect } = usePayment();
  const orderServiceFactory = OrderServiceFactory.getInstance();

  // Helper function to validate cart has items
  const validateCart = useCallback((): boolean => {
    if (cartProducts.length === 0) {
      Alert.alert('Error', 'Add at least one product to your order.');
      return false;
    }
    return true;
  }, [cartProducts]);

  // Helper function to process a payment through the terminal
  const processTerminalPayment = useCallback(
    async (amount: number, reference: string, items: any[]): Promise<boolean> => {
      try {
        // Connect to terminal
        await connectToTerminal('MAIN');

        // Create payment request
        const paymentRequest: PaymentRequest = {
          amount: Math.round(amount * 100), // Convert to cents
          reference,
          items: items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: Math.round(item.price * 100), // Convert to cents
          })),
        };

        // Process payment
        const response = await processPaymentHook(paymentRequest);

        if (response.success) {
          return true;
        } else {
          Alert.alert('Payment Failed', response.errorMessage || 'Payment was declined');
          return false;
        }
      } catch (error) {
        console.error('Payment error:', error);
        Alert.alert('Error', 'Failed to process payment');
        return false;
      }
    },
    [connectToTerminal, processPaymentHook]
  );

  // Helper function to finalize a successful order
  const finalizeOrder = useCallback(
    async (total: number) => {
      // Clear cart
      clearCart();

      // Close basket panel
      setIsRightPanelOpen(false);

      // Call completion callback if provided
      if (onOrderComplete) {
        onOrderComplete(total, cartProducts);
      }

      // Disconnect from terminal
      await disconnect();
    },
    [clearCart, setIsRightPanelOpen, onOrderComplete, cartProducts, disconnect]
  );

  // Complete an order (non-payment flow)
  const completeOrder = useCallback(
    (orderTotal: number, cartProducts: any[]) => {
      if (onOrderComplete) {
        onOrderComplete(orderTotal, cartProducts);
      }
      setIsRightPanelOpen(false);
      clearCart();
    },
    [onOrderComplete, setIsRightPanelOpen, clearCart]
  );

  // Handle checkout process
  const handleCheckout = useCallback(async () => {
    // Validate cart has items
    if (!validateCart()) return;

    try {
      // Create order reference data
      const orderRef = {
        id: `order-${Date.now()}`,
        customerName: 'Walk-in Customer',
        items: cartProducts.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        total: orderTotal,
      };

      // Process payment using the terminal
      const success = await processTerminalPayment(orderTotal, orderRef.id, orderRef.items);

      if (success) {
        // Finalize the order
        await finalizeOrder(orderTotal);
      }
    } catch (error) {
      console.error('Checkout error:', error);
      Alert.alert('Error', 'An unexpected error occurred during checkout.');
    }
  }, [validateCart, cartProducts, orderTotal, processTerminalPayment, finalizeOrder]);

  // Create an order in the eCommerce platform
  const createEcommerceOrder = useCallback(async () => {
    try {
      if (cartProducts.length === 0) {
        Alert.alert('Error', 'Add at least one product to your order.');
        return;
      }

      // Get current order service
      const orderService = orderServiceFactory.getService();
      if (!orderService) {
        Alert.alert('Error', 'No eCommerce order service is available.');
        return;
      }

      // Create order line items
      const lineItems: OrderLineItem[] = cartProducts
        .filter(item => item.isEcommerceProduct)
        .map(item => {
          // Extract the original product ID by removing the 'ecom-' prefix
          // or use the originalId property if available
          const originalId = item.originalId || (item.id.startsWith('ecom-') ? item.id.substring(5) : item.id);

          return {
            productId: originalId, // Use the original product ID for the eCommerce platform
            variantId: item.variantId || undefined,
            quantity: item.quantity,
            name: item.name,
            price: item.price,
            taxable: true,
            total: item.price * item.quantity,
          };
        });

      if (lineItems.length === 0) {
        Alert.alert('Error', 'No eCommerce products in cart. Add eCommerce products to create an online order.');
        return;
      }

      // Create the order
      const order = await orderService.createOrder({
        lineItems,
        subtotal: orderTotal,
        tax: 0, // Add tax calculation if needed
        total: orderTotal,
        note: 'Order created from POS',
      });

      Alert.alert('Order Created', `Order #${order.platformOrderId} has been created in the eCommerce platform.`, [{ text: 'OK' }]);

      // Clear cart
      if (onOrderComplete) {
        onOrderComplete(orderTotal, cartProducts);
      }
      setIsRightPanelOpen(false);
      clearCart();

      // Refresh products to get updated inventory
      if (loadEcommerceProducts) {
        loadEcommerceProducts(1, selectedCategory);
      }
    } catch (error) {
      console.error('Error creating ecommerce order:', error);
      Alert.alert('Error', 'Failed to create order in eCommerce platform');
    }
  }, [
    orderServiceFactory,
    orderTotal,
    cartProducts,
    onOrderComplete,
    setIsRightPanelOpen,
    loadEcommerceProducts,
    selectedCategory,
    clearCart,
  ]);

  // Function to handle sending payment to terminal or handle basket quantity updates
  const handlePaymentTerminal = useCallback(
    async (amount: number, items: any[]) => {
      // If amount is 0 and we have only one item, it's a quantity update from Basket
      if (amount === 0 && items.length === 1) {
        const item = items[0];
        updateCartItem(item.id, item.quantity);
        return;
      }

      // Generate a reference ID for this payment
      const reference = `order-${Date.now()}`;

      // Process payment using our helper function
      const success = await processTerminalPayment(amount, reference, items);

      if (success) {
        // Show success message with transaction details
        Alert.alert('Payment Complete', `Payment of $${amount.toFixed(2)} processed successfully.`);

        // Finalize the order
        await finalizeOrder(amount);
      }
    },
    [updateCartItem, processTerminalPayment, finalizeOrder]
  );

  // Handle printing receipt
  const handlePrintReceipt = useCallback(() => {
    if (cartProducts.length === 0) {
      Alert.alert('Error', 'Add items to your order first');
      return;
    }

    Alert.alert('Print Receipt', 'Choose a printer:', [
      {
        text: 'Main Counter',
        onPress: () => {
          Alert.alert('Success', 'Receipt sent to Main Counter printer');
        },
      },
      {
        text: 'Kitchen',
        onPress: () => {
          Alert.alert('Success', 'Receipt sent to Kitchen printer');
        },
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  }, [cartProducts]);

  return {
    completeOrder,
    handleCheckout,
    createEcommerceOrder,
    handlePaymentTerminal,
    handlePrintReceipt,
  };
};
