import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useManagerApproval } from './useManagerApproval';
import { permissionService } from '../services/permissions/PermissionService';
import { managerApprovalService } from '../services/permissions/ManagerApprovalService';
import { useAuthContext } from '../contexts/AuthProvider';

jest.mock('../services/permissions/PermissionService', () => ({
  permissionService: {
    can: jest.fn(),
  },
}));

jest.mock('../services/permissions/ManagerApprovalService', () => ({
  managerApprovalService: {
    requestApproval: jest.fn(),
  },
}));

jest.mock('../contexts/AuthProvider', () => ({
  useAuthContext: jest.fn(),
}));

const mockCan = permissionService.can as jest.Mock;
const mockRequestApproval = managerApprovalService.requestApproval as jest.Mock;
const mockUseAuthContext = useAuthContext as jest.Mock;

function mountHook() {
  let latest: ReturnType<typeof useManagerApproval> | null = null;
  function Harness() {
    latest = useManagerApproval();
    return null;
  }
  act(() => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useManagerApproval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false immediately when no user is authenticated', async () => {
    mockUseAuthContext.mockReturnValue({ user: null });
    const { get } = mountHook();

    let result = true;
    await act(async () => {
      result = await get().requestApproval('price:override');
    });

    expect(result).toBe(false);
    expect(mockCan).not.toHaveBeenCalled();
    expect(mockRequestApproval).not.toHaveBeenCalled();
  });

  it('returns true immediately when the user already has permission', async () => {
    mockUseAuthContext.mockReturnValue({ user: { id: 'u1', username: 'Admin', role: 'admin' } });
    mockCan.mockResolvedValue(true);
    const { get } = mountHook();

    let result = false;
    await act(async () => {
      result = await get().requestApproval('price:override');
    });

    expect(result).toBe(true);
    expect(mockCan).toHaveBeenCalledWith('u1', 'price:override');
    expect(mockRequestApproval).not.toHaveBeenCalled();
    expect(get().isApproving).toBe(false);
  });

  it('delegates to managerApprovalService when the user lacks permission', async () => {
    mockUseAuthContext.mockReturnValue({ user: { id: 'u2', username: 'Cashier', role: 'cashier' } });
    mockCan.mockResolvedValue(false);
    mockRequestApproval.mockResolvedValue({ approved: true, approverId: 'm1' });
    const { get } = mountHook();

    let result = false;
    await act(async () => {
      result = await get().requestApproval('refund:process');
    });

    expect(result).toBe(true);
    expect(mockRequestApproval).toHaveBeenCalledWith('refund:process', 'u2');
    expect(get().isApproving).toBe(false);
  });
});
