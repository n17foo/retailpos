/**
 * PRO-01 regression tests on real SQLite — receiving used to increment
 * supplied item IDs before validating membership or lifecycle. A foreign
 * line ID corrupted another PO, a cancelled PO could be fully received,
 * and quantities could exceed what was ordered.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

jest.mock('expo-sqlite', () => {
  const { openDb } = require('../../../tests/helpers/nodeSqliteAdapter');
  const real = openDb();
  return {
    openDatabaseAsync: jest.fn(async () => real),
    openDatabaseSync: jest.fn(() => real),
  };
});

let uuidCounter = 0;
jest.mock('../../../shared/utils/uuid', () => ({
  generateUUID: () => `mock-uuid-${++uuidCounter}`,
}));

jest.mock('../../../shared/services/audit/AuditLogService', () => ({
  auditLogService: { log: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('../../../shared/services/notifications/NotificationService', () => ({
  notificationService: { notify: jest.fn() },
}));

jest.mock('../../inventory/services/InventoryServiceFactory', () => ({
  InventoryServiceFactory: {
    getInstance: () => ({
      getService: () => ({ updateInventory: jest.fn().mockResolvedValue({ succeeded: 1, failed: 0 }) }),
    }),
  },
}));

jest.mock('../../authentication/services/permissions/PermissionService', () => ({
  permissionService: { can: jest.fn().mockResolvedValue(true) },
}));

import { db } from '../../../shared/utils/db';
import { initializeSchema } from '../../../shared/utils/dbSchema';
import { procurementRepository } from '../repositories/ProcurementRepository';
import { procurementService } from './ProcurementService';
import { ECommercePlatform } from '../../../shared/utils/platforms';

const realDb = db as unknown as SQLiteDatabase;

async function createOrderedPo(productId = 'p-1') {
  const poId = await procurementRepository.createPO({
    vendorId: 'v-1',
    expectedDate: null,
    notes: null,
    createdBy: null,
    items: [{ productId, variantId: null, productName: `Product ${productId}`, orderedQty: 10, unitCost: 5 }],
  });
  await procurementRepository.updatePOStatus(poId, 'ordered', Date.now());
  const items = await procurementRepository.findPOItems(poId);
  return { poId, itemId: items[0].id };
}

describe('PRO-01 — receiving validates the PO before writing', () => {
  beforeEach(async () => {
    await initializeSchema(realDb);
    await realDb.runAsync('DELETE FROM purchase_orders');
    await realDb.runAsync('DELETE FROM purchase_order_items');
    jest.clearAllMocks();
  });

  it('rejects a line that belongs to a different PO — both POs stay untouched', async () => {
    const a = await createOrderedPo('p-a');
    const b = await createOrderedPo('p-b');

    // Receive against PO A using PO B's line id
    const result = await procurementService.receivePO(a.poId, [{ itemId: b.itemId, receiveNow: 5 }], ECommercePlatform.OFFLINE, 'mgr-1');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/does not belong/);
    // PO B's received quantity is unchanged — the stray write never happened
    expect((await procurementRepository.findPOItems(b.poId))[0].received_qty).toBe(0);
    // And PO A's status was never touched
    expect((await procurementRepository.findPOById(a.poId))!.status).toBe('ordered');
  });

  it('rejects receiving on a cancelled PO', async () => {
    const { poId, itemId } = await createOrderedPo();
    await procurementRepository.updatePOStatus(poId, 'cancelled');

    const result = await procurementService.receivePO(poId, [{ itemId, receiveNow: 10 }], ECommercePlatform.OFFLINE, 'mgr-1');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/cannot receive/);
    expect((await procurementRepository.findPOItems(poId))[0].received_qty).toBe(0);
    expect((await procurementRepository.findPOById(poId))!.status).toBe('cancelled');
  });

  it('rejects receiving on a draft PO', async () => {
    const poId = await procurementRepository.createPO({
      vendorId: null,
      expectedDate: null,
      notes: null,
      createdBy: null,
      items: [{ productId: 'p-1', variantId: null, productName: 'P', orderedQty: 10, unitCost: 1 }],
    });
    const items = await procurementRepository.findPOItems(poId);

    const result = await procurementService.receivePO(poId, [{ itemId: items[0].id, receiveNow: 10 }], ECommercePlatform.OFFLINE, 'mgr-1');

    expect(result.success).toBe(false);
    expect((await procurementRepository.findPOItems(poId))[0].received_qty).toBe(0);
  });

  it('rejects receiving more than the ordered quantity — no partial write', async () => {
    const { poId, itemId } = await createOrderedPo();
    await procurementRepository.incrementReceivedQty(itemId, 8); // 8 of 10 already received

    const result = await procurementService.receivePO(poId, [{ itemId, receiveNow: 5 }], ECommercePlatform.OFFLINE, 'mgr-1');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/exceeds/);
    // The rejection happened before any write — still 8
    expect((await procurementRepository.findPOItems(poId))[0].received_qty).toBe(8);
  });

  it('rejects non-finite quantities', async () => {
    const { poId, itemId } = await createOrderedPo();

    const result = await procurementService.receivePO(
      poId,
      [{ itemId, receiveNow: Number.POSITIVE_INFINITY }],
      ECommercePlatform.OFFLINE,
      'mgr-1'
    );

    expect(result.success).toBe(false);
    expect((await procurementRepository.findPOItems(poId))[0].received_qty).toBe(0);
  });

  it('a retried receive after success fails closed instead of double-crediting', async () => {
    const { poId, itemId } = await createOrderedPo();

    const first = await procurementService.receivePO(poId, [{ itemId, receiveNow: 10 }], ECommercePlatform.OFFLINE, 'mgr-1');
    expect(first.success).toBe(true);
    expect(first.newStatus).toBe('received');

    // Same receive retried — the full quantity is gone, so it is rejected
    const retry = await procurementService.receivePO(poId, [{ itemId, receiveNow: 10 }], ECommercePlatform.OFFLINE, 'mgr-1');
    expect(retry.success).toBe(false);
    expect((await procurementRepository.findPOItems(poId))[0].received_qty).toBe(10);
  });

  it('a valid partial receive increments exactly once and stays partially_received', async () => {
    const { poId, itemId } = await createOrderedPo();

    const result = await procurementService.receivePO(poId, [{ itemId, receiveNow: 4 }], ECommercePlatform.OFFLINE, 'mgr-1');

    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('partially_received');
    expect((await procurementRepository.findPOItems(poId))[0].received_qty).toBe(4);
  });
});
