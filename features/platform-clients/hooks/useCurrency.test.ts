import React, { act } from 'react';
import { createRoot } from 'test-renderer';
import { useCurrency } from './useCurrency';
import { useEcommerceSettings } from './useEcommerceSettings';

jest.mock('./useEcommerceSettings', () => ({
  useEcommerceSettings: jest.fn(),
}));

function mountHook() {
  let latest: ReturnType<typeof useCurrency> | null = null;
  function Harness() {
    latest = useCurrency();
    return null;
  }
  act(() => {
    createRoot().render(React.createElement(Harness));
  });
  return { get: () => latest! };
}

describe('useCurrency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to GBP (£) when no currency is configured', () => {
    (useEcommerceSettings as jest.Mock).mockReturnValue({ ecommerceSettings: { offline: {} } });
    const { get } = mountHook();
    expect(get().code).toBe('GBP');
    expect(get().symbol).toBe('£');
  });

  it('returns configured currency symbol and info', () => {
    (useEcommerceSettings as jest.Mock).mockReturnValue({ ecommerceSettings: { offline: { currency: 'USD' } } });
    const { get } = mountHook();
    expect(get().code).toBe('USD');
    expect(get().symbol).toBe('$');
    expect(get().info?.code).toBe('USD');
  });
});
