import { taxProfileRepository, TaxProfileRow, CreateTaxProfileInput, UpdateTaxProfileInput } from '../../repositories/TaxProfileRepository';
import { LoggerFactory } from '../logger/LoggerFactory';

const logger = LoggerFactory.getInstance().createLogger('TaxProfileService');

/**
 * Tax Profile Service
 *
 * Wraps TaxProfileRepository with business logic for managing tax profiles.
 * Spec: docs/specs/catalog/products.md section 2.10, 2.11
 */
export class TaxProfileService {
  /**
   * Create a new tax profile
   * Spec requirement 2.10.1
   */
  async createProfile(input: CreateTaxProfileInput): Promise<TaxProfileRow> {
    const id = await taxProfileRepository.create(input);
    const profile = await taxProfileRepository.findById(id);

    if (!profile) {
      throw new Error(`Failed to create tax profile: ${input.name}`);
    }

    logger.info({ message: 'Tax profile created', profileId: id, name: input.name });
    return profile;
  }

  /**
   * Update an existing tax profile
   * Spec requirement 2.10.3
   */
  async updateProfile(id: string, input: UpdateTaxProfileInput): Promise<TaxProfileRow> {
    await taxProfileRepository.update(id, input);
    const profile = await taxProfileRepository.findById(id);

    if (!profile) {
      throw new Error(`Tax profile not found: ${id}`);
    }

    logger.info({ message: 'Tax profile updated', profileId: id });
    return profile;
  }

  /**
   * Delete a tax profile
   * Spec requirement 2.10.4: Cannot delete default profile
   */
  async deleteProfile(id: string): Promise<boolean> {
    const profile = await taxProfileRepository.findById(id);

    if (!profile) {
      logger.warn({ message: 'Tax profile not found for deletion', profileId: id });
      return false;
    }

    if (profile.is_default === 1) {
      logger.warn({ message: 'Cannot delete default tax profile', profileId: id });
      return false;
    }

    await taxProfileRepository.delete(id);
    logger.info({ message: 'Tax profile deleted', profileId: id });
    return true;
  }

  /**
   * Get all tax profiles
   */
  async getAllProfiles(): Promise<TaxProfileRow[]> {
    return taxProfileRepository.findAll();
  }

  /**
   * Get all active tax profiles
   */
  async getActiveProfiles(): Promise<TaxProfileRow[]> {
    return taxProfileRepository.findActive();
  }

  /**
   * Get a tax profile by ID
   * Spec requirement 2.11.1: Used for offline product tax resolution
   */
  async getProfileById(id: string): Promise<TaxProfileRow | null> {
    return taxProfileRepository.findById(id);
  }

  /**
   * Get the merchant-defined default tax profile, if any.
   * No profiles (and no rates) are ever created automatically: a hard-coded region's VAT would be
   * wrong for most stores. Without a default profile the store tax rate from POS settings applies.
   */
  async getDefaultProfile(): Promise<TaxProfileRow | null> {
    return taxProfileRepository.findDefault();
  }
}

// Singleton instance
export const taxProfileService = new TaxProfileService();
