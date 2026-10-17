import { composeMoreMenu } from './MoreMenuComposer';
import { getPlatformCapabilities } from '../../shared/utils/platformCapabilities';
import { ECommercePlatform } from '../../shared/utils/platforms';

describe('MoreMenuComposer', () => {
  it('hides admin/manager items from cashiers and includes them for admins', () => {
    const caps = getPlatformCapabilities(ECommercePlatform.SHOPIFY);

    const cashierItems = composeMoreMenu({ userRole: 'cashier', platform: ECommercePlatform.SHOPIFY, capabilities: caps });
    expect(cashierItems.some(i => i.key === 'Settings')).toBe(false);
    expect(cashierItems.some(i => i.key === 'OrderHistory')).toBe(true);

    const adminItems = composeMoreMenu({ userRole: 'admin', platform: ECommercePlatform.SHOPIFY, capabilities: caps });
    expect(adminItems.some(i => i.key === 'Settings')).toBe(true);
    expect(adminItems.some(i => i.key === 'Users')).toBe(true);
  });
});
