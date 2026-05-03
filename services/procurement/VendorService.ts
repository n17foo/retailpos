/**
 * VendorService
 *
 * CRUD for vendor/supplier records.
 * See: docs/specs/inventory/inventory.md §7.1
 */

import { procurementRepository, CreateVendorInput, VendorRow } from '../../repositories/ProcurementRepository';
import { auditLogService } from '../audit/AuditLogService';
import { LoggerFactory } from '../logger/LoggerFactory';

export class VendorService {
  private static instance: VendorService;
  private logger = LoggerFactory.getInstance().createLogger('VendorService');

  private constructor() {}

  static getInstance(): VendorService {
    if (!VendorService.instance) {
      VendorService.instance = new VendorService();
    }
    return VendorService.instance;
  }

  async create(input: CreateVendorInput, createdBy?: string): Promise<string> {
    const id = await procurementRepository.createVendor(input);
    await auditLogService.log('vendor:created', {
      userId: createdBy,
      details: `Vendor "${input.name}" created`,
      metadata: { vendorId: id },
    });
    return id;
  }

  async findAll(): Promise<VendorRow[]> {
    return procurementRepository.findAllVendors();
  }

  async findById(id: string): Promise<VendorRow | null> {
    return procurementRepository.findVendorById(id);
  }

  async update(id: string, input: Partial<CreateVendorInput>, updatedBy?: string): Promise<void> {
    await procurementRepository.updateVendor(id, input);
    await auditLogService.log('vendor:updated', {
      userId: updatedBy,
      details: `Vendor ${id} updated`,
      metadata: { vendorId: id, fields: Object.keys(input) },
    });
  }

  async softDelete(id: string, deletedBy?: string): Promise<void> {
    await procurementRepository.softDeleteVendor(id);
    await auditLogService.log('vendor:deleted', {
      userId: deletedBy,
      details: `Vendor ${id} soft-deleted`,
      metadata: { vendorId: id },
    });
  }
}

export const vendorService = VendorService.getInstance();
