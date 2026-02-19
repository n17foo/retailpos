import { taxProfileRepository, TaxProfileRow, CreateTaxProfileInput, UpdateTaxProfileInput } from '../../repositories/TaxProfileRepository';
import { LoggerFactory } from '../logger/loggerFactory';

export interface TaxProfile {
  id: string;
  name: string;
  rate: number;
  isDefault: boolean;
  isActive: boolean;
  region: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: TaxProfileRow): TaxProfile {
  return {
    id: row.id,
    name: row.name,
    rate: row.rate,
    isDefault: row.is_default === 1,
    isActive: row.is_active === 1,
    region: row.region,
    description: row.description,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Service for managing tax profiles.
 * Tax profiles define named tax rates (e.g. "Standard 20%", "Reduced 5%", "Zero-rated").
 * Products and line items reference a tax profile to determine their tax rate.
 */
export class TaxProfileService {
  private static instance: TaxProfileService;
  private logger = LoggerFactory.getInstance().createLogger('TaxProfileService');

  private constructor() {}

  static getInstance(): TaxProfileService {
    if (!TaxProfileService.instance) {
      TaxProfileService.instance = new TaxProfileService();
    }
    return TaxProfileService.instance;
  }

  async createProfile(input: CreateTaxProfileInput): Promise<TaxProfile> {
    const id = await taxProfileRepository.create(input);
    const row = await taxProfileRepository.findById(id);
    if (!row) throw new Error('Failed to create tax profile');
    this.logger.info(`Created tax profile "${input.name}" (${input.rate}%)`);
    return mapRow(row);
  }

  async getAllProfiles(): Promise<TaxProfile[]> {
    const rows = await taxProfileRepository.findAll();
    return rows.map(mapRow);
  }

  async getActiveProfiles(): Promise<TaxProfile[]> {
    const rows = await taxProfileRepository.findActive();
    return rows.map(mapRow);
  }

  async getDefaultProfile(): Promise<TaxProfile | null> {
    const row = await taxProfileRepository.findDefault();
    return row ? mapRow(row) : null;
  }

  async getProfileById(id: string): Promise<TaxProfile | null> {
    const row = await taxProfileRepository.findById(id);
    return row ? mapRow(row) : null;
  }

  /** Get the effective tax rate — returns the default profile's rate, or 0 if none set */
  async getDefaultRate(): Promise<number> {
    const profile = await this.getDefaultProfile();
    return profile?.rate ?? 0;
  }

  async updateProfile(id: string, input: UpdateTaxProfileInput): Promise<TaxProfile | null> {
    await taxProfileRepository.update(id, input);
    const row = await taxProfileRepository.findById(id);
    if (!row) return null;
    this.logger.info(`Updated tax profile "${row.name}"`);
    return mapRow(row);
  }

  async deleteProfile(id: string): Promise<boolean> {
    const existing = await taxProfileRepository.findById(id);
    if (!existing) return false;
    if (existing.is_default === 1) {
      this.logger.warn('Cannot delete the default tax profile. Set another as default first.');
      return false;
    }
    await taxProfileRepository.delete(id);
    this.logger.info(`Deleted tax profile "${existing.name}"`);
    return true;
  }

  /** Seed default profiles if none exist */
  async seedDefaults(): Promise<void> {
    const existing = await taxProfileRepository.findAll();
    if (existing.length > 0) return;

    this.logger.info('Seeding default tax profiles…');
    await taxProfileRepository.create({ name: 'Standard Rate', rate: 20, isDefault: true, description: 'UK standard VAT rate' });
    await taxProfileRepository.create({ name: 'Reduced Rate', rate: 5, description: 'UK reduced VAT rate' });
    await taxProfileRepository.create({ name: 'Zero Rate', rate: 0, description: 'Zero-rated goods' });
  }
}

export const taxProfileService = TaxProfileService.getInstance();
