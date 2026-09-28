/**
 * SettingsTabComposer
 *
 * Generates the ordered list of settings tabs with their visibility status
 * based on user role, action-level permissions, and selected platform capabilities.
 *
 * Core tabs are always shown to authorized roles.
 * Advanced/optional tabs are shown only when the platform supports the feature.
 *
 * See: docs/specs/settings/settings.md §2.2.2.a
 *      docs/specs/onboarding-menu-capability-implementation.md §4.5
 *      docs/specs/auth/permissions.md §2.1.4
 */

import type { UserRole } from '../../repositories/UserRepository';
import type { PlatformCapabilities } from '../../utils/platformCapabilities';
import { getUnavailableReason } from '../../utils/platformCapabilities';
import { evaluateCapabilityGate, MenuItemStatus } from '../../utils/menuCapabilityAccess';
import { getPlatformDisplayName } from '../../utils/platforms';
import type { ECommercePlatform } from '../../utils/platforms';
import { permissionService } from '../permissions/PermissionService';

/** Capability features that can gate a settings tab — excludes basketMode which is not a CapabilityLevel */
type CapabilityFeatureKey = Exclude<keyof PlatformCapabilities, 'basketMode'>;

export type SettingsTabKey =
  'generic' | 'pos' | 'auth' | 'payment' | 'hardware' | 'hardwareStatus' | 'ecommerce' | 'offline' | 'receipt' | 'multiregister' | 'theme';

export interface ComposedSettingsTab {
  key: SettingsTabKey;
  translationKey: string;
  icon: string;
  status: MenuItemStatus;
  /** Shown as a tooltip or subtitle when status is 'disabled' */
  reason?: string;
}

interface TabDefinition {
  translationKey: string;
  icon: string;
  /** Additional action required beyond settings:view (e.g. credential-bearing tabs) */
  requiredAction?: string;
  /** Tabs without a capabilityKey are always shown (core tabs) */
  capabilityKey?: CapabilityFeatureKey;
  requiresAdapterReady?: boolean;
}

const TAB_DEFINITIONS: Record<SettingsTabKey, TabDefinition> = {
  generic: {
    translationKey: 'settings.tabs.general',
    icon: '⚙️',
  },
  pos: {
    translationKey: 'settings.tabs.posConfig',
    icon: '🏪',
  },
  auth: {
    translationKey: 'settings.tabs.authentication',
    icon: '🔐',
    requiredAction: 'settings:edit',
  },
  payment: {
    translationKey: 'settings.tabs.payment',
    icon: '💳',
    requiredAction: 'settings:edit',
  },
  hardware: {
    translationKey: 'settings.tabs.hardware',
    icon: '🔌',
  },
  hardwareStatus: {
    translationKey: 'settings.tabs.hardwareStatus',
    icon: '📊',
  },
  ecommerce: {
    translationKey: 'settings.tabs.ecommerce',
    icon: '🛒',
    requiredAction: 'settings:edit',
  },
  offline: {
    translationKey: 'settings.tabs.offline',
    icon: '📴',
  },
  receipt: {
    translationKey: 'settings.tabs.receipt',
    icon: '🧾',
  },
  multiregister: {
    translationKey: 'settings.tabs.multiRegister',
    icon: '🔗',
    requiredAction: 'settings:edit',
  },
  theme: {
    translationKey: 'settings.tabs.theme',
    icon: '🎨',
  },
};

/** Stable display order for settings tabs */
const TAB_ORDER: SettingsTabKey[] = [
  'generic',
  'pos',
  'auth',
  'payment',
  'hardware',
  'hardwareStatus',
  'ecommerce',
  'offline',
  'receipt',
  'multiregister',
  'theme',
];

export interface SettingsTabComposerInput {
  userRole?: UserRole;
  platform: ECommercePlatform | string;
  capabilities: PlatformCapabilities;
  /**
   * Map of capability keys to adapter readiness.
   * If absent, readiness is assumed false for 'custom' features.
   */
  adapterReadiness?: Partial<Record<keyof PlatformCapabilities, boolean>>;
}

/**
 * Compose the ordered list of settings tabs for the given platform context.
 * Tabs with status 'hidden' are excluded from the output.
 *
 * Spec requirement 2.1.4: All settings tabs are gated by 'settings:view' permission.
 */
export function composeSettingsTabs(input: SettingsTabComposerInput): ComposedSettingsTab[] {
  const { userRole, platform, capabilities, adapterReadiness = {} } = input;
  const platformName = getPlatformDisplayName(platform);

  // Spec requirement 2.1.4: Check settings:view permission (synchronous role-based check)
  const hasSettingsViewPermission = permissionService.canByRole(userRole, 'settings:view');
  if (!hasSettingsViewPermission) {
    // User cannot access settings at all — return empty list
    return [];
  }

  const tabs: ComposedSettingsTab[] = [];

  for (const key of TAB_ORDER) {
    const def = TAB_DEFINITIONS[key];

    // Credential-bearing tabs (payment keys, platform tokens, auth methods,
    // LAN secret) are admin-only per the action registry's settings:edit.
    if (def.requiredAction && !permissionService.canByRole(userRole, def.requiredAction)) continue;

    if (!def.capabilityKey) {
      // Core tab — always shown (if user has settings:view permission)
      tabs.push({
        key,
        translationKey: def.translationKey,
        icon: def.icon,
        status: 'enabled',
      });
      continue;
    }

    const capLevel = capabilities[def.capabilityKey];
    const adapterReady = def.requiresAdapterReady ? (adapterReadiness[def.capabilityKey] ?? false) : true;
    const reason = getUnavailableReason(capabilities, def.capabilityKey, platformName);
    const result = evaluateCapabilityGate(capLevel, adapterReady, reason);

    if (result.status === 'hidden') continue;

    tabs.push({
      key,
      translationKey: def.translationKey,
      icon: def.icon,
      status: result.status,
      reason: result.reason,
    });
  }

  return tabs;
}
