/**
 * Domain Models — barrel export
 *
 * Unified product and category schemas that every layer of the app should
 * reference. Platform-specific data is normalised through the mappers
 * before it reaches the rest of the codebase.
 */

// Unified schemas
export * from './UnifiedProduct';
export * from './UnifiedCategory';

// Platform → Unified mappers
export { mapToUnifiedProduct, mapToUnifiedProducts } from './mappers/ProductMapper';
export { mapToUnifiedCategory, mapToUnifiedCategories } from './mappers/CategoryMapper';
