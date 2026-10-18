/**
 * TransferOrdersScreen
 *
 * Lists transfer orders with status filter. Supports create, dispatch,
 * and receive flows. Manager/admin only.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { procurementService } from '../services/ProcurementService';
import { TransferOrderRow, TransferOrderItemRow } from '../repositories/ProcurementRepository';
import { useAuthContext } from '../../authentication/contexts/AuthProvider';
import { useEcommerceSettings } from '../../platform-clients/hooks/useEcommerceSettings';
import { useProductsForDisplay } from '../../catalogue/hooks/useProducts';
import { ECommercePlatform } from '../../../shared/utils/platforms';
import { TransferOrdersListView, TransferStatusFilter } from '../components/TransferOrdersListView';
import { TransferOrderDetailView } from '../components/TransferOrderDetailView';
import { TransferOrderCreateView, TransferProductSelection } from '../components/TransferOrderCreateView';

type ViewMode = 'list' | 'detail' | 'create';

const TransferOrdersScreen: React.FC = () => {
  const { user } = useAuthContext();
  const { ecommerceSettings } = useEcommerceSettings();
  const { products } = useProductsForDisplay();
  const platform = (ecommerceSettings?.platform ?? 'offline') as ECommercePlatform;

  const [transfers, setTransfers] = useState<TransferOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<TransferStatusFilter>('all');
  const [selectedTransfer, setSelectedTransfer] = useState<TransferOrderRow | null>(null);
  const [transferItems, setTransferItems] = useState<TransferOrderItemRow[]>([]);
  const [processing, setProcessing] = useState(false);

  // Create form state
  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<TransferProductSelection[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const allTransfers = await procurementService.findAllTransferOrders(statusFilter === 'all' ? undefined : statusFilter);
      setTransfers(allTransfers);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (transfer: TransferOrderRow) => {
    const items = await procurementService.findTransferOrderItems(transfer.id);
    setSelectedTransfer(transfer);
    setTransferItems(items);
    setView('detail');
  };

  const openCreate = () => {
    setFromLocation('');
    setToLocation('');
    setNotes('');
    setSelectedProducts([]);
    setView('create');
  };

  const handleCreate = async () => {
    if (!fromLocation.trim() || !toLocation.trim()) {
      Alert.alert('Validation Error', 'Please enter both from and to locations.');
      return;
    }
    if (selectedProducts.length === 0) {
      Alert.alert('Validation Error', 'Please add at least one product to transfer.');
      return;
    }

    setProcessing(true);
    try {
      const items = selectedProducts.map(sp => {
        const product = products.find(p => p.id === sp.productId);
        return {
          productId: sp.productId,
          variantId: sp.variantId ?? null,
          productName: product?.name ?? 'Unknown Product',
          transferQty: sp.quantity,
        };
      });

      await procurementService.createTransferOrder({
        fromLocation,
        toLocation,
        notes: notes || null,
        items,
        createdBy: user?.id ?? null,
      });

      Alert.alert('Success', 'Transfer order created successfully.');
      load();
      setView('list');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create transfer order');
    } finally {
      setProcessing(false);
    }
  };

  const handleDispatch = async () => {
    if (!selectedTransfer) return;
    Alert.alert('Dispatch Transfer', 'Mark this transfer as dispatched? Inventory will be decremented at the source location.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dispatch',
        onPress: async () => {
          setProcessing(true);
          try {
            await procurementService.dispatchTransferOrder(selectedTransfer.id, platform, user?.id);
            Alert.alert('Success', 'Transfer order dispatched. Inventory decremented at source.');
            load();
            setView('list');
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to dispatch transfer');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const handleReceive = async () => {
    if (!selectedTransfer) return;
    Alert.alert('Receive Transfer', 'Confirm receipt of this transfer? Inventory will be incremented at the destination location.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Receive',
        onPress: async () => {
          setProcessing(true);
          try {
            await procurementService.receiveTransferOrder(selectedTransfer.id, platform, user?.id);
            Alert.alert('Success', 'Transfer order received. Inventory incremented at destination.');
            load();
            setView('list');
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to receive transfer');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const handleCancel = async () => {
    if (!selectedTransfer) return;
    Alert.alert('Cancel Transfer', 'Cancel this transfer order?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Transfer',
        style: 'destructive',
        onPress: async () => {
          setProcessing(true);
          try {
            await procurementService.cancelTransferOrder(selectedTransfer.id, user?.id);
            Alert.alert('Success', 'Transfer order cancelled.');
            load();
            setView('list');
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to cancel transfer');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const addProduct = () => {
    if (products.length === 0) {
      Alert.alert('No Products', 'Please load products first.');
      return;
    }
    // Simple implementation: add first product with quantity 1
    // In production, this would be a product picker modal
    const firstProduct = products[0];
    setSelectedProducts([...selectedProducts, { productId: firstProduct.id, quantity: 1 }]);
  };

  const removeProduct = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, quantity: string) => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) return;
    const updated = [...selectedProducts];
    updated[index].quantity = qty;
    setSelectedProducts(updated);
  };

  if (view === 'list') {
    const filteredTransfers = statusFilter === 'all' ? transfers : transfers.filter(t => t.status === statusFilter);
    return (
      <TransferOrdersListView
        transfers={filteredTransfers}
        statusFilter={statusFilter}
        isLoading={loading}
        onStatusFilterChange={setStatusFilter}
        onCreate={openCreate}
        onSelectTransfer={openDetail}
      />
    );
  }

  if (view === 'detail' && selectedTransfer) {
    return (
      <TransferOrderDetailView
        transfer={selectedTransfer}
        items={transferItems}
        isProcessing={processing}
        onBack={() => setView('list')}
        onDispatch={handleDispatch}
        onReceive={handleReceive}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <TransferOrderCreateView
      products={products}
      selectedProducts={selectedProducts}
      fromLocation={fromLocation}
      toLocation={toLocation}
      notes={notes}
      isProcessing={processing}
      onBack={() => setView('list')}
      onFromLocationChange={setFromLocation}
      onToLocationChange={setToLocation}
      onNotesChange={setNotes}
      onAddProduct={addProduct}
      onRemoveProduct={removeProduct}
      onQuantityChange={updateQuantity}
      onCreate={handleCreate}
    />
  );
};

export default TransferOrdersScreen;
