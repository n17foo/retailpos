/**
 * VendorReturnsScreen
 *
 * Lists vendor returns with status filter. Supports create and confirm flows.
 * Manager/admin only.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { procurementService } from '../services/ProcurementService';
import { vendorService } from '../services/VendorService';
import {
  VendorReturnRow,
  VendorReturnItemRow,
  PurchaseOrderRow,
  PurchaseOrderItemRow,
  VendorRow,
} from '../repositories/ProcurementRepository';
import { useAuthContext } from '../../authentication/contexts/AuthProvider';
import { useEcommerceSettings } from '../../platform-clients/hooks/useEcommerceSettings';
import { ECommercePlatform } from '../../../shared/utils/platforms';
import { VendorReturnsListView, VendorReturnStatusFilter } from '../components/VendorReturnsListView';
import { VendorReturnDetailView } from '../components/VendorReturnDetailView';
import { VendorReturnCreateView, ReturnQtyEntry } from '../components/VendorReturnCreateView';

type ViewMode = 'list' | 'detail' | 'create';

const VendorReturnsScreen: React.FC = () => {
  const { user } = useAuthContext();
  const { ecommerceSettings } = useEcommerceSettings();
  const platform = (ecommerceSettings?.platform ?? 'offline') as ECommercePlatform;

  const [returns, setReturns] = useState<VendorReturnRow[]>([]);
  const [vendors, setVendors] = useState<VendorRow[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [statusFilter, setStatusFilter] = useState<VendorReturnStatusFilter>('all');
  const [selectedReturn, setSelectedReturn] = useState<VendorReturnRow | null>(null);
  const [returnItems, setReturnItems] = useState<VendorReturnItemRow[]>([]);
  const [processing, setProcessing] = useState(false);

  // Create form state
  const [selectedPOId, setSelectedPOId] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [notes, setNotes] = useState('');
  const [poItems, setPoItems] = useState<PurchaseOrderItemRow[]>([]);
  const [returnQtys, setReturnQtys] = useState<ReturnQtyEntry>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [allReturns, allVendors, allPOs] = await Promise.all([
        procurementService.findAllVendorReturns(statusFilter === 'all' ? undefined : statusFilter),
        vendorService.findAll(),
        procurementService.findAllPOs('received'),
      ]);
      setReturns(allReturns);
      setVendors(allVendors);
      setPurchaseOrders(allPOs);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (vendorReturn: VendorReturnRow) => {
    const items = await procurementService.findVendorReturnItems(vendorReturn.id);
    setSelectedReturn(vendorReturn);
    setReturnItems(items);
    setView('detail');
  };

  const openCreate = () => {
    setSelectedPOId('');
    setSelectedVendorId('');
    setNotes('');
    setPoItems([]);
    setReturnQtys({});
    setView('create');
  };

  const handlePOSelect = async (poId: string) => {
    setSelectedPOId(poId);
    if (!poId) {
      setPoItems([]);
      setReturnQtys({});
      return;
    }

    const po = purchaseOrders.find(p => p.id === poId);
    if (po) {
      setSelectedVendorId(po.vendor_id ?? '');
      const items = await procurementService.findPOItems(poId);
      setPoItems(items);
      const qtys: ReturnQtyEntry = {};
      items.forEach(item => {
        qtys[item.id] = { qty: '', reason: '' };
      });
      setReturnQtys(qtys);
    }
  };

  const handleCreate = async () => {
    if (!selectedPOId || !selectedVendorId) {
      Alert.alert('Validation Error', 'Please select a purchase order.');
      return;
    }

    const itemsToReturn = Object.entries(returnQtys)
      .filter(([_, data]) => parseInt(data.qty, 10) > 0)
      .map(([itemId, data]) => {
        const poItem = poItems.find(i => i.id === itemId);
        return {
          poItemId: itemId,
          productId: poItem!.product_id,
          variantId: poItem!.variant_id ?? null,
          productName: poItem!.product_name,
          returnQty: parseInt(data.qty, 10),
          reason: data.reason || null,
        };
      });

    if (itemsToReturn.length === 0) {
      Alert.alert('Validation Error', 'Please enter at least one return quantity.');
      return;
    }

    setProcessing(true);
    try {
      await procurementService.createVendorReturn({
        purchaseOrderId: selectedPOId,
        vendorId: selectedVendorId,
        notes: notes || null,
        items: itemsToReturn,
        createdBy: user?.id ?? null,
      });

      Alert.alert('Success', 'Vendor return created successfully.');
      load();
      setView('list');
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create vendor return');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedReturn) return;
    Alert.alert('Confirm Return', 'Confirm this vendor return? Inventory will be decremented for all returned items.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setProcessing(true);
          try {
            await procurementService.confirmVendorReturn(selectedReturn.id, platform, user?.id);
            Alert.alert('Success', 'Vendor return confirmed. Inventory decremented.');
            load();
            setView('list');
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to confirm return');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const handleCancel = async () => {
    if (!selectedReturn) return;
    Alert.alert('Cancel Return', 'Cancel this vendor return?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancel Return',
        style: 'destructive',
        onPress: async () => {
          setProcessing(true);
          try {
            await procurementService.cancelVendorReturn(selectedReturn.id, user?.id);
            Alert.alert('Success', 'Vendor return cancelled.');
            load();
            setView('list');
          } catch (err) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to cancel return');
          } finally {
            setProcessing(false);
          }
        },
      },
    ]);
  };

  const updateReturnQty = (itemId: string, field: 'qty' | 'reason', value: string) => {
    setReturnQtys(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: value,
      },
    }));
  };

  if (view === 'list') {
    const filteredReturns = statusFilter === 'all' ? returns : returns.filter(r => r.status === statusFilter);
    return (
      <VendorReturnsListView
        returns={filteredReturns}
        vendors={vendors}
        statusFilter={statusFilter}
        isLoading={loading}
        onStatusFilterChange={setStatusFilter}
        onCreate={openCreate}
        onSelectReturn={openDetail}
      />
    );
  }

  if (view === 'detail' && selectedReturn) {
    const vendor = vendors.find(v => v.id === selectedReturn.vendor_id);
    return (
      <VendorReturnDetailView
        vendorReturn={selectedReturn}
        items={returnItems}
        vendorName={vendor?.name ?? 'Unknown'}
        isProcessing={processing}
        onBack={() => setView('list')}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <VendorReturnCreateView
      purchaseOrders={purchaseOrders}
      vendors={vendors}
      selectedPOId={selectedPOId}
      selectedVendorId={selectedVendorId}
      notes={notes}
      poItems={poItems}
      returnQtys={returnQtys}
      isProcessing={processing}
      onBack={() => setView('list')}
      onSelectPO={handlePOSelect}
      onNotesChange={setNotes}
      onReturnQtyChange={updateReturnQty}
      onCreate={handleCreate}
    />
  );
};

export default VendorReturnsScreen;
