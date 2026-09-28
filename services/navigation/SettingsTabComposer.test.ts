jest.mock('../logger/LoggerFactory', () => ({
  LoggerFactory: {
    getInstance: () => ({ createLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }) }),
  },
}));
jest.mock('../../repositories/UserRepository', () => ({ userRepository: {} }));
jest.mock('../../repositories/PermissionRepository', () => ({ permissionRepository: {} }));

import { composeSettingsTabs } from './SettingsTabComposer';
import { getPlatformCapabilities } from '../../utils/platformCapabilities';
import { ECommercePlatform } from '../../utils/platforms';

const capabilities = getPlatformCapabilities(ECommercePlatform.OFFLINE);
const CREDENTIAL_TABS = ['auth', 'payment', 'ecommerce', 'multiregister'];

describe('composeSettingsTabs', () => {
  it('returns no tabs when the role is unknown', () => {
    expect(composeSettingsTabs({ platform: ECommercePlatform.OFFLINE, capabilities })).toEqual([]);
  });

  it('withholds credential-bearing tabs from managers', () => {
    const keys = composeSettingsTabs({ userRole: 'manager', platform: ECommercePlatform.OFFLINE, capabilities }).map(t => t.key);
    for (const key of CREDENTIAL_TABS) expect(keys).not.toContain(key);
    expect(keys).toContain('generic');
  });

  it('shows credential-bearing tabs to admins', () => {
    const keys = composeSettingsTabs({ userRole: 'admin', platform: ECommercePlatform.OFFLINE, capabilities }).map(t => t.key);
    expect(keys).toEqual(expect.arrayContaining(['auth', 'payment', 'ecommerce']));
  });
});
