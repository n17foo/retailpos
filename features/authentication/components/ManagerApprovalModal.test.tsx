import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { ManagerApprovalModal } from './ManagerApprovalModal';
import { managerApprovalService } from '../services/permissions/ManagerApprovalService';

jest.mock('../services/permissions/ManagerApprovalService', () => ({
  managerApprovalService: {
    getPending: jest.fn(),
    subscribe: jest.fn(() => jest.fn()),
    submitManagerPin: jest.fn(),
    cancel: jest.fn(),
  },
}));

describe('ManagerApprovalModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders null when no pending approval exists', async () => {
    (managerApprovalService.getPending as jest.Mock).mockReturnValue(null);
    const tree = await renderUi(<ManagerApprovalModal />);
    expect(tree.toJSON()).toBeNull();
  });

  it('renders pending action description, submits 6-digit PIN, and supports Cancel', async () => {
    (managerApprovalService.getPending as jest.Mock).mockReturnValue({
      actionKey: 'refund:process',
      actionDescription: 'Process Refund',
      requesterId: 'u2',
    });
    (managerApprovalService.submitManagerPin as jest.Mock).mockResolvedValue({ success: false, error: 'Wrong PIN' });

    const tree = await renderUi(<ManagerApprovalModal />);
    expect(hasText(tree, 'Manager Approval Required')).toBe(true);
    expect(hasText(tree, 'Process Refund')).toBe(true);

    for (const digit of ['1', '2', '3', '4', '5', '6']) {
      await pressByText(tree, digit);
    }

    expect(managerApprovalService.submitManagerPin).toHaveBeenCalledWith('123456');
    expect(hasText(tree, 'Wrong PIN')).toBe(true);

    await pressByText(tree, 'Cancel');
    expect(managerApprovalService.cancel).toHaveBeenCalledTimes(1);
  });
});
